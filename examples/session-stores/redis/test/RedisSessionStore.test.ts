import { describe, expect, test } from 'bun:test'
import type { Redis } from 'ioredis'
import { RedisSessionStore } from '../src/RedisSessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

/**
 * Minimal in-process ioredis mock backing the subset of commands the adapter
 * uses: rpush/lrange, sadd/srem/smembers, zadd/zrange/zrem, del, multi.
 * `multi()` executes eagerly (no isolation needed for single-threaded tests).
 */
function makeMockRedis(): Redis {
  const lists = new Map<string, string[]>()
  const sets = new Map<string, Set<string>>()
  const zsets = new Map<string, Map<string, number>>()

  const api = {
    async rpush(key: string, ...values: string[]) {
      const l = lists.get(key) ?? []
      l.push(...values)
      lists.set(key, l)
      return l.length
    },
    async lrange(key: string, start: number, stop: number) {
      const l = lists.get(key) ?? []
      const end = stop === -1 ? l.length : stop + 1
      return l.slice(start, end)
    },
    async sadd(key: string, ...members: string[]) {
      const s = sets.get(key) ?? new Set<string>()
      let added = 0
      for (const m of members) if (!s.has(m)) (s.add(m), added++)
      sets.set(key, s)
      return added
    },
    async srem(key: string, ...members: string[]) {
      const s = sets.get(key)
      if (!s) return 0
      let removed = 0
      for (const m of members) if (s.delete(m)) removed++
      return removed
    },
    async smembers(key: string) {
      return [...(sets.get(key) ?? [])]
    },
    async zadd(key: string, score: number, member: string) {
      const z = zsets.get(key) ?? new Map<string, number>()
      z.set(member, score)
      zsets.set(key, z)
      return 1
    },
    async zrange(
      key: string,
      start: number,
      stop: number,
      withScores?: 'WITHSCORES',
    ) {
      const z = zsets.get(key)
      if (!z) return []
      const sorted = [...z.entries()].sort((a, b) => a[1] - b[1])
      const end = stop === -1 ? sorted.length : stop + 1
      const slice = sorted.slice(start, end)
      return withScores
        ? slice.flatMap(([m, s]) => [m, String(s)])
        : slice.map(([m]) => m)
    },
    async zrem(key: string, ...members: string[]) {
      const z = zsets.get(key)
      if (!z) return 0
      let removed = 0
      for (const m of members) if (z.delete(m)) removed++
      return removed
    },
    async del(...keys: string[]) {
      let n = 0
      for (const k of keys) {
        if (lists.delete(k)) n++
        if (sets.delete(k)) n++
        if (zsets.delete(k)) n++
      }
      return n
    },
    async keys(pattern: string) {
      const all = new Set([...lists.keys(), ...sets.keys(), ...zsets.keys()])
      if (pattern === '*') return [...all]
      const re = new RegExp(
        '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      )
      return [...all].filter(k => re.test(k))
    },
    multi() {
      const queue: Array<() => Promise<unknown>> = []
      const chain: Record<string, unknown> = {
        async exec() {
          const out: Array<[null, unknown]> = []
          for (const fn of queue) out.push([null, await fn()])
          return out
        },
      }
      for (const cmd of [
        'rpush',
        'sadd',
        'srem',
        'zadd',
        'zrem',
        'del',
      ] as const) {
        chain[cmd] = (...args: unknown[]) => {
          queue.push(() =>
            (api[cmd] as (...a: unknown[]) => Promise<unknown>)(...args),
          )
          return chain
        }
      }
      return chain
    },
  }
  return api as unknown as Redis
}

describe('RedisSessionStore (mock conformance)', () => {
  let n = 0
  runSessionStoreConformance(
    () => new RedisSessionStore({ client: makeMockRedis(), prefix: `t${n++}` }),
  )
})

describe('RedisSessionStore (adapter-specific)', () => {
  const KEY = { projectKey: 'p', sessionId: 's' }

  test('subpath append does not bump session index', async () => {
    const client = makeMockRedis()
    const store = new RedisSessionStore({ client, prefix: 't' })
    await store.append({ ...KEY, subpath: 'subagents/a' }, [{ type: 'x' }])
    expect(await store.listSessions('p')).toEqual([])
    expect((await store.listSubkeys(KEY)).sort()).toEqual(['subagents/a'])
  })

  test('load skips malformed JSON', async () => {
    const client = makeMockRedis()
    await client.rpush('t:p:s', '{"type":"a"}', '{bad')
    const store = new RedisSessionStore({ client, prefix: 't' })
    expect(await store.load(KEY)).toEqual([{ type: 'a' }])
  })

  test.each(['', 'p', 'p:', 'p:::'])(
    'prefix %j normalizes without :: artifacts',
    async raw => {
      const client = makeMockRedis()
      const store = new RedisSessionStore({ client, prefix: raw })
      await store.append(KEY, [{ type: 'a' }])
      const keys = await client.keys('*')
      for (const k of keys) {
        expect(k.includes('::')).toBe(false)
        expect(k.startsWith(':')).toBe(false)
      }
    },
  )
})
