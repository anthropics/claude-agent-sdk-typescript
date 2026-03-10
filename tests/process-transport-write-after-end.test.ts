/**
 * Regression test for issue #148:
 * "Race condition: writes after endInput() cause ERR_STREAM_WRITE_AFTER_END"
 *
 * Root cause: ProcessTransport.endInput() calls processStdin.end() but leaves
 * this.ready = true and this.processStdin set. In single-turn mode the SDK calls
 * endInput() when the first `result` message is received. Because
 * handleControlRequest() is NOT awaited in the readMessages loop, an in-flight
 * control handler can still call transport.write() after stdin is ended.
 *
 * That write() passes all existing guards, reaches processStdin.write() on a
 * closed Writable, and throws ERR_STREAM_WRITE_AFTER_END. The handleControlRequest
 * catch block then tries a second write() (the error response), which also throws
 * — as an UNHANDLED rejection that crashes Node.js.
 *
 * The fix: add a stdinEnded guard as the very first check in write():
 *
 *   private stdinEnded = false;
 *
 *   endInput(): void {
 *     this.stdinEnded = true;          // ← NEW: set BEFORE calling .end()
 *     if (this.processStdin) this.processStdin.end();
 *   }
 *
 *   write(data: string): void {
 *     if (this.stdinEnded) return;     // ← NEW: silent drop, never throws
 *     // ... rest of existing guards unchanged ...
 *   }
 *
 * Silent drop is safe because after endInput() the subprocess has already emitted
 * its `result` message and will not read any further stdin data.
 */

import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';
import { query, AbortError } from '@anthropic-ai/claude-agent-sdk';
import type { SpawnedProcess, SpawnOptions } from '@anthropic-ai/claude-agent-sdk';

/** Minimal SpawnedProcess that lets the test control stdin/stdout. */
function createMockProcess() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const emitter = new EventEmitter();
  let killed = false;
  let exitCode: number | null = null;

  const proc = {
    stdin,
    stdout,
    get killed() { return killed; },
    get exitCode() { return exitCode; },
    kill(_signal?: NodeJS.Signals): boolean { killed = true; return true; },
    on(event: 'exit' | 'error', listener: (...args: unknown[]) => void): void {
      emitter.on(event, listener);
    },
    once(event: 'exit' | 'error', listener: (...args: unknown[]) => void): void {
      emitter.once(event, listener);
    },
    off(event: 'exit' | 'error', listener: (...args: unknown[]) => void): void {
      emitter.off(event, listener);
    },
    triggerExit(code: number | null, signal: NodeJS.Signals | null = null): void {
      exitCode = code;
      killed = signal != null;
      emitter.emit('exit', code, signal);
    },
  } satisfies SpawnedProcess & { stdin: PassThrough; stdout: PassThrough; triggerExit: Function };

  // Auto-respond to the SDK's initialize control_request so the SDK becomes ready.
  // The SDK writes {"type":"control_request","request":{"subtype":"initialize"},...}
  // and waits for {"type":"control_response","response":{"subtype":"success",...}}.
  let stdinBuffer = '';
  stdin.on('data', (chunk: Buffer) => {
    stdinBuffer += chunk.toString();
    const lines = stdinBuffer.split('\n');
    stdinBuffer = lines.pop() ?? ''; // keep incomplete last line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as { type: string; request_id: string; request: { subtype: string } };
        if (msg.type === 'control_request' && msg.request?.subtype === 'initialize') {
          const resp = JSON.stringify({
            type: 'control_response',
            response: { subtype: 'success', request_id: msg.request_id, response: {} },
          });
          stdout.push(resp + '\n');
        }
      } catch {
        // ignore non-JSON or partial lines
      }
    }
  });

  return proc;
}

describe('ProcessTransport write-after-endInput race condition (issue #148)', () => {
  it(
    'should not produce unhandled rejections when a control handler writes after endInput()',
    async () => {
      /**
       * Reproduces the exact race:
       *
       *   t=0ms  : SDK spawns, sends initialize → mock responds → SDK ready
       *   t=50ms : control_request arrives → handleControlRequest() starts (NOT awaited)
       *            canUseTool waits 60ms before returning
       *   t=50ms : result message arrives → endInput() → processStdin.end()
       *   t=110ms: canUseTool resolves → handleControlRequest tries write()
       *            ← without fix: ERR_STREAM_WRITE_AFTER_END → unhandled rejection
       *            ← with fix: stdinEnded guard returns silently → no crash
       */
      const unhandledErrors: Error[] = [];
      const onUnhandled = (reason: unknown) => {
        if (reason instanceof Error) unhandledErrors.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      const spawnCalled = vi.fn();
      let mockProc: ReturnType<typeof createMockProcess> | null = null;

      // canUseTool introduces a 60ms delay so the result message + endInput()
      // runs before the control handler tries to write its response.
      const canUseTool = vi.fn(async (_toolName: string) => {
        await new Promise<void>((r) => setTimeout(r, 60));
        return { behavior: 'allow' as const };
      });

      const abortController = new AbortController();

      // query() takes a single {prompt, options} object — NOT positional args
      const queryIterator = query({
        prompt: 'test prompt',
        options: {
          pathToClaudeCodeExecutable: 'node', // ignored when spawnClaudeCodeProcess is set
          spawnClaudeCodeProcess: (_options: SpawnOptions): SpawnedProcess => {
            spawnCalled();
            mockProc = createMockProcess();
            return mockProc;
          },
          canUseTool,
          abortController,
        },
      });

      // IMPORTANT: start consuming the iterator immediately — this is what
      // triggers the lazy spawn. The agent's original test waited 50ms before
      // consuming, so spawnClaudeCodeProcess was never called.
      const drainDone = (async () => {
        try {
          for await (const _msg of queryIterator) { /* consume */ }
        } catch (err) {
          if (err instanceof AbortError) return;
          // Expected: "not valid JSON", "process exited", etc from mock mismatch
        }
      })();

      // Wait for the SDK to spawn and complete the initialize handshake
      await new Promise<void>((r) => setTimeout(r, 50));
      expect(spawnCalled).toHaveBeenCalledOnce();
      expect(mockProc).not.toBeNull();
      const proc = mockProc!;

      // Push the race scenario messages back-to-back:
      // 1. control_request  → handleControlRequest() fires async (not awaited)
      // 2. result           → endInput() called immediately after
      proc.stdout.push(
        JSON.stringify({
          type: 'control_request',
          request_id: 'race-148',
          request: {
            subtype: 'can_use_tool',
            tool_name: 'Bash',
            input: { command: 'echo hi' },
            tool_use_id: 'tu-001',
          },
        }) + '\n'
      );
      proc.stdout.push(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '',
          session_id: 'sess-148',
          cost_usd: 0,
          duration_ms: 10,
          duration_api_ms: 5,
          num_turns: 1,
          usage: { input_tokens: 1, output_tokens: 1 },
        }) + '\n'
      );
      proc.stdout.push(null); // EOF — closes the readMessages loop
      proc.triggerExit(0, null); // unblock ProcessTransport.waitForExit()

      // Wait well past the canUseTool delay so the in-flight write attempt executes
      await new Promise<void>((r) => setTimeout(r, 200));

      abortController.abort();
      await drainDone;

      process.off('unhandledRejection', onUnhandled);

      const streamErrors = unhandledErrors.filter(
        (e) =>
          (e as NodeJS.ErrnoException).code === 'ERR_STREAM_WRITE_AFTER_END' ||
          e.message.includes('write after end') ||
          e.message.includes('Failed to write to process stdin') ||
          e.message.includes('ProcessTransport is not ready for writing')
      );

      expect(
        streamErrors,
        `Unexpected write-after-end errors (bug not fixed): ${streamErrors.map((e) => e.message).join(', ')}`
      ).toHaveLength(0);
    },
    5000
  );

  it('confirms stdin.writableEnded is set synchronously by .end() — the invariant the fix relies on', () => {
    /**
     * The stdinEnded fix sets the flag BEFORE calling processStdin.end().
     * This test documents that .end() sets writableEnded synchronously,
     * so either approach (explicit flag OR checking writableEnded) would work.
     * The explicit flag is preferred because it does not rely on stream internals.
     */
    const stdin = new PassThrough();
    expect(stdin.writableEnded).toBe(false);
    stdin.end();
    expect(stdin.writableEnded).toBe(true);
  });
});
