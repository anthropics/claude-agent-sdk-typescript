/**
 * SessionStore behavioral conformance suite.
 *
 * Any adapter that passes these 13 checks satisfies the contract the SDK
 * relies on for transcript mirroring and resume. The suite is vendored here
 * (rather than imported from the SDK) so the example adapters can be tested
 * standalone without depending on unpublished SDK internals.
 *
 * Usage with bun:test:
 *
 *   import { describe } from 'bun:test'
 *   import { runSessionStoreConformance } from '../../shared/conformance.ts'
 *
 *   describe('MyStore', () => {
 *     runSessionStoreConformance(async () => new MyStore(...))
 *   })
 */
import { test, expect } from 'bun:test'

// Structural copies of the SDK's SessionStore types so this file has zero
// install-time dependencies. The adapters under test import the real types
// from `@anthropic-ai/claude-agent-sdk`; structural typing makes them
// assignable here.
type SessionKey = { projectKey: string; sessionId: string; subpath?: string }
type SessionStoreEntry = { type: string; [k: string]: unknown }
type SessionStore = {
  append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void>
  load(key: SessionKey): Promise<SessionStoreEntry[] | null>
  listSessions?(
    projectKey: string,
  ): Promise<Array<{ sessionId: string; mtime: number }>>
  delete?(key: SessionKey): Promise<void>
  listSubkeys?(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]>
}

export type ConformanceFactory = () => Promise<SessionStore> | SessionStore

const KEY: SessionKey = { projectKey: 'proj', sessionId: 'sess' }

const E = (type: string, extra: Record<string, unknown> = {}) =>
  ({ type, ...extra }) as SessionStoreEntry

/** Sorted-key stringify so deep-equal ignores object-key order (JSONB-safe). */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : val,
  )
}

function expectEntries(actual: unknown, expected: SessionStoreEntry[]) {
  expect(canon(actual)).toBe(canon(expected))
}

/**
 * Registers 13 `bun:test` cases against the given factory. Call inside a
 * `describe()` block. The factory must return a fresh, isolated store on
 * every call (e.g. unique table name / key prefix).
 */
export function runSessionStoreConformance(makeStore: ConformanceFactory) {
  test('append then load returns same entries in same order', async () => {
    const store = await makeStore()
    const entries = [E('a', { n: 1, nested: { x: [1, 2] } }), E('b', { n: 2 })]
    await store.append(KEY, entries)
    expectEntries(await store.load(KEY), entries)
  })

  test('load unknown key returns null', async () => {
    const store = await makeStore()
    expect(await store.load(KEY)).toBeNull()
    expect(await store.load({ ...KEY, subpath: 'subagents/a' })).toBeNull()
  })

  test('multiple append calls preserve call order', async () => {
    const store = await makeStore()
    await store.append(KEY, [E('a')])
    await store.append(KEY, [E('b'), E('c')])
    await store.append(KEY, [E('d')])
    expectEntries(await store.load(KEY), [E('a'), E('b'), E('c'), E('d')])
  })

  test('append([]) is a no-op', async () => {
    const store = await makeStore()
    await store.append(KEY, [])
    expect(await store.load(KEY)).toBeNull()
    await store.append(KEY, [E('a')])
    await store.append(KEY, [])
    expectEntries(await store.load(KEY), [E('a')])
  })

  test('subpath keys are stored independently of main', async () => {
    const store = await makeStore()
    await store.append(KEY, [E('main')])
    await store.append({ ...KEY, subpath: 'subagents/x' }, [E('sub')])
    expectEntries(await store.load(KEY), [E('main')])
    expectEntries(await store.load({ ...KEY, subpath: 'subagents/x' }), [
      E('sub'),
    ])
  })

  test('projectKey isolation', async () => {
    const store = await makeStore()
    const A = { projectKey: 'A', sessionId: 's' }
    const B = { projectKey: 'B', sessionId: 's' }
    await store.append(A, [E('a')])
    await store.append(B, [E('b')])
    expectEntries(await store.load(A), [E('a')])
    expectEntries(await store.load(B), [E('b')])
  })

  test('listSessions returns sessionIds for project', async () => {
    const store = await makeStore()
    if (!store.listSessions) return
    await store.append({ projectKey: 'P', sessionId: 's1' }, [E('a')])
    await store.append({ projectKey: 'P', sessionId: 's2' }, [E('b')])
    await store.append({ projectKey: 'Q', sessionId: 's3' }, [E('c')])
    const ids = (await store.listSessions('P')).map(s => s.sessionId).sort()
    expect(ids).toEqual(['s1', 's2'])
    const r = await store.listSessions('P')
    expect(r.every(s => s.mtime > 1e12)).toBe(true)
    expect(await store.listSessions('never-seen')).toEqual([])
  })

  test('listSessions excludes subagent subpaths', async () => {
    const store = await makeStore()
    if (!store.listSessions) return
    await store.append(
      { projectKey: 'P', sessionId: 's1', subpath: 'subagents/x' },
      [E('sub')],
    )
    const ids = (await store.listSessions('P')).map(s => s.sessionId)
    expect(ids).not.toContain('s1')
  })

  test('delete main then load returns null', async () => {
    const store = await makeStore()
    if (!store.delete) return
    await store.append(KEY, [E('a')])
    await store.delete(KEY)
    expect(await store.load(KEY)).toBeNull()
    await store.delete({ projectKey: 'x', sessionId: 'never' })
  })

  test('delete main cascades to subkeys', async () => {
    const store = await makeStore()
    if (!store.delete) return
    await store.append(KEY, [E('main')])
    await store.append({ ...KEY, subpath: 'subagents/a' }, [E('sa')])
    await store.append({ ...KEY, subpath: 'subagents/b' }, [E('sb')])
    await store.append({ projectKey: 'proj', sessionId: 'other' }, [E('o')])
    await store.append({ projectKey: 'proj2', sessionId: 'sess' }, [E('p2')])
    await store.delete(KEY)
    expect(await store.load(KEY)).toBeNull()
    expect(await store.load({ ...KEY, subpath: 'subagents/a' })).toBeNull()
    expect(await store.load({ ...KEY, subpath: 'subagents/b' })).toBeNull()
    expectEntries(
      await store.load({ projectKey: 'proj', sessionId: 'other' }),
      [E('o')],
    )
    expectEntries(
      await store.load({ projectKey: 'proj2', sessionId: 'sess' }),
      [E('p2')],
    )
    if (store.listSubkeys) {
      expect(await store.listSubkeys(KEY)).toEqual([])
    }
  })

  test('delete with subpath removes only that subkey', async () => {
    const store = await makeStore()
    if (!store.delete) return
    await store.append(KEY, [E('main')])
    await store.append({ ...KEY, subpath: 'subagents/a' }, [E('sa')])
    await store.append({ ...KEY, subpath: 'subagents/b' }, [E('sb')])
    await store.delete({ ...KEY, subpath: 'subagents/a' })
    expectEntries(await store.load(KEY), [E('main')])
    expect(await store.load({ ...KEY, subpath: 'subagents/a' })).toBeNull()
    expectEntries(await store.load({ ...KEY, subpath: 'subagents/b' }), [
      E('sb'),
    ])
  })

  test('listSubkeys returns subpaths for the session', async () => {
    const store = await makeStore()
    if (!store.listSubkeys) return
    await store.append({ ...KEY, subpath: 'subagents/a' }, [E('sa')])
    await store.append({ ...KEY, subpath: 'subagents/b' }, [E('sb')])
    await store.append(
      { projectKey: 'proj', sessionId: 'other', subpath: 'subagents/c' },
      [E('sc')],
    )
    const subs = (await store.listSubkeys(KEY)).sort()
    expect(subs).toEqual(['subagents/a', 'subagents/b'])
  })

  test('listSubkeys excludes main transcript', async () => {
    const store = await makeStore()
    if (!store.listSubkeys) return
    await store.append(KEY, [E('main')])
    expect(await store.listSubkeys(KEY)).toEqual([])
    expect(
      await store.listSubkeys({ projectKey: 'x', sessionId: 'never' }),
    ).toEqual([])
  })
}
