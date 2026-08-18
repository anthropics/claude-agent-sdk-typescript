/**
 * Example: Synap memory integration.
 *
 * Demonstrates how to give a Claude Agent persistent, cross-session memory
 * using Synap (https://maximem.ai) — a managed memory layer for AI agents.
 *
 * Two plug points:
 *   1. createSynapHooks — UserPromptSubmit hook that fetches relevant Synap
 *      context for each prompt and injects it via additionalContext.
 *      Optionally records the user prompt for future recall.
 *   2. createSynapMcpServer — exposes synap_search and synap_remember
 *      as MCP tools the model can call explicitly.
 *
 * Prereqs:
 *   - ANTHROPIC_API_KEY set
 *   - SYNAP_API_KEY set (free key at https://synap.maximem.ai)
 *
 * Install:
 *   npm install @maximem/synap-claude-agent @anthropic-ai/claude-agent-sdk zod
 *
 * Run:
 *   bun run synap-memory.ts
 *
 * Open source: https://github.com/maximem-ai/maximem_synap_sdk
 */
import { query } from '@anthropic-ai/claude-agent-sdk'
import { MaximemSynapSDK } from '@maximem/synap-sdk'
import {
  createSynapHooks,
  createSynapMcpServer,
} from '@maximem/synap-claude-agent'

const synapKey = process.env.SYNAP_API_KEY
if (!synapKey) {
  console.error('Set SYNAP_API_KEY (free key at https://synap.maximem.ai)')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY')
  process.exit(1)
}

const sdk = new MaximemSynapSDK({ apiKey: synapKey })
await sdk.initialize()

const userId = 'demo-user-001'
const customerId = 'demo-customer'

// Pattern 1 — automatic context injection via hook
console.log('=== Hook-based context injection ===')
for await (const message of query({
  prompt: 'What did I tell you about my dietary preferences?',
  options: {
    hooks: createSynapHooks({ sdk, userId, customerId }),
  },
})) {
  console.log(message)
}

// Pattern 2 — explicit search / remember via MCP tools
console.log('\n=== MCP tool-based memory access ===')
for await (const message of query({
  prompt: 'Remember that I prefer concise answers, then search my memory.',
  options: {
    mcpServers: {
      synap: createSynapMcpServer({ sdk, userId, customerId }),
    },
    allowedTools: [
      'mcp__synap__synap_search',
      'mcp__synap__synap_remember',
    ],
  },
})) {
  console.log(message)
}
