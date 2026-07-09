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
    album: { findUnique: vi.fn(), delete: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { DELETE } from '@/app/api/albums/[albumId]/route'

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/albums/[albumId]', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a PHOTOGRAPHER does not own the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
    } as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(403)
    expect(prisma.album.delete).not.toHaveBeenCalled()
  })

  it('deletes the album and returns 204 for the owner', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(204)
    expect(prisma.album.delete).toHaveBeenCalledWith({ where: { id: 'album_1' } })
  })

  it('deletes the album and returns 204 for an ADMIN who does not own it', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin_1', role: 'ADMIN' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
    } as never)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(204)
  })
})
