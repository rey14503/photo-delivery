# Create Album via Google Drive Link (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `POST /api/albums`'s "always create a new empty Drive folder" behavior with: parse a Drive folder link the photographer already has photos in → validate the connected account can edit it → adopt it as the album's folder → import every supported image already inside it as `Photo` rows.

**Architecture:** Four small, independently-testable additions to `src/lib/drive.ts` (link parsing, edit-access check, find-or-create for the "Selected" subfolder, listing a folder's direct children) composed together inside a rewritten `POST /api/albums` route. Every Drive/image-processing primitive this needs already exists from Plans 1, 2, and 5 — this plan only adds the new glue, never duplicates existing logic.

**Tech Stack:** Same as every prior plan (Next.js 15, Prisma 5, googleapis, Vitest).

## Global Constraints

- **This plan is backend-only.** `src/components/CreateAlbumForm.tsx`, `src/components/CreateAlbumModal.tsx`, and every other UI file are explicitly out of scope and **must not be modified or even read for behavior assumptions** — a separate, concurrently-active effort owns that form and already has its own Drive-link input field wired to local state. This plan's job is only to make `POST /api/albums` accept `{ name, clientName, driveLink }` and return `{ ...album, imported, skipped }`, so that UI can call it whenever its owner wires it up.
- Before touching anything, run `git status --short` and confirm `src/lib/drive.ts`, `tests/lib/drive.test.ts`, `src/app/api/albums/route.ts`, and `tests/api/albums.test.ts` are not already modified/staged by someone else. If any of them are, stop and report back rather than overwriting — do not use `git checkout`/`stash` to clear someone else's uncommitted work without asking first.
- No schema changes. `Album.driveFolderId`/`Album.selectedFolderId` already exist (Plan 1).
- Reuse existing primitives exactly: `downloadOriginal` (Plan 5) for fetching an existing file's bytes, `processImage` (Plan 2) for thumbnail/preview generation, `uploadToBlob` (Plan 2) for caching them, `createFolder` (Plan 1) for creating a new subfolder. Never reimplement any of these.
- Only files directly inside the linked folder are imported — no recursive subfolder scanning.
- Only `image/jpeg`, `image/png`, and `image/webp` are imported; everything else (RAW formats, `.xmp` sidecars, videos, other subfolders) is silently skipped and counted, never an error.
- This runs synchronously in one HTTP request with no cap on folder size — a known, accepted MVP limitation (same tradeoff Plan 5 made for ZIP downloads). Do not add pagination, background jobs, or a hard file-count limit in this plan.
- Every rejection before the `Album` row is created (bad link, inaccessible folder) must leave no trace in the database — verify this with a test asserting `prisma.album.create` was never called.

---

## File Structure

```
photo-delivery/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── albums/route.ts        (modified: POST rewritten for Drive-link creation + import)
│   └── lib/
│       └── drive.ts                   (modified: +parseDriveFolderId, +canEditFolder, +findOrCreateFolder, +listFolderFiles, +isSupportedImageMimeType)
└── tests/
    ├── api/
    │   └── albums.test.ts             (modified: POST describe block rewritten; GET block untouched)
    └── lib/
        └── drive.test.ts              (modified: adds 16 new tests across 5 new describe blocks)
```

---

### Task 1: Drive service additions

**Files:**
- Modify: `src/lib/drive.ts`
- Modify: `tests/lib/drive.test.ts`

**Interfaces:**
- Produces: `parseDriveFolderId(link: string): string | null`, `canEditFolder(drive, folderId: string): Promise<boolean>`, `findOrCreateFolder(drive, name: string, parentId: string): Promise<string>`, `isSupportedImageMimeType(mimeType: string): boolean`, `listFolderFiles(drive, folderId: string): Promise<DriveFolderFile[]>` where `interface DriveFolderFile { id: string; name: string; mimeType: string }`. Consumed by Task 2 (`POST /api/albums`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/lib/drive.test.ts` with the following (this is the current file with a `filesList` mock added and five new `describe` blocks appended — every existing line above the `dedupeFilename` block's closing is otherwise unchanged):

```ts
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
    expect(filesGet).toHaveBeenNthCalledWith(1, { fileId: 'drive_file_1', fields: 'name,mimeType' })
    expect(filesGet).toHaveBeenNthCalledWith(
      2,
      { fileId: 'drive_file_1', alt: 'media' },
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
      fields: 'mimeType,trashed,capabilities(canEdit)',
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
      fields: 'files(id,name,mimeType)',
    })
  })

  it('returns an empty array when the folder has no children', async () => {
    filesList.mockResolvedValue({ data: {} })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await listFolderFiles(drive, 'empty_folder')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: FAIL — `parseDriveFolderId`, `canEditFolder`, `findOrCreateFolder`, `isSupportedImageMimeType`, and `listFolderFiles` are not exported from `@/lib/drive` (the 19 pre-existing tests still pass).

- [ ] **Step 3: Add the five functions to the end of `src/lib/drive.ts`**

```ts
export function parseDriveFolderId(link: string): string | null {
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export async function canEditFolder(drive: drive_v3.Drive, folderId: string): Promise<boolean> {
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'mimeType,trashed,capabilities(canEdit)',
    })
    return (
      res.data.mimeType === 'application/vnd.google-apps.folder' &&
      res.data.trashed !== true &&
      res.data.capabilities?.canEdit === true
    )
  } catch {
    return false
  }
}

export async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  })
  const existing = res.data.files?.[0]
  if (existing?.id) {
    return existing.id
  }
  return createFolder(drive, name, parentId)
}

const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function isSupportedImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType)
}

export interface DriveFolderFile {
  id: string
  name: string
  mimeType: string
}

export async function listFolderFiles(
  drive: drive_v3.Drive,
  folderId: string
): Promise<DriveFolderFile[]> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType)',
  })
  const files = res.data.files ?? []
  return files
    .filter((file) => file.id && file.name && file.mimeType)
    .map((file) => ({ id: file.id!, name: file.name!, mimeType: file.mimeType! }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: PASS (35 tests: the 19 pre-existing plus 16 new — 5 for `parseDriveFolderId`, 5 for `canEditFolder`, 2 for `findOrCreateFolder`, 2 for `isSupportedImageMimeType`, 2 for `listFolderFiles`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.ts tests/lib/drive.test.ts
git commit -m "Add Drive link-parsing, access-check, folder-reuse, and folder-listing helpers"
```

---

### Task 2: Rewrite `POST /api/albums` for Drive-link creation and photo import

**Files:**
- Modify: `src/app/api/albums/route.ts`
- Modify: `tests/api/albums.test.ts`

**Interfaces:**
- Consumes: `parseDriveFolderId`, `canEditFolder`, `findOrCreateFolder`, `isSupportedImageMimeType`, `listFolderFiles` (Task 1), `downloadOriginal` (Plan 5), `processImage` (Plan 2), `uploadToBlob` (Plan 2).
- Produces: `POST /api/albums` now requires `{ name, clientName, driveLink }` in the body and returns `{ ...album, imported: number, skipped: number }` on success (`201`). This is the contract the concurrently-developed `CreateAlbumForm.tsx` is expected to call — do not change these field names without checking with whoever owns that form first.

**Before you begin:** run `git status --short`. If `src/app/api/albums/route.ts` or `tests/api/albums.test.ts` show as already modified/staged, STOP and report back rather than overwriting — someone else may be mid-edit.

- [ ] **Step 1: Write the failing tests**

Replace the `describe('POST /api/albums', ...)` block in `tests/api/albums.test.ts` (the `describe('GET /api/albums', ...)` block below it, and everything above it, are unchanged — only the mocks at the top need the additions shown here). Full updated file:

```ts
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
    expect(driveModule.uploadFile).toBeUndefined()
    expect(downloadOriginal).toHaveBeenCalledWith({ mockDrive: true }, 'file_jpg')
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
```

- [ ] **Step 2: Run the tests to verify the new/changed POST tests fail**

Run: `npx vitest run tests/api/albums.test.ts`
Expected: FAIL — the current route still expects only `{ name, clientName }`, calls `createAlbumFolders`, and never imports photos (the `GET` tests still pass).

- [ ] **Step 3: Replace the full contents of `src/app/api/albums/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getDriveClientForUser,
  parseDriveFolderId,
  canEditFolder,
  findOrCreateFolder,
  isSupportedImageMimeType,
  listFolderFiles,
  downloadOriginal,
} from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { albumScopeFor } from '@/lib/album-scope'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, clientName, driveLink } = body as {
    name?: string
    clientName?: string
    driveLink?: string
  }
  if (!name || !clientName || !driveLink) {
    return NextResponse.json(
      { error: 'name, clientName, and driveLink are required' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const folderId = parseDriveFolderId(driveLink)
  if (!folderId) {
    return NextResponse.json({ error: 'driveLink is not a valid Google Drive folder link' }, { status: 400 })
  }

  const drive = getDriveClientForUser(user)

  const editable = await canEditFolder(drive, folderId)
  if (!editable) {
    return NextResponse.json(
      {
        error:
          'This folder is not accessible with edit permission. Make sure it is shared with edit access to your connected Google account.',
      },
      { status: 400 }
    )
  }

  try {
    const selectedFolderId = await findOrCreateFolder(drive, 'Selected', folderId)
    const shareToken = randomBytes(16).toString('hex')

    const album = await prisma.album.create({
      data: {
        name,
        clientName,
        ownerId: user.id,
        driveFolderId: folderId,
        selectedFolderId,
        shareToken,
      },
    })

    const files = await listFolderFiles(drive, folderId)
    const imageFiles = files.filter((file) => isSupportedImageMimeType(file.mimeType))
    const skipped = files.length - imageFiles.length

    let displayOrder = await prisma.photo.count({ where: { albumId: album.id } })
    for (const file of imageFiles) {
      const { buffer } = await downloadOriginal(drive, file.id)
      const { thumbnail, preview } = await processImage(buffer)
      const [thumbnailUrl, previewUrl] = await Promise.all([
        uploadToBlob(`drive-files/${file.id}/v1/thumb.jpg`, thumbnail, 'image/jpeg'),
        uploadToBlob(`drive-files/${file.id}/v1/preview.jpg`, preview, 'image/jpeg'),
      ])

      await prisma.photo.create({
        data: {
          albumId: album.id,
          driveFileId: file.id,
          displayOrder,
          thumbnailUrl,
          previewUrl,
        },
      })
      displayOrder += 1
    }

    return NextResponse.json({ ...album, imported: imageFiles.length, skipped }, { status: 201 })
  } catch (error) {
    console.error('Failed to create album:', error)
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(albums)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums.test.ts`
Expected: PASS (9 tests: 7 in the `POST` block, 2 unchanged in the `GET` block).

- [ ] **Step 5: Run the full suite and verify the build**

Run: `npx vitest run` — expect no regressions elsewhere (nothing outside `src/lib/drive.ts` and `src/app/api/albums/route.ts` changed).
Run: `npx tsc --noEmit` — expect no type errors.

Do **not** run `npx next build` as part of this task if `CreateAlbumForm.tsx`/`CreateAlbumModal.tsx` show as modified/in-progress in `git status` — a concurrently-edited file elsewhere in the tree may fail to compile for reasons unrelated to this change, and that is not this task's responsibility to fix. If those files are untouched/stable at the time you run this step, `npx next build` should succeed with no errors from the files this task touched.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/albums/route.ts tests/api/albums.test.ts
git commit -m "Create albums from a Drive folder link, importing existing supported images"
```

---

### Task 3: Manual verification

This exercises the real Drive API behavior (link parsing against a real URL, real edit-permission checks, a real folder listing) that mocks can't fully substitute for. Do this after Task 2 is committed, using a real Drive folder.

**Prerequisites:** a Google Drive folder you own, containing a mix of a few `.jpg`/`.png` files and at least one unsupported file (e.g. a `.txt` or any non-image) to confirm the skip-count behavior.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Create an album via `POST /api/albums` directly**

Since `CreateAlbumForm.tsx` may not yet be wired to send `driveLink` (that's owned by a separate effort), verify this backend directly, e.g. with `curl` while signed in (copy your session cookie from the browser) or via a temporary REST client:

```bash
curl -X POST http://localhost:3000/api/albums \
  -H "Content-Type: application/json" \
  -H "Cookie: <your next-auth session cookie>" \
  -d '{"name":"Test Album","clientName":"Test Client","driveLink":"https://drive.google.com/drive/folders/<your real folder id>"}'
```

Expected: `201` with the created album plus `imported`/`skipped` counts matching what's actually in that folder.

- [ ] **Step 3: Verify in Prisma Studio / the album detail page**

Run `npx prisma studio` (or open `/albums/<id>` in the browser) and confirm: the album's `driveFolderId` matches the folder you linked, a `Selected` subfolder now exists inside that real Drive folder (check Drive directly), and every supported image from the folder now has a corresponding `Photo` row with a working thumbnail.

- [ ] **Step 4: Verify the access-denial path**

Repeat Step 2 with a `driveLink` pointing at a folder your connected account only has view access to (share a folder from a different Google account to yourself as "Viewer" to test this). Expected: `400` with the edit-permission error message, and no album created.

- [ ] **Step 5: Verify the reuse-existing-Selected-folder path**

Create a second album linking a Drive folder that already has its own subfolder literally named `Selected` (create one manually first). Expected: no duplicate "Selected" folder appears — the existing one is reused as `selectedFolderId`.
