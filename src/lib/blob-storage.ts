import { put } from '@vercel/blob'

/**
 * Upload a file to Vercel Blob Storage.
 * Returns the public URL on success, or `null` if the upload fails
 * (e.g. store is suspended, quota exceeded, network error).
 *
 * Callers must handle the `null` case gracefully — the proxy route
 * will serve images from Google Drive CDN as a fallback.
 */
export async function uploadToBlob(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.warn('[blob-storage] BLOB_READ_WRITE_TOKEN not set, skipping upload')
    return null
  }

  try {
    const blob = await put(path, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    })
    return blob.url
  } catch (error) {
    console.warn(
      '[blob-storage] Upload failed (store may be suspended):',
      error instanceof Error ? error.message : error
    )
    return null
  }
}
