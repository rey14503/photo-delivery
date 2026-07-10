import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn() },
    like: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}))
vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
  actorKeyFor: vi.fn(),
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  createShortcut: vi.fn(),
  deleteFile: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { createShortcut, deleteFile } from '@/lib/drive'
import { POST } from '@/app/api/photos/[photoId]/like/route'

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

function photoRow() {
  return {
    id: 'photo_1',
    driveFileId: 'drive_file_1',
    album: {
      id: 'album_1',
      selectedFolderId: 'selected_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/photos/[photoId]/like', () => {
  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await POST({} as never, routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await POST({} as never, routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('creates a client like and a Drive shortcut when none exists yet', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(actorKeyFor).mockReturnValue('client:Jane Doe')
    vi.mocked(prisma.like.findUnique).mockResolvedValue(null)
    vi.mocked(createShortcut).mockResolvedValue('shortcut_1')
    vi.mocked(prisma.like.create).mockResolvedValue({} as never)

    const res = await POST({} as never, routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ liked: true })
    expect(createShortcut).toHaveBeenCalledWith({ mockDrive: true }, 'drive_file_1', 'selected_1')
    const createArgs = vi.mocked(prisma.like.create).mock.calls[0][0] as {
      data: {
        actorType: string
        actorName: string | null
        userId: string | null
        driveShortcutId: string | null
      }
    }
    expect(createArgs.data.actorType).toBe('CLIENT')
    expect(createArgs.data.actorName).toBe('Jane Doe')
    expect(createArgs.data.driveShortcutId).toBe('shortcut_1')
  })

  it('creates a photographer like without touching Drive', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(actorKeyFor).mockReturnValue('photographer:user_1')
    vi.mocked(prisma.like.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.like.create).mockResolvedValue({} as never)

    const res = await POST({} as never, routeParams('photo_1'))

    expect(res.status).toBe(200)
    expect(createShortcut).not.toHaveBeenCalled()
    const createArgs = vi.mocked(prisma.like.create).mock.calls[0][0] as {
      data: { actorType: string; userId: string | null; driveShortcutId: string | null }
    }
    expect(createArgs.data.actorType).toBe('PHOTOGRAPHER')
    expect(createArgs.data.userId).toBe('user_1')
    expect(createArgs.data.driveShortcutId).toBeNull()
  })

  it('removes an existing client like and deletes its Drive shortcut', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(actorKeyFor).mockReturnValue('client:Jane Doe')
    vi.mocked(prisma.like.findUnique).mockResolvedValue({
      id: 'like_1',
      driveShortcutId: 'shortcut_1',
    } as never)
    vi.mocked(prisma.like.delete).mockResolvedValue({} as never)

    const res = await POST({} as never, routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ liked: false })
    expect(deleteFile).toHaveBeenCalledWith({ mockDrive: true }, 'shortcut_1')
    expect(prisma.like.delete).toHaveBeenCalledWith({ where: { id: 'like_1' } })
  })

  it('still removes the like row when deleting the Drive shortcut fails', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(actorKeyFor).mockReturnValue('client:Jane Doe')
    vi.mocked(prisma.like.findUnique).mockResolvedValue({
      id: 'like_1',
      driveShortcutId: 'shortcut_1',
    } as never)
    vi.mocked(deleteFile).mockRejectedValue(new Error('shortcut already deleted'))
    vi.mocked(prisma.like.delete).mockResolvedValue({} as never)

    const res = await POST({} as never, routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ liked: false })
    expect(deleteFile).toHaveBeenCalledWith({ mockDrive: true }, 'shortcut_1')
    expect(prisma.like.delete).toHaveBeenCalledWith({ where: { id: 'like_1' } })
  })

  it('removes an existing photographer like without touching Drive', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(actorKeyFor).mockReturnValue('photographer:user_1')
    vi.mocked(prisma.like.findUnique).mockResolvedValue({
      id: 'like_2',
      driveShortcutId: null,
    } as never)
    vi.mocked(prisma.like.delete).mockResolvedValue({} as never)

    const res = await POST({} as never, routeParams('photo_1'))

    expect(res.status).toBe(200)
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('returns 403 when selectionLocked is true and actor type is CLIENT', async () => {
    const lockedPhoto = {
      ...photoRow(),
      album: {
        ...photoRow().album,
        selectionLocked: true,
      },
    }
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(lockedPhoto as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await POST({} as never, routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data).toEqual({ error: 'Album proofing selection is locked' })
  })
})

