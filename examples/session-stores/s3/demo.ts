/**
 * End-to-end demo: run a query with S3SessionStore, then resume it.
 *
 * Prereqs:
 *   - ANTHROPIC_API_KEY set
 *   - An S3-compatible endpoint. For local testing with MinIO:
 *       docker run -d -p 9000:9000 minio/minio server /data
 *       docker run --rm --network host minio/mc \
 *         sh -c 'mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/claude-sessions'
 *
 * Run:
 *   SESSION_STORE_S3_ENDPOINT=http://localhost:9000 \
 *   SESSION_STORE_S3_BUCKET=claude-sessions \
 *   AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
 *     bun run demo.ts
 */
import { S3Client } from '@aws-sdk/client-s3'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { S3SessionStore } from './src/S3SessionStore.ts'

const bucket = process.env.SESSION_STORE_S3_BUCKET
if (!bucket) {
  console.error('Set SESSION_STORE_S3_BUCKET (see header for MinIO setup)')
  process.exit(1)
}

const client = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.SESSION_STORE_S3_ENDPOINT,
  forcePathStyle: !!process.env.SESSION_STORE_S3_ENDPOINT,
})

const store = new S3SessionStore({ bucket, prefix: 'demo', client })

async function run(prompt: string, resume?: string) {
  let sessionId: string | undefined
  for await (const m of query({
    prompt,
    options: { sessionStore: store, resume, maxTurns: 1 },
  })) {
    if (m.type === 'system' && m.subtype === 'init') sessionId = m.session_id
    if (m.type === 'result') {
      console.log(`[${m.subtype}]`, 'result' in m ? m.result : '')
    }
  }
  return sessionId
}

const sid = await run('Reply with exactly the word: pineapple')
console.log('session', sid, 'mirrored to s3://' + bucket + '/demo/')

await run('What single word did you just reply with?', sid)
