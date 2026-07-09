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
    album: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    photo: { findUnique: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from '@/app/api/albums/[albumId]/route'

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/albums/[albumId]', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await DELETE({} as never, routeParams('album_1'))

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

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(403)
    expect(prisma.album.delete).not.toHaveBeenCalled()
  })

  it('deletes the album and returns 204 for the owner', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(204)
    expect(prisma.album.delete).toHaveBeenCalledWith({ where: { id: 'album_1' } })
  })

  it('deletes the album and returns 204 for an ADMIN who does not own it', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin_1', role: 'ADMIN' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
    } as never)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(204)
  })
})

describe('PATCH /api/albums/[albumId]', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

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

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

    expect(res.status).toBe(403)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty name', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)

    const res = await PATCH(jsonRequest({ name: '' }), routeParams('album_1'))

    expect(res.status).toBe(400)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('updates only the name when only name is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1', name: 'New name' } as never)

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

    expect(res.status).toBe(200)
    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { name: 'New name' },
    })
  })

  it('updates only the clientName when only clientName is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1' } as never)

    await PATCH(jsonRequest({ clientName: 'New client' }), routeParams('album_1'))

    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { clientName: 'New client' },
    })
  })

  it('sets coverPhotoId when it belongs to this album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_1',
      albumId: 'album_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1' } as never)

    await PATCH(jsonRequest({ coverPhotoId: 'photo_1' }), routeParams('album_1'))

    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { coverPhotoId: 'photo_1' },
    })
  })

  it('returns 400 when coverPhotoId belongs to a different album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_9',
      albumId: 'some_other_album',
    } as never)

    const res = await PATCH(jsonRequest({ coverPhotoId: 'photo_9' }), routeParams('album_1'))

    expect(res.status).toBe(400)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('returns 400 when coverPhotoId does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await PATCH(jsonRequest({ coverPhotoId: 'missing_photo' }), routeParams('album_1'))

    expect(res.status).toBe(400)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('clears coverPhotoId when explicitly set to null', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1' } as never)

    await PATCH(jsonRequest({ coverPhotoId: null }), routeParams('album_1'))

    expect(prisma.photo.findUnique).not.toHaveBeenCalled()
    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { coverPhotoId: null },
    })
  })
})
