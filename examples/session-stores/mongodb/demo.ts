/**
 * End-to-end demo: run a query with MongoDBSessionStore, then resume it.
 *
 * Prereqs:
 *   - ANTHROPIC_API_KEY set
 *   - MongoDB reachable. For local testing:
 *       docker run -d -p 27017:27017 mongo:7
 *
 * Run:
 *   SESSION_STORE_MONGODB_URL=mongodb://localhost:27017 \
 *     bun run demo.ts
 */
import { MongoClient } from 'mongodb'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { MongoDBSessionStore } from './src/MongoDBSessionStore.ts'

const url = process.env.SESSION_STORE_MONGODB_URL
if (!url) {
  console.error('Set SESSION_STORE_MONGODB_URL (see header)')
  process.exit(1)
}

const dbName = process.env.SESSION_STORE_MONGODB_DB ?? 'claude_test'
const client = new MongoClient(url)
await client.connect()
const store = new MongoDBSessionStore({ client, dbName })
await store.ensureSchema()

async function run(prompt: string, resume?: string) {
  let sessionId: string | undefined
  for await (const m of query({
    prompt,
    options: { sessionStore: store, resume, maxTurns: 1 },
  })) {
    if (m.type === 'system' && m.subtype === 'init') sessionId = m.session_id
    if (m.type === 'result') {
      console.log(`[${m.subtype}]`, 'result' in m ? m.result : '')
    }
  }
  return sessionId
}

const sid = await run('Reply with exactly the word: pineapple')
console.log('session', sid, `mirrored to ${dbName}.claude_session_entries`)

await run('What single word did you just reply with?', sid)
await client.close()
