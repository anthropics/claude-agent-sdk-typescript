import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Agent } from '@clickhouse/loom'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createLoomMemoryServer, loomMemoryOptions } from '../src/memory.js'

const mentorSetting = process.env.LOOM_MENTOR_BRIEF
before(() => { process.env.LOOM_MENTOR_BRIEF = 'off' })
after(() => {
  if (mentorSetting === undefined) delete process.env.LOOM_MENTOR_BRIEF
  else process.env.LOOM_MENTOR_BRIEF = mentorSetting
})

function storage(reply: Record<string, unknown>, status = 200) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  const agent = new Agent('example-org', 'example-memory', 'example-agent', {
    baseUrl: 'https://loom.example',
    apiKey: 'example-token',
    logLevel: 'off',
    retry: { maxAttempts: 1 },
    fetch: async (url, init) => {
      const path = new URL(url).pathname
      assert.ok(['/v1/memory.set', '/v1/memory.search'].includes(path))
      requests.push({ path, body: JSON.parse(String(init.body)) as Record<string, unknown> })
      return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } })
    },
  })
  return { agent, requests }
}

async function connected<T>(agent: Agent, run: (client: Client) => Promise<T>): Promise<T> {
  const server = createLoomMemoryServer(agent, 'example-user')
  const client = new Client({ name: 'example-offline-check', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  try {
    await Promise.all([server.instance.connect(serverTransport), client.connect(clientTransport)])
    return await run(client)
  } finally {
    await client.close()
    await server.instance.close()
  }
}

function text(result: unknown): string {
  assert.ok(result !== null && typeof result === 'object' && 'content' in result)
  const content = result.content
  assert.ok(Array.isArray(content))
  assert.equal(content.length, 1)
  assert.equal(content[0].type, 'text')
  assert.equal(typeof content[0].text, 'string')
  return content[0].text as string
}

function fixedScope(body: Record<string, unknown>, read = false) {
  assert.equal(body.org, 'example-org')
  assert.equal(body.namespace, 'example-memory')
  assert.equal(body.agent, read ? '*' : 'example-agent')
  assert.equal(body.user_id, 'example-user')
  assert.equal(body.session_id, '-')
}

test('native MCP exposes only the two scoped tools and explicit configuration', async () => {
  const { agent, requests } = storage({})
  const options = loomMemoryOptions(agent, 'example-user')
  assert.deepEqual(options.tools, [])
  assert.deepEqual(options.settingSources, [])
  assert.equal(options.strictMcpConfig, true)
  assert.deepEqual(options.allowedTools, ['mcp__loom__remember', 'mcp__loom__recall'])
  // Close the unused configuration instance before creating the connected one.
  await (options.mcpServers?.loom as ReturnType<typeof createLoomMemoryServer>).instance.close()
  await connected(agent, async (client) => {
    const listed = await client.listTools()
    assert.deepEqual(listed.tools.map((t) => t.name).sort(), ['recall', 'remember'])
    const remember = listed.tools.find((t) => t.name === 'remember')
    assert.ok(remember)
    assert.deepEqual(Object.keys(remember.inputSchema.properties ?? {}).sort(), ['memory_key', 'value'])
    const recall = listed.tools.find((t) => t.name === 'recall')
    assert.ok(recall)
    assert.deepEqual(Object.keys(recall.inputSchema.properties ?? {}).sort(), ['query', 'top_k'])
  })
  assert.equal(requests.length, 0)
})

test('real Loom execution retains noop receipts and application scope', async () => {
  const { agent, requests } = storage({ memory_id: 'example-memory', version: 1, noop: true })
  await connected(agent, async (client) => {
    const result = await client.callTool({
      name: 'remember',
      arguments: { memory_key: 'style', value: 'The user prefers concise answers.' },
    })
    assert.notEqual(result.isError, true)
    const receipt = JSON.parse(text(result)) as Record<string, unknown>
    assert.equal(receipt.noop, true)
    assert.equal(receipt.stored, false)
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.path, '/v1/memory.set')
  fixedScope(requests[0]!.body)
  assert.equal(requests[0]!.body.memory_key, 'style')
  assert.equal(requests[0]!.body.value, 'The user prefers concise answers.')
})

test('real recall preserves abstention and pending extraction', async () => {
  const { agent, requests } = storage({ abstain: true, pending_extraction: true, results: [] })
  await connected(agent, async (client) => {
    const result = await client.callTool({ name: 'recall', arguments: { query: 'answer style', top_k: 2 } })
    assert.notEqual(result.isError, true)
    const response = JSON.parse(text(result)) as Record<string, unknown>
    assert.equal(response.abstain, true)
    assert.equal(response.pending_extraction, true)
    assert.deepEqual(response.memories, [])
  })
  assert.equal(requests.length, 1)
  fixedScope(requests[0]!.body, true)
  assert.equal(requests[0]!.body.top_k, 2)
})

test('real recall preserves provenance and unverified state', async () => {
  const { agent } = storage({
    abstain: false,
    retrieval_confidence: 0.8,
    results: [{
      memory_key: 'style', content_excerpt: 'The user prefers concise answers.',
      similarity: 0.9, source_class: 'external', verified: false,
    }],
  })
  await connected(agent, async (client) => {
    const result = await client.callTool({ name: 'recall', arguments: { query: 'answer style' } })
    assert.notEqual(result.isError, true)
    const response = JSON.parse(text(result))
    assert.equal(response.retrieval_confidence, 0.8)
    assert.equal(response.memories[0].source_class, 'external')
    assert.equal(response.memories[0].verified, false)
    assert.equal(response.memories[0].content, 'The user prefers concise answers.')
  })
})

test('HTTP refusal becomes a native MCP error rather than a successful write receipt', async () => {
  const { agent, requests } = storage({ detail: { code: 'FORBIDDEN' } }, 403)
  await connected(agent, async (client) => {
    const result = await client.callTool({ name: 'remember', arguments: { memory_key: 'style', value: 'A fact' } })
    assert.equal(result.isError, true)
    assert.ok(!text(result).includes('"stored":true'))
  })
  assert.equal(requests.length, 1)
  fixedScope(requests[0]!.body)
})

test('native schemas reject invalid inputs before Loom HTTP dispatch', async () => {
  const { agent, requests } = storage({})
  await connected(agent, async (client) => {
    for (const [name, args] of [
      ['remember', { memory_key: '', value: 'A fact' }],
      ['remember', { memory_key: 'style', value: 'x'.repeat(4001) }],
      ['recall', { query: 'answer style', top_k: 6 }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args })
      assert.equal(result.isError, true)
    }
  })
  assert.equal(requests.length, 0)
})

test('anonymous and wildcard application scope refuses before tools are created', () => {
  for (const value of ['', '*', '-', ' padded ']) {
    assert.throws(() => createLoomMemoryServer(storage({}).agent, value), /named scope/)
    const agent = new Agent('example-org', value, 'example-agent', {
      baseUrl: 'https://loom.example', apiKey: 'example-token',
    })
    assert.throws(() => createLoomMemoryServer(agent, 'example-user'), /named scope/)
  }
})
