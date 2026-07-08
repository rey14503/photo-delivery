import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  downloadOriginal: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { downloadOriginal } from '@/lib/drive'
import { GET } from '@/app/api/photos/[photoId]/download/route'

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

function photoRow(overrides: { downloadEnabled?: boolean } = {}) {
  return {
    id: 'photo_1',
    driveFileId: 'drive_file_1',
    album: {
      id: 'album_1',
      ownerId: 'user_1',
      passwordHash: null,
      downloadEnabled: overrides.downloadEnabled ?? false,
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/photos/[photoId]/download', () => {
  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('returns 403 for a client when downloads are disabled', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(403)
  })

  it('streams the original for a client when downloads are enabled', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow({ downloadEnabled: true }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('original-bytes'),
      mimeType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    })

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="IMG_0001.jpg"')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString()).toBe('original-bytes')
    expect(downloadOriginal).toHaveBeenCalledWith({ mockDrive: true }, 'drive_file_1')
  })

  it('streams the original for the photographer even when downloads are disabled', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('original-bytes'),
      mimeType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    })

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(200)
  })
})
