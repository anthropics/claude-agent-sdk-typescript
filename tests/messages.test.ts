/**
 * Tests for SDK message types
 */
import { describe, it, expect } from 'vitest';
import type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKPartialAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKStatusMessage,
  SDKHookResponseMessage,
  SDKToolProgressMessage,
  SDKAuthStatusMessage,
  SDKUserMessageReplay,
  SDKPermissionDenial,
  SDKAssistantMessageError,
} from '@anthropic-ai/claude-agent-sdk';

describe('SDK Message Types', () => {
  describe('SDKUserMessage', () => {
    it('should support user message structure', () => {
      const message: SDKUserMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello, Claude!',
        },
        parent_tool_use_id: null,
        session_id: 'session-123',
      };

      expect(message.type).toBe('user');
      expect(message.parent_tool_use_id).toBeNull();
    });

    it('should support synthetic user message', () => {
      const message: SDKUserMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: 'Tool result placeholder',
        },
        parent_tool_use_id: 'tool-123',
        isSynthetic: true,
        session_id: 'session-123',
      };

      expect(message.isSynthetic).toBe(true);
      expect(message.parent_tool_use_id).toBe('tool-123');
    });

    it('should support tool_use_result', () => {
      const message: SDKUserMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-123',
              content: 'Success',
            },
          ],
        },
        parent_tool_use_id: 'tool-123',
        tool_use_result: { status: 'success', output: 'File created' },
        session_id: 'session-123',
      };

      expect(message.tool_use_result).toEqual({
        status: 'success',
        output: 'File created',
      });
    });
  });

  describe('SDKUserMessageReplay', () => {
    it('should have isReplay set to true', () => {
      const message: SDKUserMessageReplay = {
        type: 'user',
        message: {
          role: 'user',
          content: 'Original message',
        },
        parent_tool_use_id: null,
        uuid: 'uuid-123' as any,
        session_id: 'session-123',
        isReplay: true,
      };

      expect(message.isReplay).toBe(true);
    });
  });

  describe('SDKAssistantMessage', () => {
    it('should support assistant message structure', () => {
      const message: SDKAssistantMessage = {
        type: 'assistant',
        message: {
          id: 'msg-123',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Hello! How can I help you?',
            },
          ],
          model: 'claude-sonnet-4-5-20250929',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        },
        parent_tool_use_id: null,
        uuid: 'uuid-456' as any,
        session_id: 'session-123',
      };

      expect(message.type).toBe('assistant');
      expect(message.message.role).toBe('assistant');
    });

    it('should support error field', () => {
      const errorTypes: SDKAssistantMessageError[] = [
        'authentication_failed',
        'billing_error',
        'rate_limit',
        'invalid_request',
        'server_error',
        'unknown',
      ];

      for (const error of errorTypes) {
        const message: SDKAssistantMessage = {
          type: 'assistant',
          message: {} as any,
          parent_tool_use_id: null,
          error,
          uuid: 'uuid-789' as any,
          session_id: 'session-123',
        };

        expect(message.error).toBe(error);
      }
    });
  });

  describe('SDKResultMessage', () => {
    it('should support success result', () => {
      const message: SDKResultMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: 5000,
        duration_api_ms: 4500,
        is_error: false,
        num_turns: 3,
        result: 'Task completed successfully',
        total_cost_usd: 0.05,
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        modelUsage: {
          'claude-sonnet-4-5-20250929': {
            inputTokens: 100,
            outputTokens: 200,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            webSearchRequests: 0,
            costUSD: 0.05,
            contextWindow: 200000,
          },
        },
        permission_denials: [],
        uuid: 'uuid-result' as any,
        session_id: 'session-123',
      };

      expect(message.subtype).toBe('success');
      expect(message.is_error).toBe(false);
      expect(message.result).toBe('Task completed successfully');
    });

    it('should support error result types', () => {
      const errorSubtypes: Array<
        | 'error_during_execution'
        | 'error_max_turns'
        | 'error_max_budget_usd'
        | 'error_max_structured_output_retries'
      > = [
        'error_during_execution',
        'error_max_turns',
        'error_max_budget_usd',
        'error_max_structured_output_retries',
      ];

      for (const subtype of errorSubtypes) {
        const message: SDKResultMessage = {
          type: 'result',
          subtype,
          duration_ms: 1000,
          duration_api_ms: 900,
          is_error: true,
          num_turns: 1,
          total_cost_usd: 0.01,
          usage: {
            input_tokens: 50,
            output_tokens: 10,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
          modelUsage: {},
          permission_denials: [],
          errors: ['An error occurred'],
          uuid: 'uuid-error' as any,
          session_id: 'session-123',
        };

        expect(message.subtype).toBe(subtype);
        expect(message.is_error).toBe(true);
      }
    });

    it('should support permission denials', () => {
      const denial: SDKPermissionDenial = {
        tool_name: 'Bash',
        tool_use_id: 'tool-123',
        tool_input: { command: 'rm -rf /' },
      };

      const message: SDKResultMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: 100,
        duration_api_ms: 90,
        is_error: false,
        num_turns: 1,
        result: 'Completed with denied operations',
        total_cost_usd: 0.01,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        modelUsage: {},
        permission_denials: [denial],
        uuid: 'uuid-denial' as any,
        session_id: 'session-123',
      };

      expect(message.permission_denials).toHaveLength(1);
      expect(message.permission_denials[0].tool_name).toBe('Bash');
    });

    it('should support structured output', () => {
      const message: SDKResultMessage = {
        type: 'result',
        subtype: 'success',
        duration_ms: 500,
        duration_api_ms: 450,
        is_error: false,
        num_turns: 1,
        result: '{"answer": "42", "confidence": 0.95}',
        total_cost_usd: 0.02,
        usage: {
          input_tokens: 20,
          output_tokens: 15,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        modelUsage: {},
        permission_denials: [],
        structured_output: { answer: '42', confidence: 0.95 },
        uuid: 'uuid-structured' as any,
        session_id: 'session-123',
      };

      expect(message.structured_output).toEqual({
        answer: '42',
        confidence: 0.95,
      });
    });
  });

  describe('SDKSystemMessage', () => {
    it('should support init system message', () => {
      const message: SDKSystemMessage = {
        type: 'system',
        subtype: 'init',
        apiKeySource: 'user',
        claude_code_version: '2.0.61',
        cwd: '/home/user/project',
        tools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
        mcp_servers: [
          { name: 'my-server', status: 'connected' },
          { name: 'other-server', status: 'failed' },
        ],
        model: 'claude-sonnet-4-5-20250929',
        permissionMode: 'default',
        slash_commands: ['review', 'test', 'deploy'],
        output_style: 'default',
        skills: ['code-review', 'test-runner'],
        plugins: [{ name: 'my-plugin', path: './plugins/my-plugin' }],
        uuid: 'uuid-system' as any,
        session_id: 'session-123',
      };

      expect(message.type).toBe('system');
      expect(message.subtype).toBe('init');
      expect(message.tools).toContain('Bash');
    });

    it('should support optional agents and betas', () => {
      const message: SDKSystemMessage = {
        type: 'system',
        subtype: 'init',
        agents: ['code-reviewer', 'test-runner'],
        betas: ['context-1m-2025-08-07'],
        apiKeySource: 'project',
        claude_code_version: '2.0.61',
        cwd: '/home/user/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-sonnet-4-5-20250929',
        permissionMode: 'acceptEdits',
        slash_commands: [],
        output_style: 'streaming',
        skills: [],
        plugins: [],
        uuid: 'uuid-system-2' as any,
        session_id: 'session-123',
      };

      expect(message.agents).toEqual(['code-reviewer', 'test-runner']);
      expect(message.betas).toEqual(['context-1m-2025-08-07']);
    });
  });

  describe('SDKPartialAssistantMessage', () => {
    it('should support stream event', () => {
      const message: SDKPartialAssistantMessage = {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: 'Hello',
          },
        },
        parent_tool_use_id: null,
        uuid: 'uuid-partial' as any,
        session_id: 'session-123',
      };

      expect(message.type).toBe('stream_event');
      expect(message.event.type).toBe('content_block_delta');
    });
  });

  describe('SDKCompactBoundaryMessage', () => {
    it('should support compact boundary', () => {
      const message: SDKCompactBoundaryMessage = {
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: {
          trigger: 'auto',
          pre_tokens: 150000,
        },
        uuid: 'uuid-compact' as any,
        session_id: 'session-123',
      };

      expect(message.subtype).toBe('compact_boundary');
      expect(message.compact_metadata.trigger).toBe('auto');
    });

    it('should support manual trigger', () => {
      const message: SDKCompactBoundaryMessage = {
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: {
          trigger: 'manual',
          pre_tokens: 50000,
        },
        uuid: 'uuid-compact-manual' as any,
        session_id: 'session-123',
      };

      expect(message.compact_metadata.trigger).toBe('manual');
    });
  });

  describe('SDKStatusMessage', () => {
    it('should support compacting status', () => {
      const message: SDKStatusMessage = {
        type: 'system',
        subtype: 'status',
        status: 'compacting',
        uuid: 'uuid-status' as any,
        session_id: 'session-123',
      };

      expect(message.subtype).toBe('status');
      expect(message.status).toBe('compacting');
    });

    it('should support null status', () => {
      const message: SDKStatusMessage = {
        type: 'system',
        subtype: 'status',
        status: null,
        uuid: 'uuid-status-null' as any,
        session_id: 'session-123',
      };

      expect(message.status).toBeNull();
    });
  });

  describe('SDKHookResponseMessage', () => {
    it('should support hook response', () => {
      const message: SDKHookResponseMessage = {
        type: 'system',
        subtype: 'hook_response',
        hook_name: 'my-hook',
        hook_event: 'PreToolUse',
        stdout: 'Hook output',
        stderr: '',
        exit_code: 0,
        uuid: 'uuid-hook' as any,
        session_id: 'session-123',
      };

      expect(message.subtype).toBe('hook_response');
      expect(message.hook_name).toBe('my-hook');
      expect(message.exit_code).toBe(0);
    });
  });

  describe('SDKToolProgressMessage', () => {
    it('should support tool progress', () => {
      const message: SDKToolProgressMessage = {
        type: 'tool_progress',
        tool_use_id: 'tool-123',
        tool_name: 'Bash',
        parent_tool_use_id: null,
        elapsed_time_seconds: 5.5,
        uuid: 'uuid-progress' as any,
        session_id: 'session-123',
      };

      expect(message.type).toBe('tool_progress');
      expect(message.elapsed_time_seconds).toBe(5.5);
    });
  });

  describe('SDKAuthStatusMessage', () => {
    it('should support auth status', () => {
      const message: SDKAuthStatusMessage = {
        type: 'auth_status',
        isAuthenticating: true,
        output: ['Authenticating...', 'Please wait'],
        uuid: 'uuid-auth' as any,
        session_id: 'session-123',
      };

      expect(message.type).toBe('auth_status');
      expect(message.isAuthenticating).toBe(true);
      expect(message.output).toHaveLength(2);
    });

    it('should support auth error', () => {
      const message: SDKAuthStatusMessage = {
        type: 'auth_status',
        isAuthenticating: false,
        output: ['Authentication failed'],
        error: 'Invalid API key',
        uuid: 'uuid-auth-error' as any,
        session_id: 'session-123',
      };

      expect(message.error).toBe('Invalid API key');
    });
  });
});
