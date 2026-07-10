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
    user: { findUnique: vi.fn() },
    album: { create: vi.fn(), findMany: vi.fn() },
    photo: { count: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  parseDriveFolderId: vi.fn(),
  canEditFolder: vi.fn(),
  findOrCreateFolder: vi.fn(),
  isSupportedImageMimeType: vi.fn(),
  listFolderFiles: vi.fn(),
  downloadOriginal: vi.fn(),
}))
vi.mock('@/lib/image-processing', () => ({
  processImage: vi.fn(),
}))
vi.mock('@/lib/blob-storage', () => ({
  uploadToBlob: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import {
  parseDriveFolderId,
  canEditFolder,
  findOrCreateFolder,
  isSupportedImageMimeType,
  listFolderFiles,
  downloadOriginal,
} from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { POST, GET } from '@/app/api/albums/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function signIn() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: 'user_1', role: 'PHOTOGRAPHER' },
  } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: 'user_1',
    encryptedRefreshToken: 'cipher',
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(
      jsonRequest({ name: 'Album', clientName: 'Client', driveLink: 'https://drive.google.com/drive/folders/f1' })
    )

    expect(res.status).toBe(401)
  })

  it('returns 400 when name, clientName, or driveLink is missing', async () => {
    signIn()

    const res = await POST(jsonRequest({ name: 'Album', clientName: 'Client' }))

    expect(res.status).toBe(400)
    expect(prisma.album.create).not.toHaveBeenCalled()
  })

  it('returns 404 when the session user is not found in the database', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await POST(
      jsonRequest({ name: 'Album', clientName: 'Client', driveLink: 'https://drive.google.com/drive/folders/f1' })
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 when the Drive link cannot be parsed, without creating anything', async () => {
    signIn()
    vi.mocked(parseDriveFolderId).mockReturnValue(null)

    const res = await POST(
      jsonRequest({ name: 'Wedding', clientName: 'Jane', driveLink: 'not-a-drive-link' })
    )

    expect(res.status).toBe(400)
    expect(prisma.album.create).not.toHaveBeenCalled()
  })

  it('returns 400 when the folder is not accessible with edit permission, without creating anything', async () => {
    signIn()
    vi.mocked(parseDriveFolderId).mockReturnValue('folder_1')
    vi.mocked(canEditFolder).mockResolvedValue(false)

    const res = await POST(
      jsonRequest({
        name: 'Wedding',
        clientName: 'Jane',
        driveLink: 'https://drive.google.com/drive/folders/folder_1',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/edit/i)
    expect(prisma.album.create).not.toHaveBeenCalled()
  })

  it('imports only supported images, skipping everything else, and registers existing Drive file ids', async () => {
    signIn()
    vi.mocked(parseDriveFolderId).mockReturnValue('folder_1')
    vi.mocked(canEditFolder).mockResolvedValue(true)
    vi.mocked(findOrCreateFolder).mockResolvedValue('selected_folder_1')
    vi.mocked(listFolderFiles).mockResolvedValue([
      { id: 'file_jpg', name: 'IMG_0001.jpg', mimeType: 'image/jpeg' },
      { id: 'file_raw', name: 'IMG_0001.ARW', mimeType: 'image/x-sony-arw' },
      { id: 'file_xmp', name: 'IMG_0001.xmp', mimeType: 'application/octet-stream' },
      { id: 'file_png', name: 'IMG_0002.png', mimeType: 'image/png' },
    ])
    vi.mocked(isSupportedImageMimeType).mockImplementation((mimeType: string) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    )
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('bytes'),
      mimeType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    })
    vi.mocked(processImage).mockResolvedValue({
      thumbnail: Buffer.from('thumb'),
      preview: Buffer.from('preview'),
    })
    vi.mocked(uploadToBlob).mockResolvedValue('https://blob/cached.jpg')
    vi.mocked(prisma.photo.count).mockResolvedValue(0)
    vi.mocked(prisma.photo.create).mockResolvedValue({} as never)
    vi.mocked(prisma.album.create).mockResolvedValue({
      id: 'album_1',
      name: 'Wedding',
      clientName: 'Jane',
      driveFolderId: 'folder_1',
      selectedFolderId: 'selected_folder_1',
    } as never)

    const res = await POST(
      jsonRequest({
        name: 'Wedding',
        clientName: 'Jane',
        driveLink: 'https://drive.google.com/drive/folders/folder_1',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.imported).toBe(2)
    expect(data.skipped).toBe(2)
    expect(prisma.photo.create).toHaveBeenCalledTimes(2)
    const createCalls = vi.mocked(prisma.photo.create).mock.calls.map(
      (call) => (call[0] as { data: { driveFileId: string } }).data.driveFileId
    )
    expect(createCalls).toEqual(['file_jpg', 'file_png'])

    const albumCreateArgs = vi.mocked(prisma.album.create).mock.calls[0][0] as {
      data: { driveFolderId: string; selectedFolderId: string; ownerId: string; shareToken: string }
    }
    expect(albumCreateArgs.data.driveFolderId).toBe('folder_1')
    expect(albumCreateArgs.data.selectedFolderId).toBe('selected_folder_1')
    expect(albumCreateArgs.data.ownerId).toBe('user_1')
    expect(typeof albumCreateArgs.data.shareToken).toBe('string')
  })

  it('never calls uploadFile — imported photos register the existing Drive file id', async () => {
    signIn()
    vi.mocked(parseDriveFolderId).mockReturnValue('folder_1')
    vi.mocked(canEditFolder).mockResolvedValue(true)
    vi.mocked(findOrCreateFolder).mockResolvedValue('selected_folder_1')
    vi.mocked(listFolderFiles).mockResolvedValue([
      { id: 'file_jpg', name: 'IMG_0001.jpg', mimeType: 'image/jpeg' },
    ])
    vi.mocked(isSupportedImageMimeType).mockReturnValue(true)
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('bytes'),
      mimeType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    })
    vi.mocked(processImage).mockResolvedValue({
      thumbnail: Buffer.from('thumb'),
      preview: Buffer.from('preview'),
    })
    vi.mocked(uploadToBlob).mockResolvedValue('https://blob/cached.jpg')
    vi.mocked(prisma.photo.count).mockResolvedValue(0)
    vi.mocked(prisma.photo.create).mockResolvedValue({} as never)
    vi.mocked(prisma.album.create).mockResolvedValue({ id: 'album_1' } as never)

    await POST(
      jsonRequest({
        name: 'Wedding',
        clientName: 'Jane',
        driveLink: 'https://drive.google.com/drive/folders/folder_1',
      })
    )

    const driveModule = await import('@/lib/drive')
    expect('uploadFile' in driveModule).toBe(false)
    expect(prisma.photo.create).toHaveBeenCalledTimes(1)
  })

  it('returns a generic 500 when an unexpected error occurs after the album row is created', async () => {
    signIn()
    vi.mocked(parseDriveFolderId).mockReturnValue('folder_1')
    vi.mocked(canEditFolder).mockResolvedValue(true)
    vi.mocked(findOrCreateFolder).mockResolvedValue('selected_folder_1')
    vi.mocked(listFolderFiles).mockRejectedValue(new Error('Drive API error'))
    vi.mocked(prisma.album.create).mockResolvedValue({ id: 'album_1' } as never)

    const res = await POST(
      jsonRequest({
        name: 'Wedding',
        clientName: 'Jane',
        driveLink: 'https://drive.google.com/drive/folders/folder_1',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('Failed to create album')
    expect(JSON.stringify(data)).not.toContain('Drive API error')
  })
})

describe('GET /api/albums', () => {
  it('filters by owner for a photographer', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findMany).mockResolvedValue([])

    await GET()

    expect(prisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } })
    )
  })

  it('returns all albums for an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin_1', role: 'ADMIN' },
    } as never)
    vi.mocked(prisma.album.findMany).mockResolvedValue([])

    await GET()

    expect(prisma.album.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})
