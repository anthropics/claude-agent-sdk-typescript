/**
 * Tests for hook types and behaviors
 */
import { describe, it, expect } from 'vitest';
import { HOOK_EVENTS } from '@anthropic-ai/claude-agent-sdk';
import type {
  HookEvent,
  HookInput,
  HookJSONOutput,
  HookCallback,
  HookCallbackMatcher,
  PreToolUseHookInput,
  PostToolUseHookInput,
  PostToolUseFailureHookInput,
  NotificationHookInput,
  UserPromptSubmitHookInput,
  SessionStartHookInput,
  SessionEndHookInput,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  PreCompactHookInput,
  PermissionRequestHookInput,
  SyncHookJSONOutput,
  AsyncHookJSONOutput,
} from '@anthropic-ai/claude-agent-sdk';

describe('Hooks', () => {
  describe('HOOK_EVENTS constant', () => {
    it('should contain all expected events', () => {
      expect(HOOK_EVENTS).toContain('PreToolUse');
      expect(HOOK_EVENTS).toContain('PostToolUse');
      expect(HOOK_EVENTS).toContain('PostToolUseFailure');
      expect(HOOK_EVENTS).toContain('Notification');
      expect(HOOK_EVENTS).toContain('UserPromptSubmit');
      expect(HOOK_EVENTS).toContain('SessionStart');
      expect(HOOK_EVENTS).toContain('SessionEnd');
      expect(HOOK_EVENTS).toContain('Stop');
      expect(HOOK_EVENTS).toContain('SubagentStart');
      expect(HOOK_EVENTS).toContain('SubagentStop');
      expect(HOOK_EVENTS).toContain('PreCompact');
      expect(HOOK_EVENTS).toContain('PermissionRequest');
    });

    it('should have 12 hook events', () => {
      expect(HOOK_EVENTS).toHaveLength(12);
    });

    it('should be readonly', () => {
      // TypeScript enforces this at compile time
      // At runtime, we verify the array exists
      expect(Array.isArray(HOOK_EVENTS)).toBe(true);
    });
  });

  describe('Hook Input Types', () => {
    it('should support PreToolUseHookInput', () => {
      const input: PreToolUseHookInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
        tool_use_id: 'tool-use-123',
      };

      expect(input.hook_event_name).toBe('PreToolUse');
      expect(input.tool_name).toBe('Bash');
      expect(input.tool_input).toEqual({ command: 'ls -la' });
    });

    it('should support PostToolUseHookInput', () => {
      const input: PostToolUseHookInput = {
        hook_event_name: 'PostToolUse',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.txt' },
        tool_response: 'File contents here',
        tool_use_id: 'tool-use-456',
      };

      expect(input.hook_event_name).toBe('PostToolUse');
      expect(input.tool_response).toBe('File contents here');
    });

    it('should support PostToolUseFailureHookInput', () => {
      const input: PostToolUseFailureHookInput = {
        hook_event_name: 'PostToolUseFailure',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        tool_name: 'Bash',
        tool_input: { command: 'invalid-command' },
        tool_use_id: 'tool-use-789',
        error: 'Command not found',
        is_interrupt: false,
      };

      expect(input.hook_event_name).toBe('PostToolUseFailure');
      expect(input.error).toBe('Command not found');
    });

    it('should support NotificationHookInput', () => {
      const input: NotificationHookInput = {
        hook_event_name: 'Notification',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        message: 'Task completed',
        title: 'Success',
        notification_type: 'info',
      };

      expect(input.hook_event_name).toBe('Notification');
      expect(input.message).toBe('Task completed');
    });

    it('should support UserPromptSubmitHookInput', () => {
      const input: UserPromptSubmitHookInput = {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        prompt: 'Help me fix this bug',
      };

      expect(input.hook_event_name).toBe('UserPromptSubmit');
      expect(input.prompt).toBe('Help me fix this bug');
    });

    it('should support SessionStartHookInput', () => {
      const sources: SessionStartHookInput['source'][] = [
        'startup',
        'resume',
        'clear',
        'compact',
      ];

      for (const source of sources) {
        const input: SessionStartHookInput = {
          hook_event_name: 'SessionStart',
          session_id: 'session-123',
          transcript_path: '/tmp/transcript.json',
          cwd: '/home/user/project',
          source,
        };

        expect(input.hook_event_name).toBe('SessionStart');
        expect(input.source).toBe(source);
      }
    });

    it('should support SessionEndHookInput', () => {
      const input: SessionEndHookInput = {
        hook_event_name: 'SessionEnd',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        reason: 'completed',
      };

      expect(input.hook_event_name).toBe('SessionEnd');
      expect(input.reason).toBe('completed');
    });

    it('should support StopHookInput', () => {
      const input: StopHookInput = {
        hook_event_name: 'Stop',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        stop_hook_active: true,
      };

      expect(input.hook_event_name).toBe('Stop');
      expect(input.stop_hook_active).toBe(true);
    });

    it('should support SubagentStartHookInput', () => {
      const input: SubagentStartHookInput = {
        hook_event_name: 'SubagentStart',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        agent_id: 'agent-456',
        agent_type: 'code-reviewer',
      };

      expect(input.hook_event_name).toBe('SubagentStart');
      expect(input.agent_id).toBe('agent-456');
      expect(input.agent_type).toBe('code-reviewer');
    });

    it('should support SubagentStopHookInput', () => {
      const input: SubagentStopHookInput = {
        hook_event_name: 'SubagentStop',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        stop_hook_active: false,
        agent_id: 'agent-456',
        agent_transcript_path: '/tmp/agent-transcript.json',
      };

      expect(input.hook_event_name).toBe('SubagentStop');
      expect(input.agent_transcript_path).toBe('/tmp/agent-transcript.json');
    });

    it('should support PreCompactHookInput', () => {
      const triggers: PreCompactHookInput['trigger'][] = ['manual', 'auto'];

      for (const trigger of triggers) {
        const input: PreCompactHookInput = {
          hook_event_name: 'PreCompact',
          session_id: 'session-123',
          transcript_path: '/tmp/transcript.json',
          cwd: '/home/user/project',
          trigger,
          custom_instructions: 'Focus on key decisions',
        };

        expect(input.hook_event_name).toBe('PreCompact');
        expect(input.trigger).toBe(trigger);
      }
    });

    it('should support PermissionRequestHookInput', () => {
      const input: PermissionRequestHookInput = {
        hook_event_name: 'PermissionRequest',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        tool_name: 'Edit',
        tool_input: { file_path: '/etc/passwd' },
        permission_suggestions: [
          {
            type: 'addRules',
            rules: [{ toolName: 'Edit', ruleContent: '/home/**' }],
            behavior: 'allow',
            destination: 'session',
          },
        ],
      };

      expect(input.hook_event_name).toBe('PermissionRequest');
      expect(input.permission_suggestions).toBeDefined();
    });
  });

  describe('Hook Output Types', () => {
    it('should support SyncHookJSONOutput', () => {
      const output: SyncHookJSONOutput = {
        continue: true,
        suppressOutput: false,
      };

      expect(output.continue).toBe(true);
    });

    it('should support SyncHookJSONOutput with decision', () => {
      const output: SyncHookJSONOutput = {
        decision: 'approve',
        reason: 'Safe operation',
      };

      expect(output.decision).toBe('approve');
      expect(output.reason).toBe('Safe operation');
    });

    it('should support SyncHookJSONOutput with hook-specific output', () => {
      const preToolUseOutput: SyncHookJSONOutput = {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'Approved by admin',
          updatedInput: { command: 'ls' },
        },
      };

      expect(preToolUseOutput.hookSpecificOutput?.hookEventName).toBe(
        'PreToolUse'
      );

      const userPromptOutput: SyncHookJSONOutput = {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: 'User is testing the SDK',
        },
      };

      expect(userPromptOutput.hookSpecificOutput?.hookEventName).toBe(
        'UserPromptSubmit'
      );
    });

    it('should support AsyncHookJSONOutput', () => {
      const output: AsyncHookJSONOutput = {
        async: true,
        asyncTimeout: 30000,
      };

      expect(output.async).toBe(true);
      expect(output.asyncTimeout).toBe(30000);
    });

    it('should support block decision', () => {
      const output: SyncHookJSONOutput = {
        decision: 'block',
        reason: 'Potentially dangerous operation',
        stopReason: 'Security policy violation',
      };

      expect(output.decision).toBe('block');
    });
  });

  describe('HookCallbackMatcher', () => {
    it('should support matcher with hooks', () => {
      const hookCallback: HookCallback = async (input, toolUseId, opts) => {
        return { continue: true };
      };

      const matcher: HookCallbackMatcher = {
        matcher: 'Bash*',
        hooks: [hookCallback],
        timeout: 60,
      };

      expect(matcher.matcher).toBe('Bash*');
      expect(matcher.hooks).toHaveLength(1);
      expect(matcher.timeout).toBe(60);
    });

    it('should support matcher without pattern (matches all)', () => {
      const matcher: HookCallbackMatcher = {
        hooks: [async () => ({ continue: true })],
      };

      expect(matcher.matcher).toBeUndefined();
      expect(matcher.hooks).toHaveLength(1);
    });

    it('should support multiple hooks', () => {
      const hook1: HookCallback = async () => ({ continue: true });
      const hook2: HookCallback = async () => ({
        continue: true,
        systemMessage: 'Logged',
      });
      const hook3: HookCallback = async () => ({ decision: 'approve' });

      const matcher: HookCallbackMatcher = {
        hooks: [hook1, hook2, hook3],
      };

      expect(matcher.hooks).toHaveLength(3);
    });
  });

  describe('Hook Callback Execution', () => {
    it('should execute hook callback with proper arguments', async () => {
      let receivedInput: HookInput | null = null;
      let receivedToolUseId: string | undefined = undefined;
      let signalReceived = false;

      const hookCallback: HookCallback = async (input, toolUseId, opts) => {
        receivedInput = input;
        receivedToolUseId = toolUseId;
        signalReceived = opts.signal !== undefined;
        return { continue: true };
      };

      const testInput: PreToolUseHookInput = {
        hook_event_name: 'PreToolUse',
        session_id: 'session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        tool_name: 'Bash',
        tool_input: { command: 'echo hello' },
        tool_use_id: 'tool-123',
      };

      const abortController = new AbortController();
      const result = await hookCallback(testInput, 'tool-123', {
        signal: abortController.signal,
      });

      expect(receivedInput).toEqual(testInput);
      expect(receivedToolUseId).toBe('tool-123');
      expect(signalReceived).toBe(true);
      expect(result).toEqual({ continue: true });
    });

    it('should handle async hook that blocks', async () => {
      const blockingHook: HookCallback = async () => ({
        decision: 'block',
        reason: 'Operation not allowed',
      });

      const result = await blockingHook(
        {} as HookInput,
        'tool-123',
        { signal: new AbortController().signal }
      );

      expect(result).toEqual({
        decision: 'block',
        reason: 'Operation not allowed',
      });
    });

    it('should handle hook that modifies input', async () => {
      const modifyingHook: HookCallback = async (input) => ({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          updatedInput: { command: 'safe-command' },
        },
      });

      const result = await modifyingHook(
        {} as HookInput,
        undefined,
        { signal: new AbortController().signal }
      );

      expect(result).toHaveProperty('hookSpecificOutput');
    });
  });
});
