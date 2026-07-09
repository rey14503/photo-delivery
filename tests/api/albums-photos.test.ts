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
    album: { findUnique: vi.fn() },
    photo: { count: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  uploadFile: vi.fn(),
}))
vi.mock('@/lib/image-processing', () => ({
  processImage: vi.fn(),
}))
vi.mock('@/lib/blob-storage', () => ({
  uploadToBlob: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { POST } from '@/app/api/albums/[albumId]/photos/route'

function formRequest(file: unknown) {
  return {
    formData: async () => ({
      get: (key: string) => (key === 'file' ? file : null),
    }),
  } as never
}

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums/[albumId]/photos', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a PHOTOGRAPHER does not own the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
      driveFolderId: 'folder_1',
      owner: { id: 'someone_else', encryptedRefreshToken: 'cipher' },
    } as never)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('returns 400 when no file is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
      driveFolderId: 'folder_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    } as never)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(400)
  })

  it('returns 400 when the file is not an image', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
      driveFolderId: 'folder_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    } as never)
    const notAnImage = {
      type: 'text/plain',
      name: 'notes.txt',
      arrayBuffer: async () => Buffer.from('not an image').buffer,
    }

    const res = await POST(formRequest(notAnImage), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('file must be an image')
  })

  it('uploads to Drive, processes the image, caches previews, and creates a Photo row', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
      driveFolderId: 'folder_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    } as never)
    vi.mocked(uploadFile).mockResolvedValue('drive_file_1')
    vi.mocked(processImage).mockResolvedValue({
      thumbnail: Buffer.from('thumb'),
      preview: Buffer.from('preview'),
    })
    vi.mocked(uploadToBlob)
      .mockResolvedValueOnce('https://blob/thumb.jpg')
      .mockResolvedValueOnce('https://blob/preview.jpg')
    vi.mocked(prisma.photo.count).mockResolvedValue(2)
    vi.mocked(prisma.photo.create).mockResolvedValue({
      id: 'photo_1',
      albumId: 'album_1',
      driveFileId: 'drive_file_1',
      version: 1,
      displayOrder: 2,
      thumbnailUrl: 'https://blob/thumb.jpg',
      previewUrl: 'https://blob/preview.jpg',
    } as never)
    const file = {
      type: 'image/jpeg',
      name: 'IMG_0001.jpg',
      arrayBuffer: async () => Buffer.from('fake-bytes').buffer,
    }

    const res = await POST(formRequest(file), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('photo_1')
    expect(uploadFile).toHaveBeenCalledWith(
      { mockDrive: true },
      'folder_1',
      'IMG_0001.jpg',
      'image/jpeg',
      expect.any(Buffer)
    )
    const createArgs = vi.mocked(prisma.photo.create).mock.calls[0][0] as {
      data: { albumId: string; driveFileId: string; displayOrder: number; originalName: string | null }
    }
    expect(createArgs.data.albumId).toBe('album_1')
    expect(createArgs.data.driveFileId).toBe('drive_file_1')
    expect(createArgs.data.displayOrder).toBe(2)
    expect(createArgs.data.originalName).toBe('IMG_0001.jpg')
  })
})
