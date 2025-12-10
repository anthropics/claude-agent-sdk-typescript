/**
 * Tests to verify that all expected exports from the SDK are available
 * and have the correct types.
 */
import { describe, it, expect } from 'vitest';
import * as SDK from '@anthropic-ai/claude-agent-sdk';

describe('SDK Exports', () => {
  describe('Core Functions', () => {
    it('should export query function', () => {
      expect(SDK.query).toBeDefined();
      expect(typeof SDK.query).toBe('function');
    });

    it('should export tool function', () => {
      expect(SDK.tool).toBeDefined();
      expect(typeof SDK.tool).toBe('function');
    });

    it('should export createSdkMcpServer function', () => {
      expect(SDK.createSdkMcpServer).toBeDefined();
      expect(typeof SDK.createSdkMcpServer).toBe('function');
    });
  });

  describe('V2 Session API', () => {
    it('should export unstable_v2_createSession', () => {
      expect(SDK.unstable_v2_createSession).toBeDefined();
      expect(typeof SDK.unstable_v2_createSession).toBe('function');
    });

    it('should export unstable_v2_resumeSession', () => {
      expect(SDK.unstable_v2_resumeSession).toBeDefined();
      expect(typeof SDK.unstable_v2_resumeSession).toBe('function');
    });

    it('should export unstable_v2_prompt', () => {
      expect(SDK.unstable_v2_prompt).toBeDefined();
      expect(typeof SDK.unstable_v2_prompt).toBe('function');
    });
  });

  describe('Constants', () => {
    it('should export HOOK_EVENTS array', () => {
      expect(SDK.HOOK_EVENTS).toBeDefined();
      expect(Array.isArray(SDK.HOOK_EVENTS)).toBe(true);
      expect(SDK.HOOK_EVENTS.length).toBeGreaterThan(0);
    });

    it('should include expected hook events', () => {
      const expectedEvents = [
        'PreToolUse',
        'PostToolUse',
        'PostToolUseFailure',
        'Notification',
        'UserPromptSubmit',
        'SessionStart',
        'SessionEnd',
        'Stop',
        'SubagentStart',
        'SubagentStop',
        'PreCompact',
        'PermissionRequest',
      ];
      for (const event of expectedEvents) {
        expect(SDK.HOOK_EVENTS).toContain(event);
      }
    });

    it('should export EXIT_REASONS array', () => {
      expect(SDK.EXIT_REASONS).toBeDefined();
      expect(Array.isArray(SDK.EXIT_REASONS)).toBe(true);
    });
  });

  describe('Classes', () => {
    it('should export AbortError class', () => {
      expect(SDK.AbortError).toBeDefined();
      expect(typeof SDK.AbortError).toBe('function');
    });

    it('AbortError should extend Error', () => {
      const error = new SDK.AbortError('test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SDK.AbortError);
      expect(error.message).toBe('test');
    });
  });
});
