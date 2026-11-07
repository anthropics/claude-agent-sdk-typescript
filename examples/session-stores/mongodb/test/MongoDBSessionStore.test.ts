import { describe, expect, test } from 'bun:test'
import type { MongoClient } from 'mongodb'
import { MongoDBSessionStore } from '../src/MongoDBSessionStore.ts'

describe('MongoDBSessionStore (adapter-specific, no DB)', () => {
  test('rejects invalid collectionName', () => {
    expect(
      () =>
        new MongoDBSessionStore({
          client: {} as MongoClient,
          collectionName: 'a; drop',
        }),
    ).toThrow(/invalid collectionName/)
  })

  test('accepts valid identifier', () => {
    expect(
      () =>
        new MongoDBSessionStore({
          client: {} as MongoClient,
          collectionName: 'my_sessions_v2',
        }),
    ).not.toThrow()
  })
})
