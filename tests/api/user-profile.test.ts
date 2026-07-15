import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT } from '@/app/api/user/profile/route'
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
      update: vi.fn(),
    },
  },
}))

function jsonRequest(body: unknown) {
  return {
    json: async () => body,
  } as never
}

describe('PUT /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PUT(jsonRequest({ name: 'New Name', studioName: 'Studio PRO', role: 'ADMIN' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if name and studioName are not strings', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    const res = await PUT(jsonRequest({ name: 123 }))
    expect(res.status).toBe(400)
  })

  it('updates the user profile and returns 200 with updated fields', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Khoa Nguyễn',
      studioName: 'Khoa Studio PRO',
      role: 'ADMIN',
    } as any)

    const res = await PUT(jsonRequest({ name: 'Khoa Nguyễn', studioName: 'Khoa Studio PRO', role: 'ADMIN' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      name: 'Khoa Nguyễn',
      studioName: 'Khoa Studio PRO',
      role: 'ADMIN',
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'Khoa Nguyễn', studioName: 'Khoa Studio PRO', role: 'ADMIN' },
      select: { name: true, studioName: true, role: true, avatarUrl: true },
    })
  })
})
