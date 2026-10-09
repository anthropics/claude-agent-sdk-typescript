/**
 * Live conformance suite against a real Redis server.
 * Skips automatically unless SESSION_STORE_REDIS_URL is set.
 *
 *   docker run -d -p 6379:6379 redis:7-alpine
 *   SESSION_STORE_REDIS_URL=redis://localhost:6379/0 bun test test/conformance.live.test.ts
 */
import { afterAll, describe, expect, test } from 'bun:test'
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

  async function createRestrictedClient(
    prefix: string,
    commands: string[],
  ): Promise<{ redis: Redis; username: string }> {
    const username = `${root.replace(/[^a-zA-Z0-9]/g, '')}${n++}`
    const password = 'review-password'
    await client.call(
      'ACL',
      'SETUSER',
      username,
      'reset',
      'on',
      `>${password}`,
      `~${prefix}:*`,
      '+eval',
      '+type',
      ...commands,
    )
    return {
      redis: client.duplicate({
        enableReadyCheck: false,
        lazyConnect: false,
        username,
        password,
      }),
      username,
    }
  }

  test('append rejects Redis transaction command errors', async () => {
    const prefix = `${root}:errors`
    const store = new RedisSessionStore({ client, prefix })
    await client.set(`${prefix}:p:s`, 'wrong-type')

    await expect(
      store.append(
        { projectKey: 'p', sessionId: 's' },
        [{ type: 'assistant' }],
      ),
    ).rejects.toThrow('WRONGTYPE')
    expect(await client.zscore(`${prefix}:p:__sessions`, 's')).toBeNull()
  })

  test('three SDK retries of an index failure do not duplicate entries', async () => {
    const prefix = `${root}:retry`
    const store = new RedisSessionStore({ client, prefix })
    await client.set(`${prefix}:p:__sessions`, 'wrong-type')

    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        store.append(
          { projectKey: 'p', sessionId: 's' },
          [{ type: 'assistant' }],
        ),
      ).rejects.toThrow('WRONGTYPE')
    }

    expect(await client.lrange(`${prefix}:p:s`, 0, -1)).toEqual([])
  })

  test('append supports batches larger than the Lua unpack limit', async () => {
    const prefix = `${root}:large`
    const store = new RedisSessionStore({ client, prefix })
    const entries = Array.from({ length: 10_000 }, (_, index) => ({
      type: 'assistant',
      index,
    }))

    await store.append({ projectKey: 'p', sessionId: 's' }, entries)

    const loaded = await store.load({ projectKey: 'p', sessionId: 's' })
    expect(loaded).toHaveLength(entries.length)
    expect(loaded?.[0]).toEqual(entries[0])
    expect(loaded?.at(-1)).toEqual(entries.at(-1))
  })

  test('main delete is atomic when the session index has the wrong type', async () => {
    const prefix = `${root}:delete-main`
    const store = new RedisSessionStore({ client, prefix })
    const key = { projectKey: 'p', sessionId: 's' }
    const entry = { type: 'assistant' }
    await store.append(key, [entry])
    await client.del(`${prefix}:p:__sessions`)
    await client.set(`${prefix}:p:__sessions`, 'wrong-type')

    await expect(store.delete(key)).rejects.toThrow('WRONGTYPE')
    expect(await store.load(key)).toEqual([entry])
  })

  test('subpath delete is atomic when the subpath index has the wrong type', async () => {
    const prefix = `${root}:delete-subpath`
    const store = new RedisSessionStore({ client, prefix })
    const key = {
      projectKey: 'p',
      sessionId: 's',
      subpath: 'subagents/a',
    }
    const entry = { type: 'assistant' }
    await store.append(key, [entry])
    await client.del(`${prefix}:p:s:__subkeys`)
    await client.set(`${prefix}:p:s:__subkeys`, 'wrong-type')

    await expect(store.delete(key)).rejects.toThrow('WRONGTYPE')
    expect(await store.load(key)).toEqual([entry])
  })

  test('append does not mutate when the session index cannot be updated', async () => {
    const prefix = `${root}:append-acl`
    const { redis, username } = await createRestrictedClient(prefix, [
      '+rpush',
    ])
    const store = new RedisSessionStore({ client: redis, prefix })
    try {
      await expect(
        store.append(
          { projectKey: 'p', sessionId: 's' },
          [{ type: 'assistant' }],
        ),
      ).rejects.toThrow()
      expect(await client.lrange(`${prefix}:p:s`, 0, -1)).toEqual([])
    } finally {
      await redis.quit()
      await client.call('ACL', 'DELUSER', username)
    }
  })

  test('main delete does not mutate when the session index cannot be updated', async () => {
    const prefix = `${root}:delete-main-acl`
    const key = { projectKey: 'p', sessionId: 's' }
    const entry = { type: 'assistant' }
    await new RedisSessionStore({ client, prefix }).append(key, [entry])
    const { redis, username } = await createRestrictedClient(prefix, [
      '+smembers',
      '+del',
    ])
    try {
      await expect(
        new RedisSessionStore({ client: redis, prefix }).delete(key),
      ).rejects.toThrow()
      expect(
        await new RedisSessionStore({ client, prefix }).load(key),
      ).toEqual([entry])
    } finally {
      await redis.quit()
      await client.call('ACL', 'DELUSER', username)
    }
  })

  test('subpath delete does not mutate when its index cannot be updated', async () => {
    const prefix = `${root}:delete-subpath-acl`
    const key = {
      projectKey: 'p',
      sessionId: 's',
      subpath: 'subagents/a',
    }
    const entry = { type: 'assistant' }
    await new RedisSessionStore({ client, prefix }).append(key, [entry])
    const { redis, username } = await createRestrictedClient(prefix, ['+del'])
    try {
      await expect(
        new RedisSessionStore({ client: redis, prefix }).delete(key),
      ).rejects.toThrow()
      expect(
        await new RedisSessionStore({ client, prefix }).load(key),
      ).toEqual([entry])
    } finally {
      await redis.quit()
      await client.call('ACL', 'DELUSER', username)
    }
  })

  test('main delete preflights each exact multi-key batch', async () => {
    const prefix = `${root}:delete-batch-acl`
    const key = { projectKey: 'p', sessionId: 's' }
    const entry = JSON.stringify({ type: 'assistant' })
    const entryKey = `${prefix}:p:s`
    const subkeysKey = `${entryKey}:__subkeys`
    const sessionsKey = `${prefix}:p:__sessions`
    const subpaths = Array.from(
      { length: 1002 },
      (_, index) => `subagents/${index}`,
    )
    const setup = client.pipeline().rpush(entryKey, entry)
    for (const subpath of subpaths) {
      setup.rpush(`${entryKey}:${subpath}`, entry)
      setup.sadd(subkeysKey, subpath)
    }
    setup.zadd(sessionsKey, Date.now(), key.sessionId)
    await setup.exec()

    const orderedSubpaths = await client.smembers(subkeysKey)
    const deleteKeys = [
      entryKey,
      subkeysKey,
      ...orderedSubpaths.map(subpath => `${entryKey}:${subpath}`),
    ]
    const username = `${root.replace(/[^a-zA-Z0-9]/g, '')}${n++}`
    const password = 'review-password'
    const permissions = '+eval +type +smembers +del +zrem'
    const selector = (keys: string[]) =>
      `(${permissions} ${keys.map(redisKey => `~${redisKey}`).join(' ')})`
    await client.call(
      'ACL',
      'SETUSER',
      username,
      'reset',
      'on',
      `>${password}`,
      selector([...deleteKeys.slice(0, 1000), sessionsKey]),
      selector(deleteKeys.slice(1000, 1002)),
      selector(deleteKeys.slice(1002)),
    )
    const redis: Redis = client.duplicate({
      enableReadyCheck: false,
      lazyConnect: false,
      username,
      password,
    })
    try {
      await expect(
        new RedisSessionStore({ client: redis, prefix }).delete(key),
      ).rejects.toThrow()
      expect(await client.llen(entryKey)).toBe(1)
      expect(await client.scard(subkeysKey)).toBe(subpaths.length)
      expect(await client.zscore(sessionsKey, key.sessionId)).not.toBeNull()
    } finally {
      await redis.quit()
      await client.call('ACL', 'DELUSER', username)
    }
  })

  afterAll(async () => {
    const keys = await client.keys(`${root}:*`)
    if (keys.length) await client.del(...keys)
    await client.quit()
  })
})
