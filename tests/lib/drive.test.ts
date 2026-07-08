import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const filesCreate = vi.fn()
const filesUpdate = vi.fn()
const filesDelete = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function (this: { setCredentials: ReturnType<typeof vi.fn> }) {
        this.setCredentials = vi.fn()
      }),
    },
    drive: vi.fn().mockImplementation(() => ({
      files: { create: filesCreate, update: filesUpdate, delete: filesDelete },
    })),
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-refresh-token'),
}))

import {
  getDriveClientForUser,
  createFolder,
  createAlbumFolders,
  uploadFile,
  replaceFile,
  createShortcut,
  deleteFile,
} from '@/lib/drive'
import { google } from 'googleapis'

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
})

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

describe('uploadFile', () => {
  it('uploads a buffer into the given parent folder and returns the new file id', async () => {
    filesCreate.mockResolvedValue({ data: { id: 'photo_file_1' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })
    const buffer = Buffer.from('fake-image-bytes')

    const id = await uploadFile(drive, 'album_folder', 'IMG_0001.jpg', 'image/jpeg', buffer)

    expect(id).toBe('photo_file_1')
    expect(filesCreate).toHaveBeenCalledTimes(1)
    const callArgs = filesCreate.mock.calls[0][0]
    expect(callArgs.requestBody).toEqual({ name: 'IMG_0001.jpg', parents: ['album_folder'] })
    expect(callArgs.media.mimeType).toBe('image/jpeg')
    expect(callArgs.fields).toBe('id')
  })

  it('throws when Drive does not return a file id', async () => {
    filesCreate.mockResolvedValue({ data: {} })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    await expect(
      uploadFile(drive, 'album_folder', 'IMG_0001.jpg', 'image/jpeg', Buffer.from('x'))
    ).rejects.toThrow('Drive did not return a file id')
  })
})

describe('replaceFile', () => {
  it('replaces the content of an existing file', async () => {
    filesUpdate.mockResolvedValue({ data: { id: 'photo_file_1' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })
    const buffer = Buffer.from('new-fake-image-bytes')

    await replaceFile(drive, 'photo_file_1', 'image/png', buffer)

    expect(filesUpdate).toHaveBeenCalledTimes(1)
    const callArgs = filesUpdate.mock.calls[0][0]
    expect(callArgs.fileId).toBe('photo_file_1')
    expect(callArgs.media.mimeType).toBe('image/png')
  })
})

describe('createShortcut', () => {
  it('creates a shortcut pointing at the target file inside the given parent folder', async () => {
    filesCreate.mockResolvedValue({ data: { id: 'shortcut_1' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await createShortcut(drive, 'photo_file_1', 'selected_folder')

    expect(id).toBe('shortcut_1')
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: {
        name: 'shortcut',
        mimeType: 'application/vnd.google-apps.shortcut',
        parents: ['selected_folder'],
        shortcutDetails: { targetId: 'photo_file_1' },
      },
      fields: 'id',
    })
  })

  it('throws when Drive does not return a shortcut id', async () => {
    filesCreate.mockResolvedValue({ data: {} })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    await expect(createShortcut(drive, 'photo_file_1', 'selected_folder')).rejects.toThrow(
      'Drive did not return a shortcut id'
    )
  })
})

describe('deleteFile', () => {
  it('deletes the given file id', async () => {
    filesDelete.mockResolvedValue({})
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    await deleteFile(drive, 'shortcut_1')

    expect(filesDelete).toHaveBeenCalledWith({ fileId: 'shortcut_1' })
  })
})
