import { put } from '@vercel/blob'
import { requireEnv } from './env'

export async function uploadToBlob(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const blob = await put(path, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: requireEnv('BLOB_READ_WRITE_TOKEN'),
  })
  return blob.url
}
