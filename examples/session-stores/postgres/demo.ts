/**
 * End-to-end demo: run a query with PostgresSessionStore, then resume it.
 *
 * Prereqs:
 *   - ANTHROPIC_API_KEY set
 *   - Postgres reachable. For local testing:
 *       docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
 *
 * Run:
 *   SESSION_STORE_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres \
 *     bun run demo.ts
 */
import { Pool } from 'pg'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { PostgresSessionStore } from './src/PostgresSessionStore.ts'

const url = process.env.SESSION_STORE_POSTGRES_URL
if (!url) {
  console.error('Set SESSION_STORE_POSTGRES_URL (see header)')
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const store = new PostgresSessionStore({ pool })
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
console.log('session', sid, 'mirrored to table claude_session_entries')

await run('What single word did you just reply with?', sid)
await pool.end()
