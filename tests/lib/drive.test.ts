import { describe, it, expect, vi, beforeAll } from 'vitest'

const filesCreate = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function () {
        this.setCredentials = vi.fn()
      }),
    },
    drive: vi.fn().mockImplementation(() => ({
      files: { create: filesCreate },
    })),
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-refresh-token'),
}))

import { getDriveClientForUser, createFolder, createAlbumFolders } from '@/lib/drive'
import { google } from 'googleapis'

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
})

import { beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDriveClientForUser', () => {
  it('throws when the user has no refresh token', () => {
    expect(() => getDriveClientForUser({ encryptedRefreshToken: null })).toThrow(
      'User has no stored Drive refresh token'
    )
  })

  it('builds a Drive client from the decrypted refresh token', () => {
    getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })
    expect(google.drive).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3' }))
  })
})

describe('createFolder', () => {
  it('creates a folder with no parent', async () => {
    filesCreate.mockResolvedValue({ data: { id: 'folder_1' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await createFolder(drive, 'My Album')

    expect(id).toBe('folder_1')
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: { name: 'My Album', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    })
  })

  it('creates a folder nested under a parent', async () => {
    filesCreate.mockResolvedValue({ data: { id: 'folder_2' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await createFolder(drive, 'Selected', 'folder_1')

    expect(id).toBe('folder_2')
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: {
        name: 'Selected',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['folder_1'],
      },
      fields: 'id',
    })
  })
})

describe('createAlbumFolders', () => {
  it('creates an album folder and a nested Selected folder', async () => {
    filesCreate
      .mockResolvedValueOnce({ data: { id: 'album_folder' } })
      .mockResolvedValueOnce({ data: { id: 'selected_folder' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const result = await createAlbumFolders(drive, 'Wedding Album')

    expect(result).toEqual({ albumFolderId: 'album_folder', selectedFolderId: 'selected_folder' })
    expect(filesCreate).toHaveBeenNthCalledWith(2, {
      requestBody: {
        name: 'Selected',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['album_folder'],
      },
      fields: 'id',
    })
  })
})
