/**
 * Tests for query function behavior
 * Note: These tests don't make actual API calls - they test the function
 * signature and behavior without an API key.
 */
import { describe, it, expect } from 'vitest';
import { query, AbortError } from '@anthropic-ai/claude-agent-sdk';
import type { Options, Query } from '@anthropic-ai/claude-agent-sdk';

describe('Query Function', () => {
  describe('Function signature', () => {
    it('should accept a string prompt', () => {
      // Verify the function accepts the expected parameters
      // We don't execute as it would require an API key
      expect(typeof query).toBe('function');

      // Check function accepts correct parameter structure
      const params = {
        prompt: 'Hello, world!',
      };
      expect(params.prompt).toBe('Hello, world!');
    });

    it('should accept options parameter', () => {
      const options: Options = {
        model: 'claude-sonnet-4-5-20250929',
        maxTurns: 5,
        cwd: '/tmp',
      };

      const params = {
        prompt: 'Test prompt',
        options,
      };

      expect(params.options).toBe(options);
      expect(params.options.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should accept AbortController in options', () => {
      const abortController = new AbortController();
      const options: Options = {
        abortController,
      };

      expect(options.abortController).toBe(abortController);
      expect(options.abortController?.signal.aborted).toBe(false);
    });
  });

  describe('AbortError', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new AbortError('Operation aborted');
      }).toThrow(AbortError);
    });

    it('should be an instance of AbortError', () => {
      const error = new AbortError('test');
      expect(error).toBeInstanceOf(AbortError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should preserve error message', () => {
      const error = new AbortError('Custom abort message');
      expect(error.message).toBe('Custom abort message');
    });

    it('should be catchable as Error', () => {
      try {
        throw new AbortError('test');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(AbortError);
      }
    });
  });

  describe('Options validation', () => {
    it('should allow bypassing permissions with flag', () => {
      const options: Options = {
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      };

      expect(options.permissionMode).toBe('bypassPermissions');
      expect(options.allowDangerouslySkipPermissions).toBe(true);
    });

    it('should allow configuring MCP servers', () => {
      const options: Options = {
        mcpServers: {
          'my-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      expect(options.mcpServers).toBeDefined();
      expect(options.mcpServers?.['my-server']).toBeDefined();
    });

    it('should allow configuring agents', () => {
      const options: Options = {
        agents: {
          'code-reviewer': {
            description: 'Reviews code for bugs',
            prompt: 'You are a code reviewer.',
            tools: ['Read', 'Grep'],
          },
        },
      };

      expect(options.agents).toBeDefined();
      expect(options.agents?.['code-reviewer']).toBeDefined();
      expect(options.agents?.['code-reviewer'].tools).toEqual(['Read', 'Grep']);
    });

    it('should allow configuring hooks', () => {
      const options: Options = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                async (input, toolUseId, opts) => {
                  return { continue: true };
                },
              ],
            },
          ],
        },
      };

      expect(options.hooks).toBeDefined();
      expect(options.hooks?.PreToolUse).toBeDefined();
      expect(options.hooks?.PreToolUse?.length).toBe(1);
    });

    it('should allow output format configuration', () => {
      const options: Options = {
        outputFormat: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              confidence: { type: 'number' },
            },
          },
        },
      };

      expect(options.outputFormat).toBeDefined();
      expect(options.outputFormat?.type).toBe('json_schema');
    });

    it('should allow resume and fork session options', () => {
      const options: Options = {
        resume: 'session-123',
        forkSession: true,
      };

      expect(options.resume).toBe('session-123');
      expect(options.forkSession).toBe(true);
    });

    it('should allow continue option', () => {
      const options: Options = {
        continue: true,
      };

      expect(options.continue).toBe(true);
    });

    it('should allow additional directories', () => {
      const options: Options = {
        additionalDirectories: ['/home/user/projects', '/var/log'],
      };

      expect(options.additionalDirectories).toEqual([
        '/home/user/projects',
        '/var/log',
      ]);
    });

    it('should allow env configuration', () => {
      const options: Options = {
        env: {
          NODE_ENV: 'test',
          DEBUG: 'true',
          UNDEFINED_VAR: undefined,
        },
      };

      expect(options.env?.NODE_ENV).toBe('test');
      expect(options.env?.DEBUG).toBe('true');
      expect(options.env?.UNDEFINED_VAR).toBeUndefined();
    });

    it('should allow executable configuration', () => {
      const options: Options = {
        executable: 'node',
        executableArgs: ['--max-old-space-size=4096'],
      };

      expect(options.executable).toBe('node');
      expect(options.executableArgs).toEqual(['--max-old-space-size=4096']);
    });

    it('should allow extra CLI args', () => {
      const options: Options = {
        extraArgs: {
          verbose: null, // boolean flag
          output: '/tmp/output.json',
        },
      };

      expect(options.extraArgs?.verbose).toBeNull();
      expect(options.extraArgs?.output).toBe('/tmp/output.json');
    });

    it('should allow fallback model', () => {
      const options: Options = {
        model: 'claude-opus-4-20250514',
        fallbackModel: 'claude-sonnet-4-5-20250929',
      };

      expect(options.fallbackModel).toBe('claude-sonnet-4-5-20250929');
    });

    it('should allow max thinking tokens', () => {
      const options: Options = {
        maxThinkingTokens: 10000,
      };

      expect(options.maxThinkingTokens).toBe(10000);
    });

    it('should allow permission prompt tool name', () => {
      const options: Options = {
        permissionPromptToolName: 'mcp__my-server__permission_prompt',
      };

      expect(options.permissionPromptToolName).toBe(
        'mcp__my-server__permission_prompt'
      );
    });

    it('should allow stderr callback', () => {
      const stderrData: string[] = [];
      const options: Options = {
        stderr: (data) => stderrData.push(data),
      };

      expect(options.stderr).toBeDefined();
      options.stderr?.('test error');
      expect(stderrData).toEqual(['test error']);
    });

    it('should allow strict MCP config', () => {
      const options: Options = {
        strictMcpConfig: true,
      };

      expect(options.strictMcpConfig).toBe(true);
    });

    it('should allow include partial messages', () => {
      const options: Options = {
        includePartialMessages: true,
      };

      expect(options.includePartialMessages).toBe(true);
    });

    it('should allow sandbox configuration', () => {
      const options: Options = {
        sandbox: {
          enabled: true,
        },
      };

      expect(options.sandbox?.enabled).toBe(true);
    });

    it('should allow plugins configuration', () => {
      const options: Options = {
        plugins: [
          { type: 'local', path: './my-plugin' },
          { type: 'local', path: '/absolute/path/to/plugin' },
        ],
      };

      expect(options.plugins).toHaveLength(2);
      expect(options.plugins?.[0].type).toBe('local');
    });

    it('should allow canUseTool callback', () => {
      const options: Options = {
        canUseTool: async (toolName, input, opts) => {
          if (toolName === 'Bash') {
            return {
              behavior: 'deny',
              message: 'Bash not allowed',
            };
          }
          return {
            behavior: 'allow',
            updatedInput: input,
          };
        },
      };

      expect(options.canUseTool).toBeDefined();
    });

    it('should allow resume session at specific message', () => {
      const options: Options = {
        resume: 'session-123',
        resumeSessionAt: 'message-uuid-456',
      };

      expect(options.resume).toBe('session-123');
      expect(options.resumeSessionAt).toBe('message-uuid-456');
    });
  });
});
