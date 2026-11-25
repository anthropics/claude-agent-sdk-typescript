import type { Redis } from 'ioredis'
import type {
  SessionKey,
  SessionStore,
  SessionStoreEntry,
} from '@anthropic-ai/claude-agent-sdk'

export type RedisSessionStoreOptions = {
  /** Pre-configured ioredis client instance. Caller controls host, port, auth, etc. */
  client: Redis
  /** Optional key prefix (e.g., 'transcripts'). Trailing ':' is normalized. */
  prefix?: string
}

/** Reserved subpath sentinel for the per-session subkey set. */
const SUBKEYS = '__subkeys'
/** Reserved sessionId sentinel for the per-project session index. */
const SESSIONS = '__sessions'

const APPEND_SCRIPT = `
-- append
local entry_type = redis.call('TYPE', KEYS[1]).ok
local index_type = redis.call('TYPE', KEYS[2]).ok
if entry_type ~= 'none' and entry_type ~= 'list' then
  return redis.error_reply('WRONGTYPE transcript key must hold a list')
end
if index_type ~= 'none' and index_type ~= ARGV[1] then
  return redis.error_reply('WRONGTYPE index key must hold a ' .. ARGV[1])
end
local first_entry = ARGV[1] == 'set' and 3 or 4
if not redis.acl_check_cmd('RPUSH', KEYS[1], ARGV[first_entry]) then
  return redis.error_reply('NOPERM append requires RPUSH access')
end
if ARGV[1] == 'set' then
  if not redis.acl_check_cmd('SADD', KEYS[2], ARGV[2]) then
    return redis.error_reply('NOPERM append requires SADD access')
  end
else
  if not redis.acl_check_cmd('ZADD', KEYS[2], ARGV[2], ARGV[3]) then
    return redis.error_reply('NOPERM append requires ZADD access')
  end
end
local length = 0
for i = first_entry, #ARGV, 1000 do
  length = redis.call('RPUSH', KEYS[1], unpack(ARGV, i, math.min(i + 999, #ARGV)))
end
if ARGV[1] == 'set' then
  redis.call('SADD', KEYS[2], ARGV[2])
else
  redis.call('ZADD', KEYS[2], ARGV[2], ARGV[3])
end
return length
`

const DELETE_SUBPATH_SCRIPT = `
-- delete-subpath
local index_type = redis.call('TYPE', KEYS[2]).ok
if index_type ~= 'none' and index_type ~= 'set' then
  return redis.error_reply('WRONGTYPE subpath index key must hold a set')
end
if not redis.acl_check_cmd('DEL', KEYS[1]) then
  return redis.error_reply('NOPERM delete requires DEL access')
end
if not redis.acl_check_cmd('SREM', KEYS[2], ARGV[1]) then
  return redis.error_reply('NOPERM delete requires SREM access')
end
redis.call('DEL', KEYS[1])
redis.call('SREM', KEYS[2], ARGV[1])
return 1
`

const DELETE_SESSION_SCRIPT = `
-- delete-session
local subkeys_type = redis.call('TYPE', KEYS[2]).ok
local sessions_type = redis.call('TYPE', KEYS[3]).ok
if subkeys_type ~= 'none' and subkeys_type ~= 'set' then
  return redis.error_reply('WRONGTYPE subpath index key must hold a set')
end
if sessions_type ~= 'none' and sessions_type ~= 'zset' then
  return redis.error_reply('WRONGTYPE session index key must hold a zset')
end
if not redis.acl_check_cmd('SMEMBERS', KEYS[2]) then
  return redis.error_reply('NOPERM delete requires SMEMBERS access')
end
local subpaths = redis.call('SMEMBERS', KEYS[2])
local delete_keys = {KEYS[1], KEYS[2]}
for i = 1, #subpaths do
  delete_keys[#delete_keys + 1] = KEYS[1] .. ':' .. subpaths[i]
end
for i = 1, #delete_keys, 1000 do
  if not redis.acl_check_cmd('DEL', unpack(delete_keys, i, math.min(i + 999, #delete_keys))) then
    return redis.error_reply('NOPERM delete requires DEL access')
  end
end
if not redis.acl_check_cmd('ZREM', KEYS[3], ARGV[1]) then
  return redis.error_reply('NOPERM delete requires ZREM access')
end
for i = 1, #delete_keys, 1000 do
  redis.call('DEL', unpack(delete_keys, i, math.min(i + 999, #delete_keys)))
end
redis.call('ZREM', KEYS[3], ARGV[1])
return 1
`

/**
 * Redis-backed SessionStore.
 *
 * Key scheme (':' separator; projectKey/sessionId are opaque so collisions
 * with the SDK's '/'-based projectKey are avoided):
 *   {prefix}:{projectKey}:{sessionId}             → list (RPUSH/LRANGE) of JSON entries
 *   {prefix}:{projectKey}:{sessionId}:{subpath}   → list of JSON entries
 *   {prefix}:{projectKey}:{sessionId}:__subkeys   → set of subpaths under this session
 *   {prefix}:{projectKey}:__sessions              → sorted set of sessionId, score=mtime(ms)
 *
 * Index keys (`__subkeys`, `__sessions`) live in reserved positions; the SDK
 * never emits a sessionId of `__sessions` or a subpath of `__subkeys`.
 *
 * Retention: callers may set `EXPIRE` on the prefix via Redis-side policy or
 * call `delete()`; this adapter never expires keys on its own.
 */
export class RedisSessionStore implements SessionStore {
  private readonly client: Redis
  private readonly prefix: string

  constructor(options: RedisSessionStoreOptions) {
    this.client = options.client
    // Normalize: non-empty prefix always ends in exactly one ':'; empty stays empty.
    this.prefix = options.prefix ? options.prefix.replace(/:+$/, '') + ':' : ''
  }

  /** Redis key for a transcript list (main or subpath). */
  private entryKey(key: SessionKey): string {
    const parts = [key.projectKey, key.sessionId]
    if (key.subpath) parts.push(key.subpath)
    return this.prefix + parts.join(':')
  }

  /** Redis key for the per-session subpath set. */
  private subkeysKey(key: { projectKey: string; sessionId: string }): string {
    return `${this.prefix}${key.projectKey}:${key.sessionId}:${SUBKEYS}`
  }

  /** Redis key for the per-project session index (sorted set, score=mtime). */
  private sessionsKey(projectKey: string): string {
    return `${this.prefix}${projectKey}:${SESSIONS}`
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) return
    const indexKey = key.subpath
      ? this.subkeysKey(key)
      : this.sessionsKey(key.projectKey)
    const indexArgs = key.subpath
      ? ['set', key.subpath]
      : ['zset', Date.now(), key.sessionId]

    await this.client.eval(
      APPEND_SCRIPT,
      2,
      this.entryKey(key),
      indexKey,
      ...indexArgs,
      ...entries.map(e => JSON.stringify(e)),
    )
  }

  async load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    const raw = await this.client.lrange(this.entryKey(key), 0, -1)
    if (raw.length === 0) return null
    const out: SessionStoreEntry[] = []
    for (const line of raw) {
      try {
        out.push(JSON.parse(line))
      } catch {
        // Skip malformed entries (parity with S3SessionStore)
      }
    }
    return out.length > 0 ? out : null
  }

  async listSessions(
    projectKey: string,
  ): Promise<Array<{ sessionId: string; mtime: number }>> {
    const flat = await this.client.zrange(
      this.sessionsKey(projectKey),
      0,
      -1,
      'WITHSCORES',
    )
    const result: Array<{ sessionId: string; mtime: number }> = []
    for (let i = 0; i < flat.length; i += 2) {
      result.push({ sessionId: flat[i]!, mtime: Number(flat[i + 1]) })
    }
    return result
  }

  async delete(key: SessionKey): Promise<void> {
    if (key.subpath !== undefined) {
      await this.client.eval(
        DELETE_SUBPATH_SCRIPT,
        2,
        this.entryKey(key),
        this.subkeysKey(key),
        key.subpath,
      )
      return
    }
    await this.client.eval(
      DELETE_SESSION_SCRIPT,
      3,
      this.entryKey(key),
      this.subkeysKey(key),
      this.sessionsKey(key.projectKey),
      key.sessionId,
    )
  }

  async listSubkeys(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]> {
    return this.client.smembers(this.subkeysKey(key))
  }
}
