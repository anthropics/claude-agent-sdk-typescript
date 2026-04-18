import {
  DeleteObjectsCommand,
  type DeleteObjectsCommandInput,
  GetObjectCommand,
  type GetObjectCommandInput,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  PutObjectCommand,
  type PutObjectCommandInput,
  type S3Client,
} from '@aws-sdk/client-s3'
import type {
  SessionKey,
  SessionStore,
  SessionStoreEntry,
} from '@anthropic-ai/claude-agent-sdk'

const LOAD_CONCURRENCY = 16

export type S3SessionStoreOptions = {
  /** S3 bucket name */
  bucket: string
  /** Optional key prefix (e.g., 'transcripts'). Trailing slash is normalized. */
  prefix?: string
  /** Pre-configured S3Client instance. Caller controls region, credentials, etc. */
  client: S3Client
}

/**
 * S3-backed SessionStore. append() = new part file `{prefix}{projectKey}/{sessionId}/part-{epochMs13}-{rand6}.jsonl`;
 * load() = list+sort+concat. Monotonic ms orders same-instance same-ms appends; rand suffix disambiguates instances.
 */
export class S3SessionStore implements SessionStore {
  private readonly bucket: string
  private readonly prefix: string
  private readonly client: S3Client
  private lastMs = 0

  constructor(options: S3SessionStoreOptions) {
    this.bucket = options.bucket
    // Normalize: non-empty prefix always ends in exactly one '/'; empty stays empty.
    this.prefix = options.prefix ? options.prefix.replace(/\/+$/, '') + '/' : ''
    this.client = options.client
  }

  /** Directory prefix for a session (or subpath). Always ends in '/'. */
  private keyPrefix(key: SessionKey): string {
    const parts = [key.projectKey, key.sessionId]
    if (key.subpath) {
      parts.push(key.subpath)
    }
    return this.prefix + parts.join('/') + '/'
  }

  /** Directory prefix for a project. Always ends in '/'. */
  private projectPrefix(projectKey: string): string {
    return this.prefix + projectKey + '/'
  }

  /**
   * Fixed-width epoch ms → lexical sort = chronological. lastMs+1 makes
   * same-instance same-ms appends deterministic; rand disambiguates instances.
   */
  private nextPartName(): string {
    const now = Date.now()
    const ms = Math.max(now, this.lastMs + 1)
    this.lastMs = ms
    const rand = Math.random().toString(16).slice(2, 8).padStart(6, '0')
    return `part-${ms.toString().padStart(13, '0')}-${rand}.jsonl`
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }
    const objectKey = this.keyPrefix(key) + this.nextPartName()
    const body = entries.map(e => JSON.stringify(e)).join('\n') + '\n'

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: 'application/x-ndjson',
      } satisfies PutObjectCommandInput),
    )
  }

  async load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    const prefix = this.keyPrefix(key)
    let continuationToken: string | undefined

    // List part files directly under this prefix only. Without Delimiter,
    // S3 recurses into subpaths (e.g. subagents/*), so a main-transcript
    // load({projectKey, sessionId}) would mix in subagent entries — diverging
    // from InMemorySessionStore's exact-key semantics and corrupting resume.
    const keys: string[] = []
    do {
      const listResult = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          Delimiter: '/',
          ContinuationToken: continuationToken,
        } satisfies ListObjectsV2CommandInput),
      )
      if (listResult.Contents) {
        for (const obj of listResult.Contents) {
          // Guard against S3-compatibles that ignore Delimiter: keep only
          // direct children (part files have no '/' after the prefix).
          if (obj.Key && !obj.Key.slice(prefix.length).includes('/')) {
            keys.push(obj.Key)
          }
        }
      }
      continuationToken = listResult.NextContinuationToken
    } while (continuationToken)

    if (keys.length === 0) {
      return null
    }

    // Sort by key (lexicographic -- 13-digit epochMs prefix is fixed-width,
    // so lexical order == chronological order)
    keys.sort()

    // Bounded-parallel GetObject (serial is N×RTT); preserves sorted-key order.
    const allEntries: SessionStoreEntry[] = []
    for (let i = 0; i < keys.length; i += LOAD_CONCURRENCY) {
      const batch = keys.slice(i, i + LOAD_CONCURRENCY)
      const bodies = await Promise.all(
        batch.map(async objectKey => {
          const getResult = await this.client.send(
            new GetObjectCommand({
              Bucket: this.bucket,
              Key: objectKey,
            } satisfies GetObjectCommandInput),
          )
          return getResult.Body?.transformToString()
        }),
      )
      for (const body of bodies) {
        if (!body) {
          continue
        }
        for (const line of body.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) {
            continue
          }
          try {
            allEntries.push(JSON.parse(trimmed))
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    return allEntries.length > 0 ? allEntries : null
  }

  async listSessions(
    projectKey: string,
  ): Promise<Array<{ sessionId: string; mtime: number }>> {
    const prefix = this.projectPrefix(projectKey)
    const sessions = new Map<string, number>()
    let continuationToken: string | undefined

    // List Contents (no Delimiter) so we can derive mtime from each part
    // filename's 13-digit epochMs prefix. CommonPrefixes carry no timestamp.
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )
      if (result.Contents) {
        for (const obj of result.Contents) {
          if (!obj.Key) {
            continue
          }
          // {prefix}{sessionId}/part-{epochMs13}-{rand}.jsonl
          const rest = obj.Key.slice(prefix.length)
          const slash = rest.indexOf('/')
          if (slash === -1) {
            continue
          }
          // Main-transcript parts only (one level under sessionId); deeper keys
          // are subagent parts and would surface phantom sessionIds / skew mtime.
          if (rest.indexOf('/', slash + 1) !== -1) {
            continue
          }
          const sessionId = rest.slice(0, slash)
          const m = obj.Key.match(/\/part-(\d{13})-[0-9a-f]{6}\.jsonl$/)
          const mtime = m ? Number(m[1]) : (obj.LastModified?.getTime() ?? 0)
          const prev = sessions.get(sessionId) ?? 0
          if (mtime > prev) {
            sessions.set(sessionId, mtime)
          }
        }
      }
      continuationToken = result.NextContinuationToken
    } while (continuationToken)

    return Array.from(sessions, ([sessionId, mtime]) => ({
      sessionId,
      mtime,
    }))
  }

  async delete(key: SessionKey): Promise<void> {
    const prefix = this.keyPrefix(key)
    // Match InMemorySessionStore: whole-session delete cascades into subpaths;
    // delete({subpath:'a'}) is exact-key only (must NOT touch 'a/b').
    const directOnly = key.subpath !== undefined
    let continuationToken: string | undefined

    do {
      const listResult = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          Delimiter: directOnly ? '/' : undefined,
          ContinuationToken: continuationToken,
        }),
      )
      const toDelete: Array<{ Key: string }> = []
      if (listResult.Contents) {
        for (const obj of listResult.Contents) {
          if (!obj.Key) {
            continue
          }
          if (directOnly && obj.Key.slice(prefix.length).includes('/')) {
            continue
          }
          toDelete.push({ Key: obj.Key })
        }
      }
      if (toDelete.length > 0) {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: toDelete, Quiet: true },
          } satisfies DeleteObjectsCommandInput),
        )
        if (result.Errors?.length) {
          throw new Error(
            `S3 delete failed for ${result.Errors.length} object(s): ${result.Errors.map(e => `${e.Key}: ${e.Code}`).join(', ')}`,
          )
        }
      }
      continuationToken = listResult.NextContinuationToken
    } while (continuationToken)
  }

  async listSubkeys(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]> {
    const prefix = this.keyPrefix({
      projectKey: key.projectKey,
      sessionId: key.sessionId,
    })
    const subkeys = new Set<string>()
    let continuationToken: string | undefined

    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )
      if (result.Contents) {
        for (const obj of result.Contents) {
          if (obj.Key) {
            // Extract subpath from key:
            // {prefix}{projectKey}/{sessionId}/{subpath}/part-{epochMs}-{rand}.jsonl
            const rel = obj.Key.slice(prefix.length)
            const parts = rel.split('/')
            if (parts.length >= 2) {
              // subpath is everything except the last segment (the part file)
              const subpath = parts.slice(0, -1).join('/')
              if (subpath) {
                subkeys.add(subpath)
              }
            }
          }
        }
      }
      continuationToken = result.NextContinuationToken
    } while (continuationToken)

    // Defense-in-depth: drop '..'/'.'/'' segments (never produced by legit
    // writers). Primary traversal guard stays in materializeResumeSession.
    return Array.from(subkeys).filter(
      sp =>
        !sp.split('/').some(seg => seg === '..' || seg === '.' || seg === ''),
    )
  }
}
