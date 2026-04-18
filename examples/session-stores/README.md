# SessionStore reference adapters

> **Reference implementations. Not published to npm, not maintained as production code.**

Reference [`SessionStore`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
implementations for S3, Redis, and Postgres — copy the directory you need into
your project, install the backend client, and wire it into
`query({ options: { sessionStore } })`.

These adapters live under `examples/` so the SDK package stays free of
heavyweight optional dependencies. They are not part of the published
`@anthropic-ai/claude-agent-sdk` package and are not built or tested by this
repository's CI. Each adapter passes the 13-contract conformance suite in
[`shared/conformance.ts`](shared/conformance.ts).

| Adapter | Backend client | Unit tests | Live tests |
| --- | --- | --- | --- |
| [`s3/`](s3/) | `@aws-sdk/client-s3` | in-process mock | env-gated (`SESSION_STORE_S3_*`) |
| [`redis/`](redis/) | `ioredis` | in-process mock | env-gated (`SESSION_STORE_REDIS_URL`) |
| [`postgres/`](postgres/) | `pg` | constructor only | env-gated (`SESSION_STORE_POSTGRES_URL`) |

## Layout

Each adapter is a self-contained package:

```
{s3,redis,postgres}/
  src/{Backend}SessionStore.ts   # the adapter — copy this into your project
  src/index.ts
  test/                          # unit + env-gated live conformance
  demo.ts                        # runnable query() + resume round-trip
  package.json
  tsconfig.json
shared/
  conformance.ts                 # 13-contract behavioral suite
```

## Running an example

```bash
cd examples/session-stores/redis
npm install                # or: bun install
npm test                   # mock-backed unit tests, no Redis needed

# live conformance (requires a real backend)
docker run -d -p 6379:6379 redis:7-alpine
SESSION_STORE_REDIS_URL=redis://localhost:6379/0 npm run test:live

# end-to-end demo against the SDK (requires ANTHROPIC_API_KEY)
SESSION_STORE_REDIS_URL=redis://localhost:6379/0 npm run demo
```

The S3 and Postgres directories follow the same pattern — see each `demo.ts`
header for the corresponding `docker run` and env vars.

## Validating your own adapter

When you copy an adapter into your project (or write a new one), assert it
satisfies the protocol's behavioral contracts with the vendored conformance
harness:

```typescript
import { describe } from 'bun:test'
import { runSessionStoreConformance } from './conformance.ts'

describe('MyStore', () => {
  runSessionStoreConformance(async () => new MyStore(/* fresh isolated state */))
})
```

The factory must return a fresh, isolated store on every call (e.g. unique
table name, key prefix, or bucket prefix).

## Production checklist

These adapters are reference code. Before running one in production, work
through the relevant items below.

### All adapters

- The conformance suite proves *correctness*, not *resilience* — load-test
  your adapter under your expected throughput.
- `append()` failures are logged and surfaced as a stream error message; they
  never block the conversation. Monitor for these so silent mirror gaps don't
  go unnoticed.
- The SDK never deletes from your store unless you call `deleteSession()` with
  `delete()` implemented. Retention is your responsibility — implement TTL,
  lifecycle policies, or scheduled cleanup according to your compliance
  requirements.
- Local-disk transcripts under `CLAUDE_CONFIG_DIR` are swept independently by
  the CLI's `cleanupPeriodDays` setting.

### S3

- Required IAM actions on the bucket/prefix: `s3:PutObject`, `s3:GetObject`,
  `s3:ListBucket`, `s3:DeleteObject`.
- Part-file ordering uses the **client-side wall clock**. Multiple writer
  instances with clock skew >1s may produce out-of-order `load()` results. Use
  NTP or a single writer per session.
- Consider S3 lifecycle policies for retention.
- For sessions with >1000 part files, `load()` paginates correctly but latency
  grows linearly; consider periodic compaction.

### Redis

- Set `maxmemory-policy noeviction` (or use a dedicated DB) — eviction will
  silently drop session data.
- Lists are unbounded; implement TTL via `EXPIRE` in a subclass if needed.
- Redis Cluster: keys with the same `{projectKey}:{sessionId}` prefix should
  hash to the same slot — wrap in `{...}` hash tags if using Cluster.

### Postgres

- Size the `pg.Pool` for expected concurrent sessions; don't share a pool
  with request-handler code that holds connections.
- `jsonb` reorders object keys — contract-safe (the SDK never byte-compares
  entries), but don't byte-compare yourself.
- Add a retention job (`DELETE WHERE created_at < ...`) — the table grows
  unbounded.

---

## S3 — `s3/src/S3SessionStore.ts`

Stores transcripts as JSONL part files:

```
s3://{bucket}/{prefix}{projectKey}/{sessionId}/part-{epochMs13}-{rand6}.jsonl
```

Each `append()` writes a new part; `load()` lists, sorts, and concatenates
them.

```typescript
import { S3Client } from '@aws-sdk/client-s3'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { S3SessionStore } from './S3SessionStore.js'

const store = new S3SessionStore({
  bucket: 'my-claude-sessions',
  prefix: 'transcripts',
  client: new S3Client({ region: 'us-east-1' }),
})

for await (const message of query({
  prompt: 'Hello!',
  options: { sessionStore: store },
})) {
  if (message.type === 'result' && message.subtype === 'success') {
    console.log(message.result)
  }
}
```

### Live S3 end-to-end

```bash
docker run -d -p 9000:9000 minio/minio server /data
docker run --rm --network host minio/mc \
  sh -c 'mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/test'

cd examples/session-stores/s3
npm install
SESSION_STORE_S3_ENDPOINT=http://localhost:9000 \
SESSION_STORE_S3_BUCKET=test \
SESSION_STORE_S3_ACCESS_KEY=minioadmin \
SESSION_STORE_S3_SECRET_KEY=minioadmin \
  npm run test:live
```

---

## Redis — `redis/src/RedisSessionStore.ts`

Backed by [`ioredis`](https://github.com/redis/ioredis).

```typescript
import Redis from 'ioredis'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { RedisSessionStore } from './RedisSessionStore.js'

const store = new RedisSessionStore({
  client: new Redis({ host: 'localhost', port: 6379 }),
  prefix: 'transcripts',
})

for await (const message of query({
  prompt: 'Hello!',
  options: { sessionStore: store },
})) {
  if (message.type === 'result' && message.subtype === 'success') {
    console.log(message.result)
  }
}
```

### Key scheme

```
{prefix}:{projectKey}:{sessionId}             list   — main transcript entries (JSON each)
{prefix}:{projectKey}:{sessionId}:{subpath}   list   — subagent transcript entries
{prefix}:{projectKey}:{sessionId}:__subkeys   set    — subpaths under this session
{prefix}:{projectKey}:__sessions              zset   — sessionId → mtime(ms)
```

Each `append()` is an `RPUSH` plus an index update in a single `MULTI`;
`load()` is `LRANGE 0 -1`.

### Live Redis end-to-end

```bash
docker run -d -p 6379:6379 redis:7-alpine
cd examples/session-stores/redis
npm install
SESSION_STORE_REDIS_URL=redis://localhost:6379/0 npm run test:live
```

---

## Postgres — `postgres/src/PostgresSessionStore.ts`

Backed by [`pg`](https://node-postgres.com/).

```typescript
import { Pool } from 'pg'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { PostgresSessionStore } from './PostgresSessionStore.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const store = new PostgresSessionStore({ pool })
await store.ensureSchema() // idempotent CREATE TABLE IF NOT EXISTS

for await (const message of query({
  prompt: 'Hello!',
  options: { sessionStore: store },
})) {
  if (message.type === 'result' && message.subtype === 'success') {
    console.log(message.result)
  }
}
```

### Schema

One row per transcript entry; `id` (a `BIGSERIAL`) orders entries within a
`(project_key, session_id, subpath)` key:

```sql
CREATE TABLE claude_session_entries (
  id          BIGSERIAL PRIMARY KEY,
  project_key TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  subpath     TEXT,               -- NULL = main transcript
  entry       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX claude_session_entries_key_idx
  ON claude_session_entries (project_key, session_id, subpath, id);
```

`append()` is a single multi-row `INSERT`; `load()` is
`SELECT entry ... ORDER BY id`.

### JSONB key ordering

Entries are stored as `jsonb`, which **reorders object keys** on read-back.
This is explicitly allowed by the `SessionStore` contract — `load()` requires
*deep-equal*, not *byte-equal*, returns. If you need byte-stable storage,
switch the column to `json` (preserves text as-is) or `text`.

### Live Postgres end-to-end

There is no in-process Postgres mock comparable to `ioredis-mock`, so the
Postgres conformance tests run **live-only**. They skip automatically unless
`SESSION_STORE_POSTGRES_URL` is set:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
cd examples/session-stores/postgres
npm install
SESSION_STORE_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres \
  npm run test:live
```

Each run creates a random-suffixed table and `DROP`s it on teardown.

---

## Resume

All three adapters support resume the same way:

```typescript
for await (const message of query({
  prompt: 'Continue where we left off',
  options: {
    sessionStore: store,
    resume: 'previous-session-id',
  },
})) {
  // ...
}
```
