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

/** Encode one key component so it cannot contain the ':' separator. */
function encodePart(value: string): string {
  return encodeURIComponent(value)
}

/**
 * Redis-backed SessionStore.
 *
 * Key scheme. Each caller-supplied component is percent-encoded, then placed
 * after a fixed type tag. The tag is what keeps a session id of `sessions`
 * or `__sessions` from landing on the index key. Encoding is what keeps
 * `sessionId: "a:b"` from being the same key as session `a` plus subpath `b`.
 *   {prefix}entry:{projectKey}:{sessionId}             → list of JSON entries
 *   {prefix}entry:{projectKey}:{sessionId}:{subpath}   → list of JSON entries
 *   {prefix}subkeys:{projectKey}:{sessionId}           → set of subpaths
 *   {prefix}sessions:{projectKey}                      → sorted set of sessionId, score=mtime(ms)
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
    const parts = [encodePart(key.projectKey), encodePart(key.sessionId)]
    if (key.subpath) parts.push(encodePart(key.subpath))
    return this.prefix + 'entry:' + parts.join(':')
  }

  /** Redis key for the per-session subpath set. */
  private subkeysKey(key: { projectKey: string; sessionId: string }): string {
    return `${this.prefix}subkeys:${encodePart(key.projectKey)}:${encodePart(key.sessionId)}`
  }

  /** Redis key for the per-project session index (sorted set, score=mtime). */
  private sessionsKey(projectKey: string): string {
    return `${this.prefix}sessions:${encodePart(projectKey)}`
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) return
    const pipe = this.client.multi()
    pipe.rpush(this.entryKey(key), ...entries.map(e => JSON.stringify(e)))
    if (key.subpath) {
      pipe.sadd(this.subkeysKey(key), key.subpath)
    } else {
      // Only main-transcript appends bump the session index — matches
      // InMemorySessionStore.listSessions()'s "no subpath" filter and the S3
      // adapter's main-parts-only mtime derivation.
      pipe.zadd(this.sessionsKey(key.projectKey), Date.now(), key.sessionId)
    }
    await pipe.exec()
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
      // Targeted: remove just this subpath list and its index entry.
      await this.client
        .multi()
        .del(this.entryKey(key))
        .srem(this.subkeysKey(key), key.subpath)
        .exec()
      return
    }
    // Cascade: main list + every subpath list + subkey set + session-index entry.
    const subkeysKey = this.subkeysKey(key)
    const subpaths = await this.client.smembers(subkeysKey)
    const toDelete = [
      this.entryKey(key),
      subkeysKey,
      ...subpaths.map(sp => this.entryKey({ ...key, subpath: sp })),
    ]
    await this.client
      .multi()
      .del(...toDelete)
      .zrem(this.sessionsKey(key.projectKey), key.sessionId)
      .exec()
  }

  async listSubkeys(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]> {
    return this.client.smembers(this.subkeysKey(key))
  }
}
