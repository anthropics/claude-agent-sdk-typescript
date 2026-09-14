import { describe, expect, test } from 'bun:test'
import type { Redis } from 'ioredis'
import { RedisSessionStore } from '../src/RedisSessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

/**
 * Minimal in-process ioredis mock backing the subset of commands the adapter
 * uses: rpush/lrange, sadd/srem/smembers, zadd/zrange/zrem, del, eval.
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
    async eval(
      script: string,
      numberOfKeys: number,
      ...rawArgs: Array<string | number>
    ) {
      const keys = rawArgs.slice(0, numberOfKeys).map(String)
      const args = rawArgs.slice(numberOfKeys)
      if (script.includes('-- append')) {
        const [entryKey, indexKey] = keys as [string, string]
        const indexType = String(args[0])
        const indexArgCount = indexType === 'set' ? 2 : 3
        const length = await api.rpush(
          entryKey,
          ...args.slice(indexArgCount).map(String),
        )
        if (indexType === 'set') {
          await api.sadd(indexKey, String(args[1]))
        } else {
          await api.zadd(indexKey, Number(args[1]), String(args[2]))
        }
        return length
      }
      if (script.includes('-- delete-subpath')) {
        await api.del(keys[0]!)
        await api.srem(keys[1]!, String(args[0]))
        return 1
      }
      const [entryKey, subkeysKey, sessionsKey] = keys as [
        string,
        string,
        string,
      ]
      const subpaths = await api.smembers(subkeysKey)
      await api.del(
        entryKey,
        subkeysKey,
        ...subpaths.map(subpath => `${entryKey}:${subpath}`),
      )
      await api.zrem(sessionsKey, String(args[0]))
      return 1
    },
    async keys(pattern: string) {
      const all = new Set([...lists.keys(), ...sets.keys(), ...zsets.keys()])
      if (pattern === '*') return [...all]
      const re = new RegExp(
        '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      )
      return [...all].filter(k => re.test(k))
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
