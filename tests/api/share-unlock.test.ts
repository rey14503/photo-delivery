import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { unlockToken } from '@/lib/album-unlock'
import { POST } from '@/app/api/share/[shareToken]/unlock/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(shareToken: string) {
  return { params: Promise.resolve({ shareToken }) }
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/share/[shareToken]/unlock', () => {
  it('returns 404 when the album does not exist', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('bad-token'))

    expect(res.status).toBe(404)
  })

  it('returns 400 when the album has no password set', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      passwordHash: null,
    } as never)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('token_1'))

    expect(res.status).toBe(400)
  })

  it('returns 401 when the password is incorrect', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      passwordHash: 'hashed',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const res = await POST(jsonRequest({ password: 'wrong' }), routeParams('token_1'))

    expect(res.status).toBe(401)
  })

  it('sets the unlock cookie and returns success on a correct password', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      passwordHash: 'hashed',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const res = await POST(jsonRequest({ password: 'correct' }), routeParams('token_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    const cookie = res.cookies.get('album_unlock_album_1')
    expect(cookie?.value).toBe(unlockToken('album_1'))
  })
})
