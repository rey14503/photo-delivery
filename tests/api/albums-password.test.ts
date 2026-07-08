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
import { POST } from '@/app/api/albums/[albumId]/password/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums/[albumId]/password', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))

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

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('hashes and stores a new password', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({
      id: 'album_1',
      passwordHash: 'some-bcrypt-hash',
    } as never)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ id: 'album_1', hasPassword: true })
    const updateArgs = vi.mocked(prisma.album.update).mock.calls[0][0] as {
      where: { id: string }
      data: { passwordHash: string | null }
    }
    expect(updateArgs.where.id).toBe('album_1')
    expect(updateArgs.data.passwordHash).not.toBeNull()
    expect(updateArgs.data.passwordHash).not.toBe('secret')
  })

  it('clears the password when given null', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({
      id: 'album_1',
      passwordHash: null,
    } as never)

    const res = await POST(jsonRequest({ password: null }), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ id: 'album_1', hasPassword: false })
    const updateArgs = vi.mocked(prisma.album.update).mock.calls[0][0] as {
      data: { passwordHash: string | null }
    }
    expect(updateArgs.data.passwordHash).toBeNull()
  })
})
