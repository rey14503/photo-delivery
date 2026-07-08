# Upload & Versioning (Plan 2 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a photographer upload photos into an existing album (each photo lands in the album's Drive folder) and replace an existing photo's file (bumping a version counter), with cached thumbnail/preview images so the gallery loads fast without hitting Drive on every view.

**Architecture:** Two new Drive-service functions (`uploadFile`, `replaceFile`) wrap `files.create`/`files.update` with media bodies. A `sharp`-based image-processing module produces a thumbnail (≤400px) and preview (≤1600px) JPEG from the uploaded bytes. Both are cached in Vercel Blob, keyed by the Drive file ID and version so a replace naturally invalidates the old cache entry (matches the spec's "cache key = revisionId/version" strategy). Two new API routes orchestrate Drive + image processing + Blob + Prisma. A new `Photo` Prisma model tracks `driveFileId`, `version`, `displayOrder`, and the two cached URLs. The album detail page renders the photo grid and upload/replace controls.

**Tech Stack:** Builds on Plan 1's stack (Next.js 15, Prisma 5, next-auth 4, googleapis, Vitest). Adds `sharp` (image resizing) and `@vercel/blob` (cached-preview storage).

## Global Constraints

- Single-tenant: no per-studio scoping (unchanged from Plan 1).
- Google OAuth scope is `drive.file` only — this plan must not request or use any broader Drive scope.
- **All Drive operations on an album must use the album OWNER's stored Drive credentials, never the currently-signed-in session user's.** An ADMIN managing a photographer's album has their own separate Google account/Drive — writing to the photographer's Drive folder is only possible using the photographer's own stored refresh token (the `drive.file` scope is per-account and does not grant cross-account access). Every route in this plan must fetch the album's `owner` relation and call `getDriveClientForUser(album.owner)`, not `getDriveClientForUser(sessionUser)`.
- No watermarking, no email sending, no real-time/WebSocket infra.
- No version-history/revert UI and no `PhotoVersion` table — a photo replace only increments `Photo.version`; Drive's own revision history is left untouched and unused (per spec §4).
- No `Like`/`Comment` tables or functionality — those belong to Plan 4.
- No client-facing (share-link) view, no download-permission enforcement — those belong to Plans 3 and 5. This plan's UI is photographer-facing only (same authenticated `/albums/...` area as Plan 1).

---

## File Structure

```
photo-delivery/
├── package.json                                    (modified: +sharp, +@vercel/blob)
├── .env.example                                    (modified: +BLOB_READ_WRITE_TOKEN)
├── prisma/
│   └── schema.prisma                                (modified: +Photo model, Album.photos)
├── src/
│   ├── app/
│   │   ├── albums/
│   │   │   └── [albumId]/
│   │   │       └── page.tsx                         (new)
│   │   └── api/
│   │       ├── albums/
│   │       │   └── [albumId]/
│   │       │       └── photos/route.ts               (new)
│   │       └── photos/
│   │           └── [photoId]/
│   │               └── replace/route.ts               (new)
│   ├── components/
│   │   ├── UploadPhotos.tsx                          (new)
│   │   └── ReplacePhotoButton.tsx                     (new)
│   └── lib/
│       ├── drive.ts                                  (modified: +uploadFile, +replaceFile)
│       ├── image-processing.ts                       (new)
│       ├── blob-storage.ts                            (new)
│       └── album-permissions.ts                       (new)
└── tests/
    ├── lib/
    │   ├── drive.test.ts                              (modified: +uploadFile/replaceFile tests)
    │   ├── image-processing.test.ts                    (new)
    │   ├── blob-storage.test.ts                        (new)
    │   └── album-permissions.test.ts                   (new)
    ├── api/
    │   ├── albums-photos.test.ts                       (new)
    │   └── photos-replace.test.ts                      (new)
    └── components/
        ├── UploadPhotos.test.tsx                       (new)
        └── ReplacePhotoButton.test.tsx                  (new)
```

---

### Task 1: `Photo` Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma-generated `Photo` type — `{ id: string; albumId: string; driveFileId: string; version: number; displayOrder: number; thumbnailUrl: string; previewUrl: string; createdAt: Date; updatedAt: Date }`. Consumed by every later task in this plan.

No unit test for this task (schema/migration only) — verified by a successful migration and `next build`, same approach as Plan 1's Task 2.

- [ ] **Step 1: Add the `Photo` model and the `Album.photos` relation**

Edit `prisma/schema.prisma` — add `photos Photo[]` to the existing `Album` model, and add a new `Photo` model below it:

```prisma
model Album {
  id               String   @id @default(cuid())
  name             String
  clientName       String
  ownerId          String
  owner            User     @relation(fields: [ownerId], references: [id])
  driveFolderId    String
  selectedFolderId String
  shareToken       String   @unique
  passwordHash     String?
  downloadEnabled  Boolean  @default(false)
  createdAt        DateTime @default(now())
  photos           Photo[]
}

model Photo {
  id           String   @id @default(cuid())
  albumId      String
  album        Album    @relation(fields: [albumId], references: [id])
  driveFileId  String
  version      Int      @default(1)
  displayOrder Int
  thumbnailUrl String
  previewUrl   String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([albumId])
}
```

(Only the `Album` model's final line changes — adding `photos Photo[]` — everything else in `Album` stays as-is; the `Photo` model is entirely new.)

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_photo`
Expected: `Your database is now in sync with your schema.` — creates `prisma/migrations/<timestamp>_add_photo/migration.sql`.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 4: Verify the app still builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Photo model with version and cached-preview fields"
```

---

### Task 2: Drive service — upload and replace file content

**Files:**
- Modify: `src/lib/drive.ts`
- Modify: `tests/lib/drive.test.ts`

**Interfaces:**
- Consumes: `drive_v3.Drive` client from `getDriveClientForUser` (already exists).
- Produces: `uploadFile(drive, parentId: string, name: string, mimeType: string, buffer: Buffer): Promise<string>` (returns the new Drive file's id) and `replaceFile(drive, fileId: string, mimeType: string, buffer: Buffer): Promise<void>`. Both consumed by Task 5 (upload route) and Task 6 (replace route) respectively.

- [ ] **Step 1: Write the failing tests**

Modify `tests/lib/drive.test.ts` to add a `filesUpdate` mock alongside the existing `filesCreate` mock, and two new `describe` blocks. The full updated file:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const filesCreate = vi.fn()
const filesUpdate = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function (this: { setCredentials: ReturnType<typeof vi.fn> }) {
        this.setCredentials = vi.fn()
      }),
    },
    drive: vi.fn().mockImplementation(() => ({
      files: { create: filesCreate, update: filesUpdate },
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: FAIL — `uploadFile`/`replaceFile` are not exported from `@/lib/drive` (the other, pre-existing tests still pass).

- [ ] **Step 3: Add `uploadFile` and `replaceFile` to `src/lib/drive.ts`**

Add this import at the top of `src/lib/drive.ts` (alongside the existing imports):

```ts
import { Readable } from 'stream'
```

Add these two functions at the end of `src/lib/drive.ts` (everything already in the file stays unchanged):

```ts
export async function uploadFile(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Drive did not return a file id')
  }
  return res.data.id
}

export async function replaceFile(
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  await drive.files.update({
    fileId,
    media: { mimeType, body: Readable.from(buffer) },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: PASS (9 tests: the 5 pre-existing plus 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.ts tests/lib/drive.test.ts
git commit -m "Add Drive uploadFile/replaceFile for photo upload and versioning"
```

---

### Task 3: Image processing (thumbnail + preview generation)

**Files:**
- Create: `src/lib/image-processing.ts`
- Test: `tests/lib/image-processing.test.ts`
- Modify: `package.json` (add `sharp`)

**Interfaces:**
- Produces: `processImage(buffer: Buffer): Promise<{ thumbnail: Buffer; preview: Buffer }>` — both outputs are JPEGs, thumbnail capped at 400px wide, preview capped at 1600px wide, neither enlarges smaller-than-target images. Consumed by Task 5 (upload route) and Task 6 (replace route).

This task's test exercises real `sharp` behavior (no mocking) — `sharp` is a native image-processing library with no network calls, so testing it directly is fast and meaningful.

- [ ] **Step 1: Add the `sharp` dependency**

Edit `package.json`'s `dependencies` block to add (alphabetical order preserved):

```json
    "next-auth": "4.24.14",
    "@prisma/client": "5.22.0",
    "googleapis": "173.0.0",
    "sharp": "0.35.3"
```

Run: `npm install`
Expected: installs without error (sharp downloads a prebuilt binary for your platform).

- [ ] **Step 2: Write the failing tests**

`tests/lib/image-processing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { processImage } from '@/lib/image-processing'

describe('processImage', () => {
  it('produces a thumbnail and preview JPEG no wider than the target widths', async () => {
    const input = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer()

    const { thumbnail, preview } = await processImage(input)

    const thumbnailMeta = await sharp(thumbnail).metadata()
    const previewMeta = await sharp(preview).metadata()

    expect(thumbnailMeta.format).toBe('jpeg')
    expect(thumbnailMeta.width).toBeLessThanOrEqual(400)
    expect(previewMeta.format).toBe('jpeg')
    expect(previewMeta.width).toBeLessThanOrEqual(1600)
  })

  it('does not enlarge an image smaller than the target width', async () => {
    const input = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer()

    const { thumbnail } = await processImage(input)
    const thumbnailMeta = await sharp(thumbnail).metadata()

    expect(thumbnailMeta.width).toBe(200)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/image-processing.test.ts`
Expected: FAIL — cannot find module `@/lib/image-processing`.

- [ ] **Step 4: Write `src/lib/image-processing.ts`**

```ts
import sharp from 'sharp'

const THUMBNAIL_WIDTH = 400
const PREVIEW_WIDTH = 1600
const JPEG_QUALITY = 80

export interface ProcessedImage {
  thumbnail: Buffer
  preview: Buffer
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const [thumbnail, preview] = await Promise.all([
    sharp(buffer)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer(),
    sharp(buffer)
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer(),
  ])
  return { thumbnail, preview }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/image-processing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/image-processing.ts tests/lib/image-processing.test.ts
git commit -m "Add sharp-based thumbnail/preview image processing"
```

---

### Task 4: Blob storage for cached previews

**Files:**
- Create: `src/lib/blob-storage.ts`
- Test: `tests/lib/blob-storage.test.ts`
- Modify: `package.json` (add `@vercel/blob`)
- Modify: `.env.example` (add `BLOB_READ_WRITE_TOKEN`)

**Interfaces:**
- Consumes: `requireEnv` from `src/lib/env.ts`.
- Produces: `uploadToBlob(path: string, buffer: Buffer, contentType: string): Promise<string>` (returns the public URL). Consumed by Task 5 and Task 6.

- [ ] **Step 1: Add the `@vercel/blob` dependency**

Edit `package.json`'s `dependencies` block to add:

```json
    "@vercel/blob": "2.6.0",
```

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Add `BLOB_READ_WRITE_TOKEN` to `.env.example`**

Append to `.env.example`:

```
BLOB_READ_WRITE_TOKEN="get-this-from-your-vercel-project-s-blob-store"
```

- [ ] **Step 3: Write the failing test**

`tests/lib/blob-storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'

const putMock = vi.fn()

vi.mock('@vercel/blob', () => ({
  put: putMock,
}))

import { uploadToBlob } from '@/lib/blob-storage'

beforeAll(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
})

describe('uploadToBlob', () => {
  it('uploads the buffer to the given path and returns the resulting URL', async () => {
    putMock.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/albums/a1/photos/p1/v1/thumb.jpg',
    })

    const buffer = Buffer.from('fake-image-bytes')
    const url = await uploadToBlob('albums/a1/photos/p1/v1/thumb.jpg', buffer, 'image/jpeg')

    expect(url).toBe('https://blob.vercel-storage.com/albums/a1/photos/p1/v1/thumb.jpg')
    expect(putMock).toHaveBeenCalledWith('albums/a1/photos/p1/v1/thumb.jpg', buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
      token: 'test-token',
    })
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/lib/blob-storage.test.ts`
Expected: FAIL — cannot find module `@/lib/blob-storage`.

- [ ] **Step 5: Write `src/lib/blob-storage.ts`**

```ts
import { put } from '@vercel/blob'
import { requireEnv } from './env'

export async function uploadToBlob(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const blob = await put(path, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    token: requireEnv('BLOB_READ_WRITE_TOKEN'),
  })
  return blob.url
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/lib/blob-storage.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/blob-storage.ts tests/lib/blob-storage.test.ts
git commit -m "Add Vercel Blob storage wrapper for cached preview images"
```

---

### Task 5: Album-permission helper + photo upload API

**Files:**
- Create: `src/lib/album-permissions.ts`
- Test: `tests/lib/album-permissions.test.ts`
- Create: `src/app/api/albums/[albumId]/photos/route.ts`
- Test: `tests/api/albums-photos.test.ts`

**Interfaces:**
- Produces: `canManageAlbum(user: { id: string; role: Role }, album: { ownerId: string }): boolean` — true if the user is ADMIN or owns the album. Consumed by this task's route and by Task 6.
- Produces: `POST /api/albums/[albumId]/photos` (multipart form field `file`) → `201` with the created `Photo` row, or `401`/`403`/`404`/`400`/`500`. Consumed by Task 7's `UploadPhotos` component.

**Note on the test file's environment:** Node's built-in `File`/`FormData` (used to build these tests' fake requests) do not fully implement `.arrayBuffer()` under jsdom (the project's default Vitest environment, set in Plan 1). Both new API test files must start with the Vitest per-file environment override docblock `// @vitest-environment node` as their very first line, before any imports.

- [ ] **Step 1: Write the failing test for `canManageAlbum`**

`tests/lib/album-permissions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canManageAlbum } from '@/lib/album-permissions'

describe('canManageAlbum', () => {
  it('allows an ADMIN regardless of ownership', () => {
    const user = { id: 'admin_1', role: 'ADMIN' as const }
    const album = { ownerId: 'someone_else' }
    expect(canManageAlbum(user, album)).toBe(true)
  })

  it('allows a PHOTOGRAPHER who owns the album', () => {
    const user = { id: 'user_1', role: 'PHOTOGRAPHER' as const }
    const album = { ownerId: 'user_1' }
    expect(canManageAlbum(user, album)).toBe(true)
  })

  it('denies a PHOTOGRAPHER who does not own the album', () => {
    const user = { id: 'user_1', role: 'PHOTOGRAPHER' as const }
    const album = { ownerId: 'someone_else' }
    expect(canManageAlbum(user, album)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/album-permissions.test.ts`
Expected: FAIL — cannot find module `@/lib/album-permissions`.

- [ ] **Step 3: Write `src/lib/album-permissions.ts`**

```ts
import type { Role } from '@prisma/client'

export function canManageAlbum(
  user: { id: string; role: Role },
  album: { ownerId: string }
): boolean {
  return user.role === 'ADMIN' || album.ownerId === user.id
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/lib/album-permissions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing tests for the upload route**

`tests/api/albums-photos.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn() },
    photo: { count: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  uploadFile: vi.fn(),
}))
vi.mock('@/lib/image-processing', () => ({
  processImage: vi.fn(),
}))
vi.mock('@/lib/blob-storage', () => ({
  uploadToBlob: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { POST } from '@/app/api/albums/[albumId]/photos/route'

function formRequest(file: unknown) {
  return {
    formData: async () => ({
      get: (key: string) => (key === 'file' ? file : null),
    }),
  } as never
}

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums/[albumId]/photos', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a PHOTOGRAPHER does not own the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
      driveFolderId: 'folder_1',
      owner: { id: 'someone_else', encryptedRefreshToken: 'cipher' },
    } as never)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('returns 400 when no file is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
      driveFolderId: 'folder_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    } as never)

    const res = await POST(formRequest(null), routeParams('album_1'))

    expect(res.status).toBe(400)
  })

  it('returns 400 when the file is not an image', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
      driveFolderId: 'folder_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    } as never)
    const notAnImage = {
      type: 'text/plain',
      name: 'notes.txt',
      arrayBuffer: async () => Buffer.from('not an image').buffer,
    }

    const res = await POST(formRequest(notAnImage), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('file must be an image')
  })

  it('uploads to Drive, processes the image, caches previews, and creates a Photo row', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
      driveFolderId: 'folder_1',
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    } as never)
    vi.mocked(uploadFile).mockResolvedValue('drive_file_1')
    vi.mocked(processImage).mockResolvedValue({
      thumbnail: Buffer.from('thumb'),
      preview: Buffer.from('preview'),
    })
    vi.mocked(uploadToBlob)
      .mockResolvedValueOnce('https://blob/thumb.jpg')
      .mockResolvedValueOnce('https://blob/preview.jpg')
    vi.mocked(prisma.photo.count).mockResolvedValue(2)
    vi.mocked(prisma.photo.create).mockResolvedValue({
      id: 'photo_1',
      albumId: 'album_1',
      driveFileId: 'drive_file_1',
      version: 1,
      displayOrder: 2,
      thumbnailUrl: 'https://blob/thumb.jpg',
      previewUrl: 'https://blob/preview.jpg',
    } as never)
    const file = {
      type: 'image/jpeg',
      name: 'IMG_0001.jpg',
      arrayBuffer: async () => Buffer.from('fake-bytes').buffer,
    }

    const res = await POST(formRequest(file), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('photo_1')
    expect(uploadFile).toHaveBeenCalledWith(
      { mockDrive: true },
      'folder_1',
      'IMG_0001.jpg',
      'image/jpeg',
      expect.any(Buffer)
    )
    const createArgs = vi.mocked(prisma.photo.create).mock.calls[0][0] as {
      data: { albumId: string; driveFileId: string; displayOrder: number }
    }
    expect(createArgs.data.albumId).toBe('album_1')
    expect(createArgs.data.driveFileId).toBe('drive_file_1')
    expect(createArgs.data.displayOrder).toBe(2)
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/api/albums-photos.test.ts`
Expected: FAIL — cannot find module `@/app/api/albums/[albumId]/photos/route`.

- [ ] **Step 7: Write `src/app/api/albums/[albumId]/photos/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, uploadFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { canManageAlbum } from '@/lib/album-permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { albumId } = await params
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { owner: true },
  })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }
  if (!canManageAlbum(session.user, album)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as { type?: string; name?: string; arrayBuffer?: () => Promise<ArrayBuffer> } | null
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'file must be an image' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const drive = getDriveClientForUser(album.owner)
    const driveFileId = await uploadFile(
      drive,
      album.driveFolderId,
      file.name ?? 'untitled',
      file.type,
      buffer
    )
    const { thumbnail, preview } = await processImage(buffer)

    const displayOrder = await prisma.photo.count({ where: { albumId } })
    const [thumbnailUrl, previewUrl] = await Promise.all([
      uploadToBlob(`drive-files/${driveFileId}/v1/thumb.jpg`, thumbnail, 'image/jpeg'),
      uploadToBlob(`drive-files/${driveFileId}/v1/preview.jpg`, preview, 'image/jpeg'),
    ])

    const photo = await prisma.photo.create({
      data: {
        albumId,
        driveFileId,
        displayOrder,
        thumbnailUrl,
        previewUrl,
      },
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('Failed to upload photo:', error)
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums-photos.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/album-permissions.ts tests/lib/album-permissions.test.ts src/app/api/albums/\[albumId\]/photos/route.ts tests/api/albums-photos.test.ts
git commit -m "Add album-permission helper and photo upload API"
```

---

### Task 6: Photo replace API (versioning)

**Files:**
- Create: `src/app/api/photos/[photoId]/replace/route.ts`
- Test: `tests/api/photos-replace.test.ts`

**Interfaces:**
- Consumes: `canManageAlbum` (Task 5), `getDriveClientForUser`/`replaceFile` (Task 2), `processImage` (Task 3), `uploadToBlob` (Task 4).
- Produces: `POST /api/photos/[photoId]/replace` (multipart form field `file`) → `200` with the updated `Photo` row (new `version`, new `thumbnailUrl`/`previewUrl`), or `401`/`403`/`404`/`400`/`500`. Consumed by Task 7's `ReplacePhotoButton`.

Same `// @vitest-environment node` requirement as Task 5's test file applies here.

- [ ] **Step 1: Write the failing tests**

`tests/api/photos-replace.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  replaceFile: vi.fn(),
}))
vi.mock('@/lib/image-processing', () => ({
  processImage: vi.fn(),
}))
vi.mock('@/lib/blob-storage', () => ({
  uploadToBlob: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { replaceFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { POST } from '@/app/api/photos/[photoId]/replace/route'

function formRequest(file: unknown) {
  return {
    formData: async () => ({
      get: (key: string) => (key === 'file' ? file : null),
    }),
  } as never
}

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/photos/[photoId]/replace', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await POST(formRequest(null), routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a PHOTOGRAPHER does not own the photo\'s album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_1',
      driveFileId: 'drive_file_1',
      version: 1,
      album: { id: 'album_1', ownerId: 'someone_else', owner: { id: 'someone_else', encryptedRefreshToken: 'cipher' } },
    } as never)

    const res = await POST(formRequest(null), routeParams('photo_1'))

    expect(res.status).toBe(403)
  })

  it('replaces the Drive file, bumps the version, and re-caches previews', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_1',
      driveFileId: 'drive_file_1',
      version: 1,
      album: { id: 'album_1', ownerId: 'user_1', owner: { id: 'user_1', encryptedRefreshToken: 'cipher' } },
    } as never)
    vi.mocked(processImage).mockResolvedValue({
      thumbnail: Buffer.from('thumb-v2'),
      preview: Buffer.from('preview-v2'),
    })
    vi.mocked(uploadToBlob)
      .mockResolvedValueOnce('https://blob/v2/thumb.jpg')
      .mockResolvedValueOnce('https://blob/v2/preview.jpg')
    vi.mocked(prisma.photo.update).mockResolvedValue({
      id: 'photo_1',
      version: 2,
      thumbnailUrl: 'https://blob/v2/thumb.jpg',
      previewUrl: 'https://blob/v2/preview.jpg',
    } as never)
    const file = {
      type: 'image/png',
      name: 'IMG_0001_edited.png',
      arrayBuffer: async () => Buffer.from('new-fake-bytes').buffer,
    }

    const res = await POST(formRequest(file), routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.version).toBe(2)
    expect(replaceFile).toHaveBeenCalledWith(
      { mockDrive: true },
      'drive_file_1',
      'image/png',
      expect.any(Buffer)
    )
    expect(uploadToBlob).toHaveBeenNthCalledWith(
      1,
      'drive-files/drive_file_1/v2/thumb.jpg',
      Buffer.from('thumb-v2'),
      'image/jpeg'
    )
    const updateArgs = vi.mocked(prisma.photo.update).mock.calls[0][0] as {
      where: { id: string }
      data: { version: number; thumbnailUrl: string; previewUrl: string }
    }
    expect(updateArgs.where.id).toBe('photo_1')
    expect(updateArgs.data.version).toBe(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/photos-replace.test.ts`
Expected: FAIL — cannot find module `@/app/api/photos/[photoId]/replace/route`.

- [ ] **Step 3: Write `src/app/api/photos/[photoId]/replace/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, replaceFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { canManageAlbum } from '@/lib/album-permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { photoId } = await params
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { album: { include: { owner: true } } },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }
  if (!canManageAlbum(session.user, photo.album)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as { type?: string; name?: string; arrayBuffer?: () => Promise<ArrayBuffer> } | null
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'file must be an image' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const drive = getDriveClientForUser(photo.album.owner)
    await replaceFile(drive, photo.driveFileId, file.type, buffer)
    const { thumbnail, preview } = await processImage(buffer)

    const newVersion = photo.version + 1
    const [thumbnailUrl, previewUrl] = await Promise.all([
      uploadToBlob(`drive-files/${photo.driveFileId}/v${newVersion}/thumb.jpg`, thumbnail, 'image/jpeg'),
      uploadToBlob(`drive-files/${photo.driveFileId}/v${newVersion}/preview.jpg`, preview, 'image/jpeg'),
    ])

    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: { version: newVersion, thumbnailUrl, previewUrl },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to replace photo:', error)
    return NextResponse.json({ error: 'Failed to replace photo' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/photos-replace.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/photos/\[photoId\]/replace/route.ts tests/api/photos-replace.test.ts
git commit -m "Add photo replace API that bumps version and re-caches previews"
```

---

### Task 7: Album detail page — photo grid, upload, replace

**Files:**
- Create: `src/app/albums/[albumId]/page.tsx`
- Create: `src/components/UploadPhotos.tsx`
- Test: `tests/components/UploadPhotos.test.tsx`
- Create: `src/components/ReplacePhotoButton.tsx`
- Test: `tests/components/ReplacePhotoButton.test.tsx`

**Interfaces:**
- Consumes: `POST /api/albums/[albumId]/photos` (Task 5) and `POST /api/photos/[photoId]/replace` (Task 6) via `fetch`; `canManageAlbum` (Task 5) and `prisma` directly in the server component, same pattern as Plan 1's `albums/page.tsx`.
- Produces: rendered page at `/albums/[albumId]`. Nothing downstream in this plan consumes it; Plan 3 will link the client-facing share view separately.

- [ ] **Step 1: Write the failing tests for `UploadPhotos`**

`tests/components/UploadPhotos.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadPhotos } from '@/components/UploadPhotos'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('UploadPhotos', () => {
  it('uploads each selected file to the album photos endpoint and refreshes', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'photo_1' }),
    } as never)

    render(<UploadPhotos albumId="album_1" />)
    const input = screen.getByLabelText('Upload photos') as HTMLInputElement
    const file = new File(['bytes'], 'a.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/photos',
      expect.objectContaining({ method: 'POST' })
    )
    const callArgs = vi.mocked(global.fetch).mock.calls[0][1] as { body: FormData }
    expect(callArgs.body).toBeInstanceOf(FormData)
  })

  it('shows an error message when an upload fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'file must be an image' }),
    } as never)

    render(<UploadPhotos albumId="album_1" />)
    const input = screen.getByLabelText('Upload photos') as HTMLInputElement
    const file = new File(['bytes'], 'a.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('file must be an image')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/UploadPhotos.test.tsx`
Expected: FAIL — cannot find module `@/components/UploadPhotos`.

- [ ] **Step 3: Write `src/components/UploadPhotos.tsx`**

```tsx
'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

export function UploadPhotos({ albumId }: { albumId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.set('file', file)
        const res = await fetch(`/api/albums/${albumId}/photos`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Something went wrong')
          setUploading(false)
          return
        }
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label>
        Upload photos
        <input type="file" accept="image/*" multiple onChange={handleChange} disabled={uploading} />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/UploadPhotos.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing tests for `ReplacePhotoButton`**

`tests/components/ReplacePhotoButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('ReplacePhotoButton', () => {
  it('uploads the replacement file to the replace endpoint and refreshes', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'photo_1', version: 2 }),
    } as never)

    render(<ReplacePhotoButton photoId="photo_1" />)
    const input = screen.getByLabelText('Replace photo') as HTMLInputElement
    const file = new File(['bytes'], 'edited.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/photos/photo_1/replace',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows an error message when the replace fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'file must be an image' }),
    } as never)

    render(<ReplacePhotoButton photoId="photo_1" />)
    const input = screen.getByLabelText('Replace photo') as HTMLInputElement
    const file = new File(['bytes'], 'a.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('file must be an image')
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/components/ReplacePhotoButton.test.tsx`
Expected: FAIL — cannot find module `@/components/ReplacePhotoButton`.

- [ ] **Step 7: Write `src/components/ReplacePhotoButton.tsx`**

```tsx
'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

export function ReplacePhotoButton({ photoId }: { photoId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const res = await fetch(`/api/photos/${photoId}/replace`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label>
        Replace photo
        <input type="file" accept="image/*" onChange={handleChange} disabled={uploading} />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/components/ReplacePhotoButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Write the album detail page (no automated test — see Task 8 for manual verification)**

`src/app/albums/[albumId]/page.tsx`:

```tsx
import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const { albumId } = await params
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { photos: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!album || !canManageAlbum(session.user, album)) {
    notFound()
  }

  return (
    <main>
      <h1>
        {album.name} — {album.clientName}
      </h1>
      <UploadPhotos albumId={album.id} />
      <ul>
        {album.photos.map((photo) => (
          <li key={photo.id}>
            <img src={photo.thumbnailUrl} alt="" width={200} />
            {photo.version > 1 && <span> v{photo.version}</span>}
            <ReplacePhotoButton photoId={photo.id} />
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 10: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/app/albums/\[albumId\]/page.tsx src/components/UploadPhotos.tsx src/components/ReplacePhotoButton.tsx tests/components/UploadPhotos.test.tsx tests/components/ReplacePhotoButton.test.tsx
git commit -m "Add album detail page with photo grid, upload, and replace controls"
```

---

### Task 8: Manual end-to-end verification

This exercises real Drive uploads and real Blob storage — the two integration seams that can't be meaningfully unit-tested without live credentials. Do this after Tasks 1–7 are complete and committed.

**Prerequisites:**
- Plan 1's Task 8 already done (real Google OAuth credentials working, at least one album already created).
- A Vercel account with a Blob store created (Vercel dashboard → Storage → Create Database → Blob), and its `BLOB_READ_WRITE_TOKEN` copied into `.env` and `.env.local`.

- [ ] **Step 1: Fill in the real Blob token**

Set `BLOB_READ_WRITE_TOKEN` in `.env` and `.env.local` to the value from your Vercel Blob store.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Upload photos**

Visit `/albums`, click into the album created during Plan 1's Task 8, and use the "Upload photos" control to select 1-2 real image files. Expected: after a moment, the page refreshes and shows thumbnails for the uploaded photos, with no version badge (since each is a first upload, `version` is 1).

- [ ] **Step 4: Confirm the Drive files**

Open the album's folder in Google Drive. Expected: the uploaded image files appear inside it (not inside the `Selected` subfolder — that's for Plan 4).

- [ ] **Step 5: Confirm the Photo rows**

Run `npx prisma studio`, open the `Photo` table. Expected: one row per uploaded photo, each with a `driveFileId`, `version = 1`, a `thumbnailUrl`/`previewUrl` pointing at `blob.vercel-storage.com`, and increasing `displayOrder` values.

- [ ] **Step 6: Confirm the cached preview URLs actually load**

Open one photo's `thumbnailUrl` directly in a browser tab. Expected: the resized JPEG loads directly from Vercel Blob (no Drive/app involvement needed to view it).

- [ ] **Step 7: Replace a photo**

On the album detail page, use one photo's "Replace photo" control to upload a different image. Expected: after the refresh, that photo's thumbnail changes to the new image and a "v2" badge appears next to it.

- [ ] **Step 8: Confirm the version bump**

In `npx prisma studio`, check that same `Photo` row: `version` is now `2`, and `thumbnailUrl`/`previewUrl` point at new `v2/...` Blob paths (different from the `v1/...` paths captured in Step 5).

- [ ] **Step 9: Confirm Drive still shows one file, not two**

Back in the album's Drive folder, confirm the replaced photo is still a single file (same file, content replaced) — not a second file alongside the original.
