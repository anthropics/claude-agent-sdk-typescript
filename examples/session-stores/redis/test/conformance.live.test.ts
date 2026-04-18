/**
 * Live conformance suite against a real Redis server.
 * Skips automatically unless SESSION_STORE_REDIS_URL is set.
 *
 *   docker run -d -p 6379:6379 redis:7-alpine
 *   SESSION_STORE_REDIS_URL=redis://localhost:6379/0 bun test test/conformance.live.test.ts
 */
import { afterAll, describe } from 'bun:test'
import Redis from 'ioredis'
import { RedisSessionStore } from '../src/RedisSessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

const url = process.env.SESSION_STORE_REDIS_URL

describe.skipIf(!url)('RedisSessionStore (live conformance)', () => {
  const client = new Redis(url!, { lazyConnect: false })
  const root = `conformance-${Date.now().toString(36)}`
  let n = 0

  runSessionStoreConformance(
    () => new RedisSessionStore({ client, prefix: `${root}:${n++}` }),
  )

  afterAll(async () => {
    const keys = await client.keys(`${root}:*`)
    if (keys.length) await client.del(...keys)
    await client.quit()
  })
})
