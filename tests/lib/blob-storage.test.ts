import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('@vercel/blob')

import { uploadToBlob } from '@/lib/blob-storage'
import { put } from '@vercel/blob'

const putMock = vi.mocked(put)

beforeAll(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
})

describe('uploadToBlob', () => {
  it('uploads the buffer to the given path and returns the resulting URL', async () => {
    putMock.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/albums/a1/photos/p1/v1/thumb.jpg',
    })

    const buffer = Buffer.from('fake-image-bytes')
    const url = await uploadToBlob('albums/a1/photos/p1/v1/thumb.jpg', buffer, 'image/jpeg')

    expect(url).toBe('https://blob.vercel-storage.com/albums/a1/photos/p1/v1/thumb.jpg')
    expect(putMock).toHaveBeenCalledWith('albums/a1/photos/p1/v1/thumb.jpg', buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
      token: 'test-token',
    })
  })
})
