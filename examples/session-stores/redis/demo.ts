/**
 * End-to-end demo: run a query with RedisSessionStore, then resume it.
 *
 * Prereqs:
 *   - ANTHROPIC_API_KEY set
 *   - Redis reachable. For local testing:
 *       docker run -d -p 6379:6379 redis:7-alpine
 *
 * Run:
 *   SESSION_STORE_REDIS_URL=redis://localhost:6379/0 bun run demo.ts
 */
import Redis from 'ioredis'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { RedisSessionStore } from './src/RedisSessionStore.ts'

const url = process.env.SESSION_STORE_REDIS_URL ?? 'redis://localhost:6379/0'
const client = new Redis(url)
const store = new RedisSessionStore({ client, prefix: 'demo' })

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
console.log('session', sid, 'mirrored to redis under prefix demo:')

await run('What single word did you just reply with?', sid)
await client.quit()
