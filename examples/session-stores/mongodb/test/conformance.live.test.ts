/**
 * Live conformance suite against a real MongoDB server.
 * Skips automatically unless SESSION_STORE_MONGODB_URL is set.
 *
 *   docker run -d -p 27017:27017 mongo:7
 *   SESSION_STORE_MONGODB_URL=mongodb://localhost:27017 \
 *     bun test test/conformance.live.test.ts
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { MongoClient } from 'mongodb'
import { MongoDBSessionStore } from '../src/MongoDBSessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

const url = process.env.SESSION_STORE_MONGODB_URL
const dbName = process.env.SESSION_STORE_MONGODB_DB ?? 'claude_test'

describe.skipIf(!url)('MongoDBSessionStore (live conformance)', () => {
  // Guard so the constructor does not run when the suite is skipped.
  const client = url ? new MongoClient(url) : (null as unknown as MongoClient)
  const created: string[] = []

  async function freshStore() {
    const collectionName = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    created.push(collectionName)
    const store = new MongoDBSessionStore({ client, dbName, collectionName })
    await store.ensureSchema()
    return store
  }

  runSessionStoreConformance(freshStore)

  test('ensureSchema is idempotent', async () => {
    const store = await freshStore()
    await store.ensureSchema()
    await store.append({ projectKey: 'p', sessionId: 's' }, [{ type: 'a' }])
    expect(await store.load({ projectKey: 'p', sessionId: 's' })).toEqual([
      { type: 'a' },
    ])
  })

  test('listSessions mtime is epoch ms', async () => {
    const store = await freshStore()
    const before = Date.now()
    await store.append({ projectKey: 'p', sessionId: 's' }, [{ type: 'a' }])
    const [s] = await store.listSessions('p')
    expect(Math.abs(s!.mtime - before)).toBeLessThan(5000)
  })

  afterAll(async () => {
    const db = client.db(dbName)
    for (const c of created) {
      await db.collection(c).drop().catch(() => undefined)
    }
    await client.close()
  })
})
