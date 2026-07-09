import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { delete: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  driveFolderIsGone: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { driveFolderIsGone } from '@/lib/drive'
import { deleteAlbumIfDriveFolderGone } from '@/lib/album-lifecycle'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteAlbumIfDriveFolderGone', () => {
  it('deletes the album and returns true when the folder is confirmed gone', async () => {
    vi.mocked(driveFolderIsGone).mockResolvedValue(true)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const result = await deleteAlbumIfDriveFolderGone(
      { mockDrive: true } as never,
      { id: 'album_1', driveFolderId: 'folder_1' }
    )

    expect(result).toBe(true)
    expect(driveFolderIsGone).toHaveBeenCalledWith({ mockDrive: true }, 'folder_1')
    expect(prisma.album.delete).toHaveBeenCalledWith({ where: { id: 'album_1' } })
  })

  it('does not delete the album and returns false when the folder is present', async () => {
    vi.mocked(driveFolderIsGone).mockResolvedValue(false)

    const result = await deleteAlbumIfDriveFolderGone(
      { mockDrive: true } as never,
      { id: 'album_1', driveFolderId: 'folder_1' }
    )

    expect(result).toBe(false)
    expect(prisma.album.delete).not.toHaveBeenCalled()
  })
})
