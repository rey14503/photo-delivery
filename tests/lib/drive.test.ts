import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const filesCreate = vi.fn()
const filesUpdate = vi.fn()
const filesDelete = vi.fn()
const filesGet = vi.fn()
const filesList = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function (this: { setCredentials: ReturnType<typeof vi.fn> }) {
        this.setCredentials = vi.fn()
      }),
    },
    drive: vi.fn().mockImplementation(() => ({
      files: {
        create: filesCreate,
        update: filesUpdate,
        delete: filesDelete,
        get: filesGet,
        list: filesList,
      },
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
  downloadOriginal,
  dedupeFilename,
  parseDriveFolderId,
  canEditFolder,
  findOrCreateFolder,
  isSupportedImageMimeType,
  listFolderFiles,
  driveFolderIsGone,
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
      supportsAllDrives: true,
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
      supportsAllDrives: true,
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
      supportsAllDrives: true,
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

describe('downloadOriginal', () => {
  it('fetches metadata then content, returning a buffer with mimeType and name', async () => {
    filesGet
      .mockResolvedValueOnce({ data: { name: 'IMG_0001.jpg', mimeType: 'image/jpeg' } })
      .mockResolvedValueOnce({ data: new TextEncoder().encode('fake-bytes').buffer })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const result = await downloadOriginal(drive, 'drive_file_1')

    expect(result.mimeType).toBe('image/jpeg')
    expect(result.name).toBe('IMG_0001.jpg')
    expect(Buffer.from(result.buffer).toString()).toBe('fake-bytes')
    expect(filesGet).toHaveBeenNthCalledWith(1, { fileId: 'drive_file_1', fields: 'name,mimeType', supportsAllDrives: true })
    expect(filesGet).toHaveBeenNthCalledWith(
      2,
      { fileId: 'drive_file_1', alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
  })

  it('falls back to sensible defaults when Drive omits mimeType/name', async () => {
    filesGet
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: new TextEncoder().encode('bytes').buffer })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const result = await downloadOriginal(drive, 'drive_file_1')

    expect(result.mimeType).toBe('application/octet-stream')
    expect(result.name).toBe('photo')
  })
})

describe('dedupeFilename', () => {
  it('returns the name unchanged on first occurrence', () => {
    const seen = new Map<string, number>()

    expect(dedupeFilename('IMG_0001.jpg', seen)).toBe('IMG_0001.jpg')
  })

  it('inserts " (1)" before the extension on the second occurrence', () => {
    const seen = new Map<string, number>()

    dedupeFilename('IMG_0001.jpg', seen)
    expect(dedupeFilename('IMG_0001.jpg', seen)).toBe('IMG_0001 (1).jpg')
  })

  it('inserts " (2)" before the extension on the third occurrence', () => {
    const seen = new Map<string, number>()

    dedupeFilename('IMG_0001.jpg', seen)
    dedupeFilename('IMG_0001.jpg', seen)
    expect(dedupeFilename('IMG_0001.jpg', seen)).toBe('IMG_0001 (2).jpg')
  })

  it('appends the suffix directly when the name has no extension', () => {
    const seen = new Map<string, number>()

    dedupeFilename('IMG_0001', seen)
    expect(dedupeFilename('IMG_0001', seen)).toBe('IMG_0001 (1)')
  })

  it('appends the suffix directly for a leading-dot name with no meaningful extension', () => {
    const seen = new Map<string, number>()

    dedupeFilename('.gitignore', seen)
    expect(dedupeFilename('.gitignore', seen)).toBe('.gitignore (1)')
  })

  it('keeps independent counters for different names', () => {
    const seen = new Map<string, number>()

    dedupeFilename('one.jpg', seen)
    expect(dedupeFilename('two.jpg', seen)).toBe('two.jpg')
    expect(dedupeFilename('one.jpg', seen)).toBe('one (1).jpg')
    expect(dedupeFilename('two.jpg', seen)).toBe('two (1).jpg')
  })
})

describe('parseDriveFolderId', () => {
  it('extracts the id from a folder link with a trailing query string', () => {
    expect(
      parseDriveFolderId('https://drive.google.com/drive/folders/1A_bC-2Demo?usp=sharing')
    ).toBe('1A_bC-2Demo')
  })

  it('extracts the id from a bare folder link with no query string', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/1A_bC-2Demo')).toBe(
      '1A_bC-2Demo'
    )
  })

  it('returns null for an unrelated URL', () => {
    expect(parseDriveFolderId('https://example.com/not-drive')).toBeNull()
  })

  it('returns null for a bare folder id with no URL wrapper', () => {
    expect(parseDriveFolderId('1A_bC-2Demo')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseDriveFolderId('')).toBeNull()
  })
})

describe('canEditFolder', () => {
  it('returns true for an editable, non-trashed folder', async () => {
    filesGet.mockResolvedValue({
      data: {
        mimeType: 'application/vnd.google-apps.folder',
        trashed: false,
        capabilities: { canEdit: true },
      },
    })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await canEditFolder(drive, 'folder_1')).toBe(true)
    expect(filesGet).toHaveBeenCalledWith({
      fileId: 'folder_1',
      fields: 'mimeType,trashed,capabilities',
      supportsAllDrives: true,
    })
  })

  it('returns false for a view-only folder', async () => {
    filesGet.mockResolvedValue({
      data: {
        mimeType: 'application/vnd.google-apps.folder',
        trashed: false,
        capabilities: { canEdit: false },
      },
    })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await canEditFolder(drive, 'folder_1')).toBe(false)
  })

  it('returns false when the id resolves to a file, not a folder', async () => {
    filesGet.mockResolvedValue({
      data: { mimeType: 'image/jpeg', trashed: false, capabilities: { canEdit: true } },
    })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await canEditFolder(drive, 'file_1')).toBe(false)
  })

  it('returns false for a trashed folder', async () => {
    filesGet.mockResolvedValue({
      data: {
        mimeType: 'application/vnd.google-apps.folder',
        trashed: true,
        capabilities: { canEdit: true },
      },
    })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await canEditFolder(drive, 'folder_1')).toBe(false)
  })

  it('returns false when the Drive API call throws (not found / no access)', async () => {
    filesGet.mockRejectedValue(new Error('File not found'))
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await canEditFolder(drive, 'missing_folder')).toBe(false)
  })
})

describe('findOrCreateFolder', () => {
  it('reuses an existing subfolder with the given name instead of creating one', async () => {
    filesList.mockResolvedValue({ data: { files: [{ id: 'existing_selected' }] } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await findOrCreateFolder(drive, 'Selected', 'parent_folder')

    expect(id).toBe('existing_selected')
    expect(filesCreate).not.toHaveBeenCalled()
    expect(filesList).toHaveBeenCalledWith({
      q: "'parent_folder' in parents and name = 'Selected' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
  })

  it('creates a new subfolder when none exists with that name', async () => {
    filesList.mockResolvedValue({ data: { files: [] } })
    filesCreate.mockResolvedValue({ data: { id: 'new_selected' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await findOrCreateFolder(drive, 'Selected', 'parent_folder')

    expect(id).toBe('new_selected')
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: {
        name: 'Selected',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['parent_folder'],
      },
      fields: 'id',
      supportsAllDrives: true,
    })
  })
})

describe('isSupportedImageMimeType', () => {
  it('returns true for jpeg, png, and webp', () => {
    expect(isSupportedImageMimeType('image/jpeg')).toBe(true)
    expect(isSupportedImageMimeType('image/png')).toBe(true)
    expect(isSupportedImageMimeType('image/webp')).toBe(true)
  })

  it('returns false for RAW, sidecar, video, and other mime types', () => {
    expect(isSupportedImageMimeType('image/x-sony-arw')).toBe(false)
    expect(isSupportedImageMimeType('application/octet-stream')).toBe(false)
    expect(isSupportedImageMimeType('video/mp4')).toBe(false)
  })
})

describe('listFolderFiles', () => {
  it('lists every non-trashed direct child of the folder, unfiltered by type', async () => {
    filesList.mockResolvedValue({
      data: {
        files: [
          { id: 'f1', name: 'IMG_0001.jpg', mimeType: 'image/jpeg' },
          { id: 'f2', name: 'IMG_0001.ARW', mimeType: 'image/x-sony-arw' },
          { id: 'f3', name: 'IMG_0001.xmp', mimeType: 'application/octet-stream' },
        ],
      },
    })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const files = await listFolderFiles(drive, 'folder_1')

    expect(files).toEqual([
      { id: 'f1', name: 'IMG_0001.jpg', mimeType: 'image/jpeg' },
      { id: 'f2', name: 'IMG_0001.ARW', mimeType: 'image/x-sony-arw' },
      { id: 'f3', name: 'IMG_0001.xmp', mimeType: 'application/octet-stream' },
    ])
    expect(filesList).toHaveBeenCalledWith({
      q: "'folder_1' in parents and trashed = false",
      fields: 'files(id,name,mimeType,thumbnailLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
  })

  it('returns an empty array when the folder has no children', async () => {
    filesList.mockResolvedValue({ data: {} })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await listFolderFiles(drive, 'empty_folder')).toEqual([])
  })
})

describe('driveFolderIsGone', () => {
  it('returns true when the folder resolves as trashed', async () => {
    filesGet.mockResolvedValue({ data: { trashed: true } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await driveFolderIsGone(drive, 'folder_1')).toBe(true)
    expect(filesGet).toHaveBeenCalledWith({ fileId: 'folder_1', fields: 'trashed', supportsAllDrives: true })
  })

  it('returns true when the Drive API responds with a 404 not-found error', async () => {
    filesGet.mockRejectedValue({ code: 404, message: 'File not found' })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await driveFolderIsGone(drive, 'missing_folder')).toBe(true)
  })

  it('returns false for a successful, non-trashed response', async () => {
    filesGet.mockResolvedValue({ data: { trashed: false } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await driveFolderIsGone(drive, 'folder_1')).toBe(false)
  })

  it('returns false (never true) for a non-404 error, e.g. a transient network failure', async () => {
    filesGet.mockRejectedValue(new Error('network down'))
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await driveFolderIsGone(drive, 'folder_1')).toBe(false)
  })

  it('returns false for a 403 permission error (ambiguous, not a confirmed deletion)', async () => {
    filesGet.mockRejectedValue({ code: 403, message: 'Forbidden' })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await driveFolderIsGone(drive, 'folder_1')).toBe(false)
  })
})
