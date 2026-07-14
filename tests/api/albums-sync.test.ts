import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/albums/[albumId]/sync/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { getDriveClientForUser, listFolderFiles } from '@/lib/drive'

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    photo: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}))

vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn(),
  listFolderFiles: vi.fn(),
  isSupportedImageMimeType: (mime: string) => mime.startsWith('image/'),
}))

vi.mock('@/lib/album-permissions', () => ({
  canManageAlbum: vi.fn().mockReturnValue(true),
}))

describe('POST /api/albums/[albumId]/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const req = new Request('http://localhost/api/albums/alb_1/sync', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 if album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as any)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const req = new Request('http://localhost/api/albums/alb_1/sync', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(404)
  })

  it('syncs additions and deletions between Google Drive and DB', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as any)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'alb_1',
      driveFolderId: 'folder_1',
      ownerId: 'user_1',
      coverPhotoId: null,
      owner: { id: 'user_1', encryptedRefreshToken: 'enc_token' },
    } as any)

    vi.mocked(getDriveClientForUser).mockReturnValue({} as any)

    // Drive has file_2 and file_3 (file_1 was deleted on Drive; file_3 is newly added on Drive)
    vi.mocked(listFolderFiles).mockResolvedValue([
      { id: 'file_2', name: 'photo2.jpg', mimeType: 'image/jpeg', thumbnailLink: 'https://lh3.googleusercontent.com/a/file_2=s220' },
      { id: 'file_3', name: 'photo3.jpg', mimeType: 'image/jpeg', thumbnailLink: 'https://lh3.googleusercontent.com/a/file_3=s220' },
    ] as any)

    // DB currently has file_1 and file_2
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { id: 'p_1', driveFileId: 'file_1', originalName: 'photo1.jpg' },
      { id: 'p_2', driveFileId: 'file_2', originalName: 'photo2.jpg' },
    ] as any)

    vi.mocked(prisma.photo.count).mockResolvedValue(2)
    vi.mocked(prisma.photo.deleteMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.photo.create).mockResolvedValue({ id: 'p_3', driveFileId: 'file_3' } as any)

    const req = new Request('http://localhost/api/albums/alb_1/sync', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.synced).toBe(true)
    expect(data.addedCount).toBe(1)
    expect(data.deletedCount).toBe(1)
    expect(prisma.photo.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['p_1'] } },
    })
    expect(prisma.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        albumId: 'alb_1',
        driveFileId: 'file_3',
        originalName: 'photo3.jpg',
      }),
    })
  })
})
