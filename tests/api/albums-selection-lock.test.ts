// tests/api/albums-selection-lock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/albums/[albumId]/lock-selection/route'
import { PATCH } from '@/app/api/albums/[albumId]/unlock-selection/route'

const findUniqueMock = vi.fn()
const updateMock = vi.fn()
const getServerSessionMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: () => getServerSessionMock(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('Selection Lock & Unlock API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('locks selection when shareToken matches', async () => {
    findUniqueMock.mockResolvedValue({ id: 'alb_1', shareToken: 'tok_abc', ownerId: 'user_1' })
    updateMock.mockResolvedValue({ id: 'alb_1', selectionLocked: true })

    const req = new Request('http://localhost/api/albums/alb_1/lock-selection', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alb_1' },
        data: expect.objectContaining({ selectionLocked: true }),
      })
    )
  })

  it('unlocks selection when photographer is authenticated owner', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user_1' } })
    findUniqueMock.mockResolvedValue({ id: 'alb_1', ownerId: 'user_1' })
    updateMock.mockResolvedValue({ id: 'alb_1', selectionLocked: false })

    const req = new Request('http://localhost/api/albums/alb_1/unlock-selection', {
      method: 'PATCH',
    })
    const res = await PATCH(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alb_1' },
        data: { selectionLocked: false, selectionSubmittedAt: null },
      })
    )
  })

  it('rejects unlock if photographer is not owner', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'other_user' } })
    findUniqueMock.mockResolvedValue({ id: 'alb_1', ownerId: 'user_1' })

    const req = new Request('http://localhost/api/albums/alb_1/unlock-selection', {
      method: 'PATCH',
    })
    const res = await PATCH(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(403)
  })
})
