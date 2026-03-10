/**
 * Tests for MCP server creation functionality
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

describe('MCP Server Creation', () => {
  describe('createSdkMcpServer', () => {
    it('should create a basic MCP server with name', () => {
      const server = createSdkMcpServer({
        name: 'test-server',
      });

      expect(server).toBeDefined();
      expect(server.type).toBe('sdk');
      expect(server.name).toBe('test-server');
      expect(server.instance).toBeDefined();
    });

    it('should create a server with version', () => {
      const server = createSdkMcpServer({
        name: 'test-server',
        version: '1.0.0',
      });

      expect(server).toBeDefined();
      expect(server.type).toBe('sdk');
      expect(server.name).toBe('test-server');
    });

    it('should create a server with tools', () => {
      const greetTool = tool(
        'greet',
        'Greet a user by name',
        { name: z.string().describe('Name to greet') },
        async (args) => ({
          content: [{ type: 'text', text: `Hello, ${args.name}!` }],
        })
      );

      const server = createSdkMcpServer({
        name: 'greeting-server',
        tools: [greetTool],
      });

      expect(server).toBeDefined();
      expect(server.type).toBe('sdk');
      expect(server.name).toBe('greeting-server');
    });
  });

  describe('tool helper', () => {
    it('should create a tool definition with required properties', () => {
      const testTool = tool(
        'test-tool',
        'A test tool',
        { input: z.string() },
        async (args) => ({
          content: [{ type: 'text', text: `Input: ${args.input}` }],
        })
      );

      expect(testTool).toBeDefined();
      expect(testTool.name).toBe('test-tool');
      expect(testTool.description).toBe('A test tool');
      expect(testTool.inputSchema).toBeDefined();
      expect(testTool.handler).toBeDefined();
      expect(typeof testTool.handler).toBe('function');
    });

    it('should create a tool with complex schema', () => {
      const complexTool = tool(
        'complex-tool',
        'A tool with complex input',
        {
          required_field: z.string(),
          optional_field: z.number().optional(),
          enum_field: z.enum(['a', 'b', 'c']),
          array_field: z.array(z.string()),
        },
        async (args) => ({
          content: [{ type: 'text', text: JSON.stringify(args) }],
        })
      );

      expect(complexTool).toBeDefined();
      expect(complexTool.name).toBe('complex-tool');
      expect(complexTool.inputSchema).toBeDefined();
    });

    it('should create a tool that can be invoked', async () => {
      const addTool = tool(
        'add',
        'Add two numbers',
        {
          a: z.number(),
          b: z.number(),
        },
        async (args) => ({
          content: [{ type: 'text', text: String(args.a + args.b) }],
        })
      );

      const result = await addTool.handler({ a: 2, b: 3 }, {});
      expect(result.content).toBeDefined();
      expect(result.content[0]).toEqual({ type: 'text', text: '5' });
    });

    it('should handle async tool handlers', async () => {
      const asyncTool = tool(
        'async-tool',
        'An async tool',
        { delay: z.number() },
        async (args) => {
          await new Promise((resolve) => setTimeout(resolve, args.delay));
          return {
            content: [{ type: 'text', text: `Waited ${args.delay}ms` }],
          };
        }
      );

      const start = Date.now();
      const result = await asyncTool.handler({ delay: 50 }, {});
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Waited 50ms' });
    });

    it('should handle tool errors', async () => {
      const errorTool = tool(
        'error-tool',
        'A tool that throws',
        { shouldError: z.boolean() },
        async (args) => {
          if (args.shouldError) {
            throw new Error('Tool error');
          }
          return { content: [{ type: 'text', text: 'Success' }] };
        }
      );

      await expect(errorTool.handler({ shouldError: true }, {})).rejects.toThrow(
        'Tool error'
      );

      const successResult = await errorTool.handler({ shouldError: false }, {});
      expect(successResult.content[0]).toEqual({ type: 'text', text: 'Success' });
    });
  });

  describe('Multiple tools in server', () => {
    it('should create a server with multiple tools', () => {
      const tool1 = tool(
        'tool1',
        'First tool',
        { input: z.string() },
        async () => ({ content: [{ type: 'text', text: 'tool1' }] })
      );

      const tool2 = tool(
        'tool2',
        'Second tool',
        { input: z.number() },
        async () => ({ content: [{ type: 'text', text: 'tool2' }] })
      );

      const tool3 = tool(
        'tool3',
        'Third tool',
        { input: z.boolean() },
        async () => ({ content: [{ type: 'text', text: 'tool3' }] })
      );

      const server = createSdkMcpServer({
        name: 'multi-tool-server',
        version: '1.0.0',
        tools: [tool1, tool2, tool3],
      });

      expect(server).toBeDefined();
      expect(server.type).toBe('sdk');
      expect(server.name).toBe('multi-tool-server');
    });
  });
});
