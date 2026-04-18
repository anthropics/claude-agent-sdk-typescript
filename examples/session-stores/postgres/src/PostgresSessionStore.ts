import type { Pool } from 'pg'
import type {
  SessionKey,
  SessionStore,
  SessionStoreEntry,
} from '@anthropic-ai/claude-agent-sdk'

export type PostgresSessionStoreOptions = {
  /** Pre-configured pg Pool. Caller controls connection params, pooling, TLS. */
  pool: Pool
  /** Table name. Must be a valid SQL identifier; default 'claude_session_entries'. */
  tableName?: string
}

/**
 * Postgres-backed SessionStore. One row per JSONL entry; ordering via BIGSERIAL.
 * Reference implementation — proves the SessionStore contract maps to SQL.
 */
export class PostgresSessionStore implements SessionStore {
  private readonly pool: Pool
  private readonly table: string

  constructor(opts: PostgresSessionStoreOptions) {
    this.pool = opts.pool
    const t = opts.tableName ?? 'claude_session_entries'
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
      throw new Error(`invalid tableName: ${t}`)
    }
    this.table = t
  }

  /** Creates the table + covering index if absent. Call once at startup. */
  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id          BIGSERIAL PRIMARY KEY,
        project_key TEXT NOT NULL,
        session_id  TEXT NOT NULL,
        subpath     TEXT,
        entry       JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${this.table}_key_idx
        ON ${this.table} (project_key, session_id, subpath, id)
    `)
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) return
    // Multi-row VALUES with parameterized placeholders: ($1,$2,$3,$4),($1,$2,$3,$5),...
    // project_key/session_id/subpath are repeated; entry varies.
    const params: unknown[] = [
      key.projectKey,
      key.sessionId,
      key.subpath ?? null,
    ]
    const rows = entries.map((e, i) => {
      params.push(JSON.stringify(e))
      return `($1,$2,$3,$${4 + i}::jsonb)`
    })
    await this.pool.query(
      `INSERT INTO ${this.table} (project_key, session_id, subpath, entry) VALUES ${rows.join(',')}`,
      params,
    )
  }

  async load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    // IS NOT DISTINCT FROM matches NULL-to-NULL (subpath undefined → main transcript).
    const { rows } = await this.pool.query<{ entry: SessionStoreEntry }>(
      `SELECT entry FROM ${this.table}
         WHERE project_key = $1 AND session_id = $2 AND subpath IS NOT DISTINCT FROM $3
         ORDER BY id`,
      [key.projectKey, key.sessionId, key.subpath ?? null],
    )
    return rows.length > 0 ? rows.map(r => r.entry) : null
  }

  async listSessions(
    projectKey: string,
  ): Promise<Array<{ sessionId: string; mtime: number }>> {
    const { rows } = await this.pool.query<{ session_id: string; mtime: Date }>(
      `SELECT session_id, MAX(created_at) AS mtime FROM ${this.table}
         WHERE project_key = $1 AND subpath IS NULL
         GROUP BY session_id
         ORDER BY mtime DESC`,
      [projectKey],
    )
    return rows.map(r => ({
      sessionId: r.session_id,
      mtime: r.mtime.getTime(),
    }))
  }

  async delete(key: SessionKey): Promise<void> {
    if (key.subpath === undefined) {
      // Main-transcript delete cascades to all subpaths under (projectKey, sessionId).
      await this.pool.query(
        `DELETE FROM ${this.table} WHERE project_key = $1 AND session_id = $2`,
        [key.projectKey, key.sessionId],
      )
    } else {
      await this.pool.query(
        `DELETE FROM ${this.table} WHERE project_key = $1 AND session_id = $2 AND subpath = $3`,
        [key.projectKey, key.sessionId, key.subpath],
      )
    }
  }

  async listSubkeys(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]> {
    const { rows } = await this.pool.query<{ subpath: string }>(
      `SELECT DISTINCT subpath FROM ${this.table}
         WHERE project_key = $1 AND session_id = $2 AND subpath IS NOT NULL`,
      [key.projectKey, key.sessionId],
    )
    return rows.map(r => r.subpath)
  }
}
