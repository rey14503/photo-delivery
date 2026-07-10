// tests/api/albums-selection-lock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/albums/[albumId]/lock-selection/route'
import { PATCH } from '@/app/api/albums/[albumId]/unlock-selection/route'

const findUniqueMock = vi.fn()
const updateMock = vi.fn()
const getServerSessionMock = vi.fn()
const resolveActorMock = vi.fn()
const isUnlockedMock = vi.fn()

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

vi.mock('@/lib/actor', () => ({
  resolveActor: (...args: unknown[]) => resolveActorMock(...args),
}))

vi.mock('@/lib/album-unlock', () => ({
  albumUnlockCookieName: (id: string) => `unlock_${id}`,
  isUnlocked: (...args: unknown[]) => isUnlockedMock(...args),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

describe('Selection Lock & Unlock API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('locks selection when shareToken matches without password', async () => {
    resolveActorMock.mockResolvedValue(null)
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

  it('locks selection when actor is resolved as CLIENT', async () => {
    resolveActorMock.mockResolvedValue({ type: 'CLIENT', name: 'Jane' })
    findUniqueMock.mockResolvedValue({ id: 'alb_1', ownerId: 'user_1' })
    updateMock.mockResolvedValue({ id: 'alb_1', selectionLocked: true })

    const req = new Request('http://localhost/api/albums/alb_1/lock-selection', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
  })

  it('locks selection when actor is resolved as PHOTOGRAPHER', async () => {
    resolveActorMock.mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    findUniqueMock.mockResolvedValue({ id: 'alb_1', ownerId: 'user_1' })
    updateMock.mockResolvedValue({ id: 'alb_1', selectionLocked: true })

    const req = new Request('http://localhost/api/albums/alb_1/lock-selection', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
  })

  it('rejects lock if actor is null and shareToken does not match', async () => {
    resolveActorMock.mockResolvedValue(null)
    findUniqueMock.mockResolvedValue({ id: 'alb_1', shareToken: 'real_token', ownerId: 'user_1' })

    const req = new Request('http://localhost/api/albums/alb_1/lock-selection', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'wrong_token' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects lock if album is password protected, shareToken matches, but not unlocked and actor not resolved', async () => {
    resolveActorMock.mockResolvedValue(null)
    isUnlockedMock.mockReturnValue(false)
    findUniqueMock.mockResolvedValue({ id: 'alb_1', shareToken: 'tok_abc', passwordHash: 'hash', ownerId: 'user_1' })

    const req = new Request('http://localhost/api/albums/alb_1/lock-selection', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(401)
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
