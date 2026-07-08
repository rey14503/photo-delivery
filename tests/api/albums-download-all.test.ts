import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn() },
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
import { GET } from '@/app/api/albums/[albumId]/download-all/route'

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

function albumRow(overrides: { downloadEnabled?: boolean } = {}) {
  return {
    id: 'album_1',
    name: 'Wedding',
    ownerId: 'user_1',
    passwordHash: null,
    downloadEnabled: overrides.downloadEnabled ?? false,
    owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    photos: [
      { id: 'photo_1', driveFileId: 'drive_file_1', displayOrder: 0 },
      { id: 'photo_2', driveFileId: 'drive_file_2', displayOrder: 1 },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/albums/[albumId]/download-all', () => {
  it('returns 404 when the album does not exist', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 403 for a client when downloads are disabled', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('builds a real zip containing every photo for a client when downloads are enabled', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow({ downloadEnabled: true }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(downloadOriginal)
      .mockResolvedValueOnce({ buffer: Buffer.from('photo-one'), mimeType: 'image/jpeg', name: 'one.jpg' })
      .mockResolvedValueOnce({ buffer: Buffer.from('photo-two'), mimeType: 'image/jpeg', name: 'two.jpg' })

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')

    const zipBuffer = Buffer.from(await res.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBuffer)
    expect(Object.keys(zip.files).sort()).toEqual(['one.jpg', 'two.jpg'])
    expect(await zip.file('one.jpg')!.async('string')).toBe('photo-one')
    expect(await zip.file('two.jpg')!.async('string')).toBe('photo-two')
  })

  it('builds the zip for the photographer even when downloads are disabled', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('x'),
      mimeType: 'image/jpeg',
      name: 'x.jpg',
    })

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(200)
  })
})
