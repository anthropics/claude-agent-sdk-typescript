/**
 * Live conformance suite against a real S3-compatible endpoint.
 * Skips automatically unless SESSION_STORE_S3_ENDPOINT and
 * SESSION_STORE_S3_BUCKET are set. See ../demo.ts for MinIO setup.
 */
import { afterAll, describe } from 'bun:test'
import { S3Client } from '@aws-sdk/client-s3'
import { S3SessionStore } from '../src/S3SessionStore.ts'
import { runSessionStoreConformance } from '../../shared/conformance.ts'

const endpoint = process.env.SESSION_STORE_S3_ENDPOINT
const bucket = process.env.SESSION_STORE_S3_BUCKET
const accessKeyId = process.env.SESSION_STORE_S3_ACCESS_KEY
const secretAccessKey = process.env.SESSION_STORE_S3_SECRET_KEY

const enabled = !!(endpoint && bucket)

describe.skipIf(!enabled)('S3SessionStore (live conformance)', () => {
  const client = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: true,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
  })
  const root = `conformance-${Date.now().toString(36)}`
  let n = 0

  runSessionStoreConformance(
    () =>
      new S3SessionStore({
        bucket: bucket!,
        prefix: `${root}/${n++}`,
        client,
      }),
  )

  afterAll(async () => {
    // Best-effort cleanup of everything written under the root prefix.
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import(
      '@aws-sdk/client-s3'
    )
    let token: string | undefined
    do {
      const r = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket!,
          Prefix: root + '/',
          ContinuationToken: token,
        }),
      )
      const objs = (r.Contents ?? [])
        .map(o => o.Key)
        .filter((k): k is string => !!k)
      if (objs.length) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket!,
            Delete: { Objects: objs.map(Key => ({ Key })), Quiet: true },
          }),
        )
      }
      token = r.NextContinuationToken
    } while (token)
  })
})
