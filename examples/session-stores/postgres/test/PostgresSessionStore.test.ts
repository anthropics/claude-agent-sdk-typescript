import { describe, expect, test } from 'bun:test'
import type { Pool } from 'pg'
import { PostgresSessionStore } from '../src/PostgresSessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

/**
 * In-process mock Pool implementing the SQL subset PostgresSessionStore uses.
 * Enables running the 13-test conformance suite and adapter checks without a live DB.
 */
function makeMockPool(onQuery?: (sql: string, params?: unknown[]) => void): Pool {
  interface Row {
    id: number
    project_key: string
    session_id: string
    subpath: string | null
    entry: Record<string, unknown>
    created_at: Date
  }
  const tables = new Map<string, Row[]>()
  let autoId = 0

  function getTable(table: string): Row[] {
    let t = tables.get(table)
    if (!t) {
      t = []
      tables.set(table, t)
    }
    return t
  }

  const pool = {
    async query(sql: string, params: unknown[] = []) {
      onQuery?.(sql, params)
      const clean = sql.replace(/\s+/g, ' ').trim()

      if (/^CREATE TABLE/i.test(clean) || /^CREATE INDEX/i.test(clean)) {
        return { rows: [] }
      }

      const insertMatch = clean.match(
        /^INSERT INTO\s+([A-Za-z0-9_.]+)\s+\(project_key,\s*session_id,\s*subpath,\s*entry\)\s+VALUES\s+(.+)$/i,
      )
      if (insertMatch) {
        const table = insertMatch[1]
        const rows = getTable(table)
        const pKey = params[0] as string
        const sId = params[1] as string
        const sp = (params[2] as string | null) ?? null
        for (let i = 3; i < params.length; i++) {
          rows.push({
            id: ++autoId,
            project_key: pKey,
            session_id: sId,
            subpath: sp,
            entry: JSON.parse(params[i] as string),
            created_at: new Date(),
          })
        }
        return { rows: [] }
      }

      const selectMatch = clean.match(
        /^SELECT entry FROM\s+([A-Za-z0-9_.]+)\s+WHERE project_key = \$1 AND session_id = \$2 AND subpath IS NOT DISTINCT FROM \$3\s+ORDER BY id/i,
      )
      if (selectMatch) {
        const table = selectMatch[1]
        const rows = getTable(table)
        const pKey = params[0] as string
        const sId = params[1] as string
        const sp = (params[2] as string | null) ?? null
        const matched = rows
          .filter(
            r =>
              r.project_key === pKey &&
              r.session_id === sId &&
              r.subpath === sp,
          )
          .sort((a, b) => a.id - b.id)
        return { rows: matched.map(r => ({ entry: r.entry })) }
      }

      const listSessionsMatch = clean.match(
        /^SELECT session_id,\s*MAX\(created_at\) AS mtime FROM\s+([A-Za-z0-9_.]+)\s+WHERE project_key = \$1 AND subpath IS NULL\s+GROUP BY session_id\s+ORDER BY mtime DESC/i,
      )
      if (listSessionsMatch) {
        const table = listSessionsMatch[1]
        const rows = getTable(table)
        const pKey = params[0] as string
        const group = new Map<string, Date>()
        for (const r of rows) {
          if (r.project_key === pKey && r.subpath === null) {
            const prev = group.get(r.session_id)
            if (!prev || r.created_at.getTime() > prev.getTime()) {
              group.set(r.session_id, r.created_at)
            }
          }
        }
        const out = Array.from(group, ([session_id, mtime]) => ({
          session_id,
          mtime,
        }))
        out.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        return { rows: out }
      }

      const deleteCascadeMatch = clean.match(
        /^DELETE FROM\s+([A-Za-z0-9_.]+)\s+WHERE project_key = \$1 AND session_id = \$2$/i,
      )
      if (deleteCascadeMatch) {
        const table = deleteCascadeMatch[1]
        const rows = getTable(table)
        const pKey = params[0] as string
        const sId = params[1] as string
        const remaining = rows.filter(
          r => !(r.project_key === pKey && r.session_id === sId),
        )
        tables.set(table, remaining)
        return { rows: [] }
      }

      const deleteSubpathMatch = clean.match(
        /^DELETE FROM\s+([A-Za-z0-9_.]+)\s+WHERE project_key = \$1 AND session_id = \$2 AND subpath = \$3$/i,
      )
      if (deleteSubpathMatch) {
        const table = deleteSubpathMatch[1]
        const rows = getTable(table)
        const pKey = params[0] as string
        const sId = params[1] as string
        const sp = params[2] as string
        const remaining = rows.filter(
          r =>
            !(
              r.project_key === pKey &&
              r.session_id === sId &&
              r.subpath === sp
            ),
        )
        tables.set(table, remaining)
        return { rows: [] }
      }

      const listSubkeysMatch = clean.match(
        /^SELECT DISTINCT subpath FROM\s+([A-Za-z0-9_.]+)\s+WHERE project_key = \$1 AND session_id = \$2 AND subpath IS NOT NULL/i,
      )
      if (listSubkeysMatch) {
        const table = listSubkeysMatch[1]
        const rows = getTable(table)
        const pKey = params[0] as string
        const sId = params[1] as string
        const subs = new Set<string>()
        for (const r of rows) {
          if (
            r.project_key === pKey &&
            r.session_id === sId &&
            r.subpath !== null
          ) {
            subs.add(r.subpath)
          }
        }
        return { rows: Array.from(subs, subpath => ({ subpath })) }
      }

      throw new Error(`Unhandled mock query: ${sql}`)
    },
  }
  return pool as unknown as Pool
}

describe('PostgresSessionStore (mock conformance)', () => {
  let n = 0
  runSessionStoreConformance(
    () => new PostgresSessionStore({ pool: makeMockPool(), tableName: `t_${n++}` }),
  )
})

describe('PostgresSessionStore (adapter-specific)', () => {
  test('rejects invalid tableName', () => {
    expect(
      () =>
        new PostgresSessionStore({
          pool: {} as Pool,
          tableName: 'a; DROP TABLE x',
        }),
    ).toThrow(/invalid tableName/)
  })

  test('accepts valid identifier', () => {
    expect(
      () =>
        new PostgresSessionStore({
          pool: {} as Pool,
          tableName: 'my_sessions_v2',
        }),
    ).not.toThrow()
  })

  test('accepts schema-qualified tableName', () => {
    expect(
      () =>
        new PostgresSessionStore({
          pool: {} as Pool,
          tableName: 'claude.session_entries',
        }),
    ).not.toThrow()

    expect(
      () =>
        new PostgresSessionStore({
          pool: {} as Pool,
          tableName: 'public.claude_session_entries',
        }),
    ).not.toThrow()
  })

  test('ensureSchema sanitizes index name for schema-qualified table', async () => {
    const executedQueries: string[] = []
    const pool = makeMockPool((sql: string) => executedQueries.push(sql))
    const store = new PostgresSessionStore({
      pool,
      tableName: 'custom_schema.my_sessions',
    })
    await store.ensureSchema()

    const indexQuery = executedQueries.find(q => q.includes('CREATE INDEX'))
    expect(indexQuery).toBeDefined()
    expect(indexQuery).toContain('custom_schema_my_sessions_key_idx')
    expect(indexQuery).not.toContain('custom_schema.my_sessions_key_idx')
  })

  test('delete with null subpath cascades to all subkeys without silent failure', async () => {
    const executedQueries: Array<{ sql: string; params?: unknown[] }> = []
    const pool = makeMockPool((sql, params) => executedQueries.push({ sql, params }))
    const store = new PostgresSessionStore({ pool, tableName: 'entries' })

    const key = { projectKey: 'p', sessionId: 's' }
    await store.append(key, [{ type: 'main' }])
    await store.append({ ...key, subpath: 'subagents/a' }, [{ type: 'sub' }])

    // Explicitly pass null subpath (e.g. from JSON deserialization or typed null)
    await store.delete({ ...key, subpath: null as unknown as undefined })

    // Verify it executed cascading delete instead of "WHERE subpath = $3" with null
    const lastDelete = executedQueries[executedQueries.length - 1]
    expect(lastDelete.sql).toContain('DELETE FROM entries WHERE project_key = $1 AND session_id = $2')
    expect(lastDelete.params).toEqual(['p', 's'])
    expect(await store.load(key)).toBeNull()
    expect(await store.load({ ...key, subpath: 'subagents/a' })).toBeNull()
  })

  test('listSessions safely converts string and Date mtimes', async () => {
    const pool = {
      async query() {
        return {
          rows: [
            { session_id: 's1', mtime: '2026-10-15T12:00:00.000Z' },
            { session_id: 's2', mtime: new Date(1700000000000) },
          ],
        }
      },
    } as unknown as Pool

    const store = new PostgresSessionStore({ pool, tableName: 'entries' })
    const sessions = await store.listSessions('p')
    expect(sessions).toEqual([
      { sessionId: 's1', mtime: new Date('2026-10-15T12:00:00.000Z').getTime() },
      { sessionId: 's2', mtime: 1700000000000 },
    ])
  })
})
