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
    user: { findUnique: vi.fn() },
    album: { create: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  createAlbumFolders: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { createAlbumFolders } from '@/lib/drive'
import { POST, GET } from '@/app/api/albums/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(jsonRequest({ name: 'Album', clientName: 'Client' }))

    expect(res.status).toBe(401)
  })

  it('returns 400 when name or clientName is missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)

    const res = await POST(jsonRequest({ name: 'Album' }))

    expect(res.status).toBe(400)
  })

  it('creates Drive folders and an Album row for a signed-in user', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      encryptedRefreshToken: 'cipher',
    } as never)
    vi.mocked(createAlbumFolders).mockResolvedValue({
      albumFolderId: 'folder_1',
      selectedFolderId: 'folder_2',
    })
    vi.mocked(prisma.album.create).mockResolvedValue({
      id: 'album_1',
      name: 'Wedding',
      clientName: 'Jane',
      driveFolderId: 'folder_1',
      selectedFolderId: 'folder_2',
    } as never)

    const res = await POST(jsonRequest({ name: 'Wedding', clientName: 'Jane' }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('album_1')
    expect(createAlbumFolders).toHaveBeenCalledWith({ mockDrive: true }, 'Wedding')
    const createArgs = vi.mocked(prisma.album.create).mock.calls[0][0] as {
      data: { driveFolderId: string; selectedFolderId: string; ownerId: string; shareToken: string }
    }
    expect(createArgs.data.driveFolderId).toBe('folder_1')
    expect(createArgs.data.selectedFolderId).toBe('folder_2')
    expect(createArgs.data.ownerId).toBe('user_1')
    expect(typeof createArgs.data.shareToken).toBe('string')
  })
})

describe('GET /api/albums', () => {
  it('filters by owner for a photographer', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findMany).mockResolvedValue([])

    await GET()

    expect(prisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } })
    )
  })

  it('returns all albums for an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin_1', role: 'ADMIN' },
    } as never)
    vi.mocked(prisma.album.findMany).mockResolvedValue([])

    await GET()

    expect(prisma.album.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})
