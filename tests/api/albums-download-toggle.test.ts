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
    album: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/albums/[albumId]/download-toggle/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums/[albumId]/download-toggle', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))

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

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('returns 400 when enabled is not a boolean', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)

    const res = await POST(jsonRequest({ enabled: 'yes' }), routeParams('album_1'))

    expect(res.status).toBe(400)
  })

  it('enables downloads', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({
      id: 'album_1',
      downloadEnabled: true,
    } as never)

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ id: 'album_1', downloadEnabled: true })
    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { downloadEnabled: true },
    })
  })
})
