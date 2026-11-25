import { query } from '@anthropic-ai/claude-agent-sdk'
import { Agent } from '@clickhouse/loom'
import { parseArgs } from 'node:util'
import { loomMemoryOptions } from './src/memory.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name}`)
  return value
}

async function main() {
  const { values } = parseArgs({ options: { live: { type: 'boolean' }, prompt: { type: 'string' } } })
  if (!values.live || !values.prompt) {
    throw new Error('Pass --live --prompt TEXT to allow Claude and Loom calls; model costs can apply')
  }
  const agent = new Agent(required('LOOM_ORG'), required('LOOM_NAMESPACE'), 'claude-memory-example', {
    baseUrl: required('LOOM_BASE_URL'),
    apiKey: required('LOOM_API_KEY'),
  })
  const conversation = query({
    prompt: values.prompt,
    options: loomMemoryOptions(agent, required('LOOM_USER_ID')),
  })
  try {
    for await (const message of conversation) console.log(message)
  } finally {
    conversation.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Example failed')
  process.exitCode = 1
})
