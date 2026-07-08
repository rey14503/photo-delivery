// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
})

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  replaceFile: vi.fn(),
}))
vi.mock('@/lib/image-processing', () => ({
  processImage: vi.fn(),
}))
vi.mock('@/lib/blob-storage', () => ({
  uploadToBlob: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { replaceFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { POST } from '@/app/api/photos/[photoId]/replace/route'

function formRequest(file: unknown) {
  return {
    formData: async () => ({
      get: (key: string) => (key === 'file' ? file : null),
    }),
  } as never
}

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/photos/[photoId]/replace', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a PHOTOGRAPHER does not own the photo\'s album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_1',
      driveFileId: 'drive_file_1',
      version: 1,
      album: { id: 'album_1', ownerId: 'someone_else', owner: { id: 'someone_else', encryptedRefreshToken: 'cipher' } },
    } as never)

    const res = await POST(formRequest(null), routeParams('photo_1'))

    expect(res.status).toBe(403)
  })

  it('replaces the Drive file, bumps the version, and re-caches previews', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_1',
      driveFileId: 'drive_file_1',
      version: 1,
      album: { id: 'album_1', ownerId: 'user_1', owner: { id: 'user_1', encryptedRefreshToken: 'cipher' } },
    } as never)
    vi.mocked(processImage).mockResolvedValue({
      thumbnail: Buffer.from('thumb-v2'),
      preview: Buffer.from('preview-v2'),
    })
    vi.mocked(uploadToBlob)
      .mockResolvedValueOnce('https://blob/v2/thumb.jpg')
      .mockResolvedValueOnce('https://blob/v2/preview.jpg')
    vi.mocked(prisma.photo.update).mockResolvedValue({
      id: 'photo_1',
      version: 2,
      thumbnailUrl: 'https://blob/v2/thumb.jpg',
      previewUrl: 'https://blob/v2/preview.jpg',
    } as never)
    const file = {
      type: 'image/png',
      name: 'IMG_0001_edited.png',
      arrayBuffer: async () => Buffer.from('new-fake-bytes').buffer,
    }

    const res = await POST(formRequest(file), routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.version).toBe(2)
    expect(replaceFile).toHaveBeenCalledWith(
      { mockDrive: true },
      'drive_file_1',
      'image/png',
      expect.any(Buffer)
    )
    expect(uploadToBlob).toHaveBeenNthCalledWith(
      1,
      'drive-files/drive_file_1/v2/thumb.jpg',
      Buffer.from('thumb-v2'),
      'image/jpeg'
    )
    const updateArgs = vi.mocked(prisma.photo.update).mock.calls[0][0] as {
      where: { id: string }
      data: { version: number; thumbnailUrl: string; previewUrl: string }
    }
    expect(updateArgs.where.id).toBe('photo_1')
    expect(updateArgs.data.version).toBe(2)
  })
})
