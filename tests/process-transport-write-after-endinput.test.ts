/**
 * Regression test for #148: write-after-endInput() race condition in ProcessTransport
 *
 * Race description:
 *   handleControlRequest() is launched fire-and-forget in the readMessages() loop.
 *   When the `result` message arrives immediately after a `control_request`, endInput()
 *   closes stdin. The in-flight handler resumes after its async work (e.g. canUseTool)
 *   and calls transport.write() on the now-ended stream — throwing ERR_STREAM_WRITE_AFTER_END.
 *   The catch block in handleControlRequest then attempts a second write() (the error
 *   response), which also throws and becomes an unhandled rejection, crashing Node.js.
 *
 * Fix (3 lines in ProcessTransport source):
 *   Add `private stdinEnded = false;` field.
 *   In endInput(): set `this.stdinEnded = true` before `processStdin.end()`.
 *   In write(): add `if (this.stdinEnded) return;` as the first guard.
 */
import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { query, AbortError } from '@anthropic-ai/claude-agent-sdk';
import type { Options, SpawnedProcess, SpawnOptions } from '@anthropic-ai/claude-agent-sdk';

function createMockProcess(): SpawnedProcess & { triggerExit(code: number | null, signal: NodeJS.Signals | null): void } {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const emitter = new EventEmitter();

  // Respond to the SDK's initialize control_request automatically
  let buf = '';
  stdin.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'control_request' && msg.request?.subtype === 'initialize') {
          const resp = JSON.stringify({
            type: 'control_response',
            response: { subtype: 'success', request_id: msg.request_id, response: {} },
          });
          stdout.push(resp + '\n');
        }
      } catch {}
    }
  });

  const proc: SpawnedProcess = {
    stdin,
    stdout,
    stderr: new PassThrough(),
    pid: 99999,
    killed: false,
    exitCode: null,
    on: emitter.on.bind(emitter) as SpawnedProcess['on'],
    kill: vi.fn(),
  };

  return Object.assign(proc, {
    triggerExit(code: number | null, signal: NodeJS.Signals | null) {
      (proc as any).exitCode = code;
      emitter.emit('exit', code, signal);
    },
  });
}

describe('ProcessTransport write-after-endInput race condition (#148)', () => {
  it('should not produce unhandled rejections when a control handler writes after endInput()', async () => {
    const unhandledErrors: Error[] = [];
    const handler = (err: Error) => unhandledErrors.push(err);
    process.on('unhandledRejection', handler);

    let mockProc: ReturnType<typeof createMockProcess>;
    const abortController = new AbortController();
    const canUseTool = vi.fn().mockImplementation(async () => {
      // 60 ms delay ensures endInput() fires before this handler writes its response
      await new Promise<void>((r) => setTimeout(r, 60));
      return true;
    });

    const options: Options = {
      pathToClaudeCodeExecutable: 'node',
      spawnClaudeCodeProcess: (_opts: SpawnOptions): SpawnedProcess => {
        mockProc = createMockProcess();
        return mockProc;
      },
      canUseTool,
      abortController,
    };

    const iter = query({ prompt: 'test', options });

    // Start consuming the generator before we push messages
    const drain = (async () => {
      try {
        for await (const _ of iter) {}
      } catch (err) {
        if (!(err instanceof AbortError)) throw err;
      }
    })();

    // Wait for the SDK to spawn the process and send its initialize handshake
    await new Promise<void>((r) => setTimeout(r, 50));

    // Push control_request (will be handled async by canUseTool above)
    const controlReq = JSON.stringify({
      type: 'control_request',
      request_id: 'req-race-1',
      request: { subtype: 'can_use_tool', tool_name: 'Bash', input: {} },
    });
    mockProc!.stdout.push(controlReq + '\n');

    // Push result immediately after — this triggers endInput() before canUseTool resolves
    const result = JSON.stringify({
      type: 'result',
      subtype: 'success',
      duration_ms: 10,
      duration_api_ms: 8,
      is_error: false,
      num_turns: 1,
      total_cost_usd: 0,
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      modelUsage: {},
      permission_denials: [],
      session_id: 'test-session',
      uuid: '00000000-0000-0000-0000-000000000001',
    });
    mockProc!.stdout.push(result + '\n');
    mockProc!.stdout.push(null);          // EOF
    mockProc!.triggerExit(0, null);       // unblocks waitForExit()

    // Wait long enough for canUseTool's 60 ms delay to resolve and attempt the write
    await new Promise<void>((r) => setTimeout(r, 150));

    abortController.abort();
    await drain;

    process.off('unhandledRejection', handler);

    const writeAfterEndErrors = unhandledErrors.filter(
      (e) =>
        (e as NodeJS.ErrnoException).code === 'ERR_STREAM_WRITE_AFTER_END' ||
        e.message.includes('write after end') ||
        e.message.includes('Failed to write to process stdin') ||
        e.message.includes('ProcessTransport is not ready for writing'),
    );

    expect(
      writeAfterEndErrors,
      `Unhandled write-after-end rejection detected (bug not fixed): ${writeAfterEndErrors.map((e) => e.message).join(', ')}`,
    ).toHaveLength(0);
  }, 5000);

  it('confirms PassThrough.writableEnded is set synchronously by .end() — invariant the fix relies on', () => {
    const stream = new PassThrough();
    expect(stream.writableEnded).toBe(false);
    stream.end();
    expect(stream.writableEnded).toBe(true);
  });
});
