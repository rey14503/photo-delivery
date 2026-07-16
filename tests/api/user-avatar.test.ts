import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/user/avatar/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { uploadToBlob } from '@/lib/blob-storage'

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

vi.mock('@/lib/blob-storage', () => ({
  uploadToBlob: vi.fn(),
}))

describe('POST /api/user/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const formData = new FormData()
    formData.append('file', new Blob(['test image content'], { type: 'image/jpeg' }), 'avatar.jpg')
    const req = new Request('http://localhost/api/user/avatar', { method: 'POST', body: formData })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 if file is missing or not an image', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    const formData = new FormData()
    const req = new Request('http://localhost/api/user/avatar', { method: 'POST', body: formData })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('uploads the avatar image to blob storage and updates user profile', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    vi.mocked(uploadToBlob).mockResolvedValue('https://test-blob.vercel-storage.com/avatars/user_1/avatar.jpg')
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user_1',
      avatarUrl: 'https://test-blob.vercel-storage.com/avatars/user_1/avatar.jpg',
    } as any)

    const formData = new FormData()
    formData.append('file', new Blob(['test image buffer'], { type: 'image/jpeg' }), 'avatar.jpg')
    const req = new Request('http://localhost/api/user/avatar', { method: 'POST', body: formData })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      avatarUrl: 'https://test-blob.vercel-storage.com/avatars/user_1/avatar.jpg',
    })
    expect(uploadToBlob).toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { avatarUrl: 'https://test-blob.vercel-storage.com/avatars/user_1/avatar.jpg' },
      select: { avatarUrl: true },
    })
  })

  it('falls back cleanly when uploadToBlob returns null (e.g., storage suspended)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', email: 'test@example.com' },
    } as any)
    vi.mocked(uploadToBlob).mockResolvedValue(null)
    vi.mocked(prisma.user.update).mockImplementation(async ({ data }: any) => ({
      id: 'user_1',
      avatarUrl: data.avatarUrl,
    }))

    const formData = new FormData()
    formData.append('file', new Blob(['test image buffer'], { type: 'image/jpeg' }), 'avatar.jpg')
    const req = new Request('http://localhost/api/user/avatar', { method: 'POST', body: formData })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.avatarUrl).toBeDefined()
    expect(prisma.user.update).toHaveBeenCalled()
  })
})
