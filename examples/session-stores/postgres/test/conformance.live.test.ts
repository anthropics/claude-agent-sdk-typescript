/**
 * Live conformance suite against a real Postgres server.
 * Skips automatically unless SESSION_STORE_POSTGRES_URL is set.
 *
 *   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
 *   SESSION_STORE_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres \
 *     bun test test/conformance.live.test.ts
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { Pool } from 'pg'
import { PostgresSessionStore } from '../src/PostgresSessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

const url = process.env.SESSION_STORE_POSTGRES_URL

describe.skipIf(!url)('PostgresSessionStore (live conformance)', () => {
  const pool = new Pool({ connectionString: url })
  const created: string[] = []

  async function freshStore() {
    const table = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    created.push(table)
    const store = new PostgresSessionStore({ pool, tableName: table })
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
    for (const t of created) {
      await pool.query(`DROP TABLE IF EXISTS ${t}`)
    }
    await pool.end()
  })
})
