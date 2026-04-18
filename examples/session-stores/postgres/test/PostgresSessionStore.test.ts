import { describe, expect, test } from 'bun:test'
import type { Pool } from 'pg'
import { PostgresSessionStore } from '../src/PostgresSessionStore.ts'

describe('PostgresSessionStore (adapter-specific, no DB)', () => {
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
})
