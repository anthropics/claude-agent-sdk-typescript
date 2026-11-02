import { describe, expect, test } from 'bun:test'
import type { S3Client } from '@aws-sdk/client-s3'
import { S3SessionStore } from '../src/S3SessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

/**
 * Minimal in-process S3Client mock backed by a Map<Key, Body>.
 * Honors Prefix and Delimiter:'/' for ListObjectsV2.
 */
function makeMockClient() {
  const objects = new Map<string, string>()
  const calls: Array<{ name: string; input: Record<string, unknown> }> = []

  const client = {
    async send(cmd: {
      constructor: { name: string }
      input: Record<string, unknown>
    }) {
      const name = cmd.constructor.name
      const input = cmd.input
      calls.push({ name, input })
      switch (name) {
        case 'PutObjectCommand': {
          objects.set(input.Key as string, input.Body as string)
          return {}
        }
        case 'GetObjectCommand': {
          const body = objects.get(input.Key as string)
          return { Body: { transformToString: async () => body } }
        }
        case 'ListObjectsV2Command': {
          const prefix = (input.Prefix as string) ?? ''
          const delimiter = input.Delimiter as string | undefined
          const matched = [...objects.keys()].filter(k => k.startsWith(prefix))
          const contents = matched
            .filter(
              k => !delimiter || !k.slice(prefix.length).includes(delimiter),
            )
            .map(Key => ({ Key }))
          return { Contents: contents }
        }
        case 'DeleteObjectsCommand': {
          for (const o of (input.Delete as { Objects: Array<{ Key: string }> })
            .Objects) {
            objects.delete(o.Key)
          }
          return {}
        }
        default:
          throw new Error(`unhandled ${name}`)
      }
    },
  } as unknown as S3Client
  return { client, objects, calls }
}

describe('S3SessionStore (mock conformance)', () => {
  let n = 0
  runSessionStoreConformance(() => {
    const { client } = makeMockClient()
    return new S3SessionStore({ bucket: 'b', prefix: `t${n++}`, client })
  })
})

describe('S3SessionStore (adapter-specific)', () => {
  const KEY = { projectKey: 'p', sessionId: 's' }

  test('append writes part-{epochMs13}-{rand6}.jsonl under prefix', async () => {
    const { client, objects } = makeMockClient()
    const store = new S3SessionStore({ bucket: 'b', prefix: 't', client })
    await store.append(KEY, [{ type: 'a' }])
    const [k] = [...objects.keys()]
    expect(k).toMatch(/^t\/p\/s\/part-\d{13}-\d{6}-[0-9a-f]{6}\.jsonl$/)
  })

  test('same-ms appends are lexically ordered (monotonic counter)', async () => {
    const { client, objects } = makeMockClient()
    const store = new S3SessionStore({ bucket: 'b', client })
    const original = Date.now
    Date.now = () => 1700000000000
    try {
      await store.append(KEY, [{ type: 'a' }])
      await store.append(KEY, [{ type: 'b' }])
      await store.append(KEY, [{ type: 'c' }])
    } finally {
      Date.now = original
    }
    const ks = [...objects.keys()].sort()
    expect(ks).toEqual([...objects.keys()])
    const loaded = await store.load(KEY)
    expect(loaded?.map(e => e.type)).toEqual(['a', 'b', 'c'])
  })

  test('a burst does not sort ahead of another writer on the same bucket', async () => {
    // Two instances mirroring one session is the reason to use a shared
    // backend. Advancing the timestamp to separate a burst hands the borrowed
    // milliseconds to whoever writes next, and their part lands inside the
    // burst.
    const { client, objects } = makeMockClient()
    const a = new S3SessionStore({ bucket: 'b', client })
    const b = new S3SessionStore({ bucket: 'b', client })
    const original = Date.now
    let clock = 1700000000000
    Date.now = () => clock
    try {
      for (const type of ['a1', 'a2', 'a3', 'a4', 'a5']) {
        await a.append(KEY, [{ type }])
      }
      clock += 1
      await b.append(KEY, [{ type: 'b1' }])
      clock += 1
      await a.append(KEY, [{ type: 'a6' }])
    } finally {
      Date.now = original
    }
    expect([...objects.keys()].sort()).toEqual([...objects.keys()])
    const loaded = await a.load(KEY)
    expect(loaded?.map(e => e.type)).toEqual([
      'a1',
      'a2',
      'a3',
      'a4',
      'a5',
      'b1',
      'a6',
    ])
  })

  test('a clock that steps backwards keeps an instance in write order', async () => {
    const { client } = makeMockClient()
    const store = new S3SessionStore({ bucket: 'b', client })
    const original = Date.now
    let clock = 1700000000000
    Date.now = () => clock
    try {
      await store.append(KEY, [{ type: 'a' }])
      clock -= 5
      await store.append(KEY, [{ type: 'b' }])
      await store.append(KEY, [{ type: 'c' }])
    } finally {
      Date.now = original
    }
    const loaded = await store.load(KEY)
    expect(loaded?.map(e => e.type)).toEqual(['a', 'b', 'c'])
  })

  test('listSessions reads the mtime of a part written before the sequence field', async () => {
    const { client, objects } = makeMockClient()
    objects.set('p/s/part-1700000000000-abcdef.jsonl', '{"type":"a"}\n')
    const store = new S3SessionStore({ bucket: 'b', client })
    expect(await store.listSessions('p')).toEqual([
      { sessionId: 's', mtime: 1700000000000 },
    ])
  })

  test('append([]) issues no PutObject', async () => {
    const { client, calls } = makeMockClient()
    const store = new S3SessionStore({ bucket: 'b', client })
    await store.append(KEY, [])
    expect(calls.filter(c => c.name === 'PutObjectCommand')).toHaveLength(0)
  })

  test('load skips malformed JSON lines', async () => {
    const { client, objects } = makeMockClient()
    objects.set('p/s/part-0000000000001-000000.jsonl', '{"type":"a"}\n{bad\n')
    const store = new S3SessionStore({ bucket: 'b', client })
    expect(await store.load(KEY)).toEqual([{ type: 'a' }])
  })

  test('listSubkeys filters traversal segments', async () => {
    const { client, objects } = makeMockClient()
    objects.set('p/s/subagents/a/part-0000000000001-000000.jsonl', '{}')
    objects.set('p/s/../evil/part-0000000000001-000000.jsonl', '{}')
    const store = new S3SessionStore({ bucket: 'b', client })
    expect(await store.listSubkeys(KEY)).toEqual(['subagents/a'])
  })

  test.each(['', 'p', 'p/', 'p///'])(
    'prefix %j normalizes without // artifacts',
    async raw => {
      const { client, objects } = makeMockClient()
      const store = new S3SessionStore({ bucket: 'b', prefix: raw, client })
      await store.append(KEY, [{ type: 'a' }])
      const [k] = [...objects.keys()]
      expect(k.includes('//')).toBe(false)
      expect(k.startsWith('/')).toBe(raw === '' ? false : false)
    },
  )
})
