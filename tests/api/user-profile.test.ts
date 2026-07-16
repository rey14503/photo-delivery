import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from '@/app/api/user/profile/route'
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

describe('PUT /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PUT(jsonRequest({ name: 'New Name', studioName: 'Studio PRO' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if name and studioName are not strings', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    const res = await PUT(jsonRequest({ name: 123 }))
    expect(res.status).toBe(400)
  })

  it('updates the user profile and returns 200 with updated fields without altering role', async () => {
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

    const res = await PUT(jsonRequest({ name: 'Khoa Nguyễn', studioName: 'Khoa Studio PRO' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      name: 'Khoa Nguyễn',
      studioName: 'Khoa Studio PRO',
      role: 'ADMIN',
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { name: 'Khoa Nguyễn', studioName: 'Khoa Studio PRO' },
      select: {
        name: true,
        studioName: true,
        role: true,
        avatarUrl: true,
        email: true,
        phone: true,
        facebookUrl: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
        qrCodeUrl: true,
      },
    })
  })

  describe('GET /api/user/profile', () => {
    it('returns 200 and live profile with ADMIN role for admin user', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user_1' },
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        name: 'Khoa Nguyễn',
        studioName: 'Rey',
        role: 'ADMIN',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'khoanguyenfotk5@gmail.com',
        phone: '0987654321',
        facebookUrl: 'https://facebook.com/khoa',
        bankName: 'MBBank',
        bankAccountNumber: '0123456789',
        bankAccountName: 'NGUYEN KHOA',
        qrCodeUrl: 'https://blob.vercel-storage.com/qr.png',
      } as any)

      const res = await GET()
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.role).toBe('OWNER')
      expect(data.studioName).toBe('Rey')
      expect(data.phone).toBe('0987654321')
      expect(data.facebookUrl).toBe('https://facebook.com/khoa')
      expect(data.bankName).toBe('MBBank')
      expect(data.bankAccountNumber).toBe('0123456789')
      expect(data.bankAccountName).toBe('NGUYEN KHOA')
      expect(data.qrCodeUrl).toBe('https://blob.vercel-storage.com/qr.png')
    })
  })

  it('updates the user profile with 6 optional contact/banking fields when provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Khoa Nguyễn',
      studioName: 'Khoa Studio PRO',
      role: 'PHOTOGRAPHER',
      avatarUrl: null,
      phone: '0912345678',
      facebookUrl: 'https://fb.com/test',
      bankName: 'Vietcombank',
      bankAccountNumber: '99998888',
      bankAccountName: 'KHOA PRO',
      qrCodeUrl: 'https://blob.vercel-storage.com/new-qr.png',
    } as any)

    const res = await PUT(
      jsonRequest({
        name: 'Khoa Nguyễn',
        studioName: 'Khoa Studio PRO',
        phone: '0912345678',
        facebookUrl: 'https://fb.com/test',
        bankName: 'Vietcombank',
        bankAccountNumber: '99998888',
        bankAccountName: 'KHOA PRO',
        qrCodeUrl: 'https://blob.vercel-storage.com/new-qr.png',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.phone).toBe('0912345678')
    expect(data.facebookUrl).toBe('https://fb.com/test')
    expect(data.bankName).toBe('Vietcombank')
    expect(data.bankAccountNumber).toBe('99998888')
    expect(data.bankAccountName).toBe('KHOA PRO')
    expect(data.qrCodeUrl).toBe('https://blob.vercel-storage.com/new-qr.png')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        name: 'Khoa Nguyễn',
        studioName: 'Khoa Studio PRO',
        phone: '0912345678',
        facebookUrl: 'https://fb.com/test',
        bankName: 'Vietcombank',
        bankAccountNumber: '99998888',
        bankAccountName: 'KHOA PRO',
        qrCodeUrl: 'https://blob.vercel-storage.com/new-qr.png',
      },
      select: {
        name: true,
        studioName: true,
        role: true,
        avatarUrl: true,
        email: true,
        phone: true,
        facebookUrl: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
        qrCodeUrl: true,
      },
    })
  })
})
