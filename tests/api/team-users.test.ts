import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/team/users/route'
import { PATCH } from '@/app/api/team/users/[userId]/role/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

function jsonRequest(body: unknown) {
  return {
    json: async () => body,
  } as never
}

describe('Team Users API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAIL = 'owner@example.com'
  })

  describe('GET /api/team/users', () => {
    it('returns 401 if user is not authenticated or not OWNER/ADMIN', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'u1', role: 'PHOTOGRAPHER' },
      } as any)
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it('returns 200 and user list if user is OWNER', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'u1', role: 'OWNER' },
      } as any)
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'u1', email: 'owner@example.com', role: 'OWNER' },
        { id: 'u2', email: 'photo@example.com', role: 'PHOTOGRAPHER' },
      ] as any)

      const res = await GET()
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data).toHaveLength(2)
    })
  })

  describe('PATCH /api/team/users/[userId]/role', () => {
    it('returns 403 if requester is not OWNER (`tài khoản gốc`)', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'u2', role: 'ADMIN', email: 'admin@example.com' },
      } as any)
      const res = await PATCH(jsonRequest({ role: 'ADMIN' }), { params: { userId: 'u3' } })
      expect(res.status).toBe(403)
    })

    it('returns 200 and updates role when requester is OWNER (`tài khoản gốc`)', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'u1', role: 'OWNER', email: 'owner@example.com' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u3',
        email: 'member@example.com',
        role: 'PHOTOGRAPHER',
      } as any)
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'u3',
        email: 'member@example.com',
        role: 'ADMIN',
      } as any)

      const res = await PATCH(jsonRequest({ role: 'ADMIN' }), { params: { userId: 'u3' } })
      const data = await res.json()
      expect(res.status).toBe(200)
      expect(data.role).toBe('ADMIN')
    })
  })
})
