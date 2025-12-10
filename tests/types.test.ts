/**
 * Tests for type definitions and type safety
 * These tests verify that TypeScript types are correctly exported and usable.
 */
import { describe, it, expect } from 'vitest';
import type {
  Options,
  Query,
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  McpServerConfig,
  McpStdioServerConfig,
  McpSSEServerConfig,
  McpHttpServerConfig,
  McpSdkServerConfig,
  PermissionMode,
  PermissionResult,
  PermissionBehavior,
  HookEvent,
  HookInput,
  HookJSONOutput,
  AgentDefinition,
  SettingSource,
  ModelUsage,
  OutputFormat,
  SdkBeta,
} from '@anthropic-ai/claude-agent-sdk';

describe('Type Definitions', () => {
  describe('Options type', () => {
    it('should allow empty options', () => {
      const options: Options = {};
      expect(options).toBeDefined();
    });

    it('should allow cwd option', () => {
      const options: Options = {
        cwd: '/path/to/project',
      };
      expect(options.cwd).toBe('/path/to/project');
    });

    it('should allow model option', () => {
      const options: Options = {
        model: 'claude-sonnet-4-5-20250929',
      };
      expect(options.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should allow permission mode options', () => {
      const modes: PermissionMode[] = [
        'default',
        'acceptEdits',
        'bypassPermissions',
        'plan',
        'dontAsk',
      ];

      for (const mode of modes) {
        const options: Options = { permissionMode: mode };
        expect(options.permissionMode).toBe(mode);
      }
    });

    it('should allow maxTurns and maxBudgetUsd', () => {
      const options: Options = {
        maxTurns: 10,
        maxBudgetUsd: 5.0,
      };
      expect(options.maxTurns).toBe(10);
      expect(options.maxBudgetUsd).toBe(5.0);
    });

    it('should allow systemPrompt string', () => {
      const options: Options = {
        systemPrompt: 'You are a helpful assistant.',
      };
      expect(options.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should allow systemPrompt preset', () => {
      const options: Options = {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
        },
      };
      expect(options.systemPrompt).toEqual({
        type: 'preset',
        preset: 'claude_code',
      });
    });

    it('should allow systemPrompt preset with append', () => {
      const options: Options = {
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: 'Additional instructions here.',
        },
      };
      expect(options.systemPrompt).toHaveProperty('append');
    });

    it('should allow tools configuration', () => {
      const optionsWithArray: Options = {
        tools: ['Bash', 'Read', 'Edit'],
      };
      expect(optionsWithArray.tools).toEqual(['Bash', 'Read', 'Edit']);

      const optionsWithPreset: Options = {
        tools: { type: 'preset', preset: 'claude_code' },
      };
      expect(optionsWithPreset.tools).toEqual({
        type: 'preset',
        preset: 'claude_code',
      });

      const optionsEmpty: Options = {
        tools: [],
      };
      expect(optionsEmpty.tools).toEqual([]);
    });

    it('should allow betas configuration', () => {
      const options: Options = {
        betas: ['context-1m-2025-08-07'],
      };
      expect(options.betas).toEqual(['context-1m-2025-08-07']);
    });

    it('should allow setting sources', () => {
      const sources: SettingSource[] = ['user', 'project', 'local'];
      const options: Options = {
        settingSources: sources,
      };
      expect(options.settingSources).toEqual(sources);
    });
  });

  describe('MCP Server Config types', () => {
    it('should support stdio server config', () => {
      const config: McpStdioServerConfig = {
        command: 'node',
        args: ['server.js'],
        env: { DEBUG: 'true' },
      };
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js']);
    });

    it('should support SSE server config', () => {
      const config: McpSSEServerConfig = {
        type: 'sse',
        url: 'https://example.com/sse',
        headers: { Authorization: 'Bearer token' },
      };
      expect(config.type).toBe('sse');
      expect(config.url).toBe('https://example.com/sse');
    });

    it('should support HTTP server config', () => {
      const config: McpHttpServerConfig = {
        type: 'http',
        url: 'https://example.com/api',
        headers: { 'X-API-Key': 'key' },
      };
      expect(config.type).toBe('http');
      expect(config.url).toBe('https://example.com/api');
    });

    it('should support SDK server config', () => {
      const config: McpSdkServerConfig = {
        type: 'sdk',
        name: 'my-sdk-server',
      };
      expect(config.type).toBe('sdk');
      expect(config.name).toBe('my-sdk-server');
    });
  });

  describe('Agent Definition type', () => {
    it('should allow minimal agent definition', () => {
      const agent: AgentDefinition = {
        description: 'A test agent',
        prompt: 'You are a test agent.',
      };
      expect(agent.description).toBe('A test agent');
      expect(agent.prompt).toBe('You are a test agent.');
    });

    it('should allow full agent definition', () => {
      const agent: AgentDefinition = {
        description: 'A code reviewer agent',
        prompt: 'Review the code for bugs and style issues.',
        tools: ['Read', 'Grep', 'Glob'],
        disallowedTools: ['Bash', 'Edit'],
        model: 'sonnet',
      };
      expect(agent.tools).toEqual(['Read', 'Grep', 'Glob']);
      expect(agent.disallowedTools).toEqual(['Bash', 'Edit']);
      expect(agent.model).toBe('sonnet');
    });

    it('should allow all model types', () => {
      const models: AgentDefinition['model'][] = [
        'sonnet',
        'opus',
        'haiku',
        'inherit',
        undefined,
      ];

      for (const model of models) {
        const agent: AgentDefinition = {
          description: 'test',
          prompt: 'test',
          model,
        };
        expect(agent.model).toBe(model);
      }
    });
  });

  describe('Permission types', () => {
    it('should support allow permission result', () => {
      const result: PermissionResult = {
        behavior: 'allow',
        updatedInput: { command: 'ls -la' },
      };
      expect(result.behavior).toBe('allow');
    });

    it('should support deny permission result', () => {
      const result: PermissionResult = {
        behavior: 'deny',
        message: 'Operation not allowed',
        interrupt: true,
      };
      expect(result.behavior).toBe('deny');
      expect(result.message).toBe('Operation not allowed');
    });

    it('should support all permission behaviors', () => {
      const behaviors: PermissionBehavior[] = ['allow', 'deny', 'ask'];
      expect(behaviors).toHaveLength(3);
    });
  });

  describe('Output format types', () => {
    it('should support json_schema output format', () => {
      const format: OutputFormat = {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            result: { type: 'string' },
            score: { type: 'number' },
          },
          required: ['result'],
        },
      };
      expect(format.type).toBe('json_schema');
      expect(format.schema).toBeDefined();
    });
  });

  describe('Model Usage type', () => {
    it('should have all required fields', () => {
      const usage: ModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 5,
        webSearchRequests: 0,
        costUSD: 0.01,
        contextWindow: 200000,
      };

      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      expect(usage.costUSD).toBe(0.01);
    });
  });

  describe('Beta types', () => {
    it('should support context-1m beta', () => {
      const beta: SdkBeta = 'context-1m-2025-08-07';
      expect(beta).toBe('context-1m-2025-08-07');
    });
  });
});
