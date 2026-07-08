import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn() },
    comment: { create: vi.fn() },
  },
}))
vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { POST } from '@/app/api/photos/[photoId]/comments/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

function photoRow() {
  return {
    id: 'photo_1',
    album: { id: 'album_1', ownerId: 'user_1', passwordHash: null },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/photos/[photoId]/comments', () => {
  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ text: 'Nice shot' }), routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await POST(jsonRequest({ text: 'Nice shot' }), routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('returns 400 for an empty comment', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await POST(jsonRequest({ text: '   ' }), routeParams('photo_1'))

    expect(res.status).toBe(400)
  })

  it('returns 400 for a comment over 2000 characters', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await POST(jsonRequest({ text: 'a'.repeat(2001) }), routeParams('photo_1'))

    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-string text value', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await POST(jsonRequest({ text: 123 }), routeParams('photo_1'))

    expect(res.status).toBe(400)
  })

  it('creates a client comment', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: 'comment_1',
      text: 'Nice shot',
      actorType: 'CLIENT',
      actorName: 'Jane Doe',
    } as never)

    const res = await POST(jsonRequest({ text: 'Nice shot' }), routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('comment_1')
    const createArgs = vi.mocked(prisma.comment.create).mock.calls[0][0] as {
      data: { photoId: string; actorType: string; actorName: string | null; userId: string | null; text: string }
    }
    expect(createArgs.data.photoId).toBe('photo_1')
    expect(createArgs.data.actorType).toBe('CLIENT')
    expect(createArgs.data.actorName).toBe('Jane Doe')
    expect(createArgs.data.userId).toBeNull()
    expect(createArgs.data.text).toBe('Nice shot')
  })

  it('creates a photographer comment', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: 'comment_2',
      text: 'Can you crop this tighter?',
      actorType: 'PHOTOGRAPHER',
      userId: 'user_1',
    } as never)

    const res = await POST(
      jsonRequest({ text: 'Can you crop this tighter?' }),
      routeParams('photo_1')
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('comment_2')
    const createArgs = vi.mocked(prisma.comment.create).mock.calls[0][0] as {
      data: { actorType: string; actorName: string | null; userId: string | null }
    }
    expect(createArgs.data.actorType).toBe('PHOTOGRAPHER')
    expect(createArgs.data.actorName).toBeNull()
    expect(createArgs.data.userId).toBe('user_1')
  })
})
