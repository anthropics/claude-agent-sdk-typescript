import type { Collection, MongoClient } from 'mongodb'
import type {
  SessionKey,
  SessionStore,
  SessionStoreEntry,
} from '@anthropic-ai/claude-agent-sdk'

export type MongoDBSessionStoreOptions = {
  /** Pre-configured MongoClient. Caller controls auth, TLS, pooling. */
  client: MongoClient
  /** Database name. Falls back to the client's default database when omitted. */
  dbName?: string
  /** Collection name. Must match /^[A-Za-z_][A-Za-z0-9_.]*$/; default 'claude_session_entries'. */
  collectionName?: string
}

type EntryDoc = {
  projectKey: string
  sessionId: string
  subpath: string | null
  entry: SessionStoreEntry
  createdAt: Date
}

/**
 * MongoDB-backed SessionStore. One document per JSONL entry; ordering via
 * server-generated ObjectId (`_id`). Reference implementation — proves the
 * SessionStore contract maps to a document store.
 */
export class MongoDBSessionStore implements SessionStore {
  private readonly client: MongoClient
  private readonly dbName: string | undefined
  private readonly collectionName: string

  constructor(opts: MongoDBSessionStoreOptions) {
    this.client = opts.client
    this.dbName = opts.dbName
    const c = opts.collectionName ?? 'claude_session_entries'
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(c)) {
      throw new Error(`invalid collectionName: ${c}`)
    }
    this.collectionName = c
  }

  private collection(): Collection<EntryDoc> {
    return this.client.db(this.dbName).collection<EntryDoc>(this.collectionName)
  }

  /** Creates the indexes if absent. Call once at startup. */
  async ensureSchema(): Promise<void> {
    await this.collection().createIndexes([
      {
        key: { projectKey: 1, sessionId: 1, subpath: 1, _id: 1 },
        name: 'key_idx',
      },
      {
        key: { projectKey: 1, subpath: 1, createdAt: -1 },
        name: 'sessions_idx',
      },
    ])
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) return
    const now = new Date()
    const docs: EntryDoc[] = entries.map(entry => ({
      projectKey: key.projectKey,
      sessionId: key.sessionId,
      subpath: key.subpath ?? null,
      entry,
      createdAt: now,
    }))
    await this.collection().insertMany(docs, { ordered: true })
  }

  async load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    const docs = await this.collection()
      .find({
        projectKey: key.projectKey,
        sessionId: key.sessionId,
        subpath: key.subpath ?? null,
      })
      .sort({ _id: 1 })
      .toArray()
    return docs.length > 0 ? docs.map(d => d.entry) : null
  }

  async listSessions(
    projectKey: string,
  ): Promise<Array<{ sessionId: string; mtime: number }>> {
    const rows = await this.collection()
      .aggregate<{ _id: string; mtime: Date }>([
        { $match: { projectKey, subpath: null } },
        { $group: { _id: '$sessionId', mtime: { $max: '$createdAt' } } },
        { $sort: { mtime: -1 } },
      ])
      .toArray()
    return rows.map(r => ({ sessionId: r._id, mtime: r.mtime.getTime() }))
  }

  async delete(key: SessionKey): Promise<void> {
    if (key.subpath === undefined) {
      // Main-transcript delete cascades to all subpaths under (projectKey, sessionId).
      await this.collection().deleteMany({
        projectKey: key.projectKey,
        sessionId: key.sessionId,
      })
    } else {
      await this.collection().deleteMany({
        projectKey: key.projectKey,
        sessionId: key.sessionId,
        subpath: key.subpath,
      })
    }
  }

  async listSubkeys(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]> {
    const subs = await this.collection().distinct('subpath', {
      projectKey: key.projectKey,
      sessionId: key.sessionId,
      subpath: { $ne: null },
    })
    return subs.filter((s): s is string => typeof s === 'string')
  }
}
