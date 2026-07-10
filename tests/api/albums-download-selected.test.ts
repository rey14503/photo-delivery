import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn() },
    photo: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/drive', async () => {
  const actual = await vi.importActual<typeof import('@/lib/drive')>('@/lib/drive')
  return {
    ...actual,
    getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
    downloadOriginal: vi.fn(),
  }
})

import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { getServerSession } from 'next-auth'
import { downloadOriginal } from '@/lib/drive'
import { POST } from '@/app/api/albums/[albumId]/download-selected/route'

describe('Download Selected ZIP API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams ZIP containing requested selected photo IDs when authorized via shareToken', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'alb_1',
      name: 'Test Album',
      shareToken: 'tok_abc',
      downloadEnabled: true,
      owner: { id: 'usr_1', encryptedRefreshToken: 'xyz' },
    } as never)
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { id: 'photo_1', driveFileId: 'drv_1', originalName: 'IMG_1.JPG', displayOrder: 0 },
    ] as never)
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('fake image data'),
      mimeType: 'image/jpeg',
      name: 'IMG_1.JPG',
    })

    const req = new Request('http://localhost/api/albums/alb_1/download-selected', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc', photoIds: ['photo_1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('zip')

    const zipBuffer = Buffer.from(await res.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBuffer)
    expect(Object.keys(zip.files)).toEqual(['IMG_1.JPG'])
    expect(await zip.file('IMG_1.JPG')!.async('string')).toBe('fake image data')
  })

  it('rejects download if downloadEnabled is false and no photographer session', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'alb_1',
      shareToken: 'tok_abc',
      downloadEnabled: false,
      owner: { id: 'usr_1', encryptedRefreshToken: 'xyz' },
    } as never)
    vi.mocked(resolveActor).mockResolvedValue(null)
    vi.mocked(getServerSession).mockResolvedValue(null)

    const req = new Request('http://localhost/api/albums/alb_1/download-selected', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc', photoIds: ['photo_1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(403)
  })

  it('allows download for photographer even when downloadEnabled is false', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'alb_1',
      name: 'Test Album',
      ownerId: 'usr_1',
      downloadEnabled: false,
      owner: { id: 'usr_1', encryptedRefreshToken: 'xyz' },
    } as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'usr_1' })
    vi.mocked(prisma.photo.findMany).mockResolvedValue([
      { id: 'photo_1', driveFileId: 'drv_1', originalName: 'IMG_1.JPG', displayOrder: 0 },
    ] as never)
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('fake image data'),
      mimeType: 'image/jpeg',
      name: 'IMG_1.JPG',
    })

    const req = new Request('http://localhost/api/albums/alb_1/download-selected', {
      method: 'POST',
      body: JSON.stringify({ photoIds: ['photo_1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('zip')
  })

  it('returns 404 when photoIds match 0 photos', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'alb_1',
      shareToken: 'tok_abc',
      downloadEnabled: true,
      owner: { id: 'usr_1', encryptedRefreshToken: 'xyz' },
    } as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(prisma.photo.findMany).mockResolvedValue([])

    const req = new Request('http://localhost/api/albums/alb_1/download-selected', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc', photoIds: ['non_existent_id'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never, { params: Promise.resolve({ albumId: 'alb_1' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: 'No valid photos found for download' })
  })
})

