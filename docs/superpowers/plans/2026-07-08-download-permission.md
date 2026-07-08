# Download Permission (Plan 5 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a photographer toggle whether clients can download original photos from an album (`Album.downloadEnabled`, already in the schema since Plan 1 but never wired to anything); when enabled, a client can download a single original photo or the whole album as a ZIP, streamed live from Google Drive. The photographer can always download their own photos regardless of the toggle — it's their own Drive content.

**Architecture:** One new Drive function (`downloadOriginal`) fetches a file's original bytes + metadata on demand — no caching, since this is the first and only place in the app that ever touches full-resolution originals (everything else uses Plan 2's cached thumbnails/previews). Two new routes reuse Plan 4's `resolveActor` for the same dual-mode (photographer/client) access check already established: a PHOTOGRAPHER actor always passes; a CLIENT actor passes only if `Album.downloadEnabled` is `true`. A third route lets the photographer flip the toggle. `JSZip` builds the multi-photo ZIP in memory — acceptable for MVP-scale albums, not built for thousands of large RAW files.

**Tech Stack:** Builds on Plans 1–4's stack (Next.js 15, Prisma 5, googleapis, Vitest). Adds `jszip` (in-memory ZIP creation).

## Global Constraints

- Single-tenant (unchanged). No schema changes — `Album.downloadEnabled` already exists (Plan 1, default `false`).
- **Every download route reuses `resolveActor` (Plan 4) for its access check — never reimplemented.** A PHOTOGRAPHER actor (passes `canManageAlbum`) may always download, independent of the toggle — it's content already in their own Drive. A CLIENT actor may only download when `Album.downloadEnabled === true`.
- **All Drive reads use the album OWNER's stored credentials** (`album.owner` / `photo.album.owner`), never the acting session's — the same rule from every prior plan.
- No watermarking anywhere — when downloads are disabled, the existing Plan 2 cached preview (already un-watermarked, per the original design decision) is all a client ever sees; this plan doesn't add or remove any watermarking.
- No new caching layer for originals — every download re-fetches from Drive. This is deliberately simple for MVP; do not add a Blob-cache for originals in this plan.
- The multi-photo ZIP is built by fetching each photo from Drive sequentially and buffering the whole ZIP in memory before responding — acceptable for a photographer-studio-scale album, not a scalability guarantee for very large albums. Do not add streaming/chunked ZIP generation in this plan.

---

## File Structure

```
photo-delivery/
├── package.json                                          (modified: +jszip)
├── src/
│   ├── app/
│   │   ├── a/
│   │   │   └── [shareToken]/
│   │   │       └── page.tsx                               (modified: +canDownload wiring)
│   │   ├── albums/
│   │   │   └── [albumId]/
│   │   │       └── page.tsx                               (modified: +DownloadToggle)
│   │   └── api/
│   │       ├── albums/
│   │       │   └── [albumId]/
│   │       │       ├── download-toggle/route.ts             (new)
│   │       │       └── download-all/route.ts                 (new)
│   │       └── photos/
│   │           └── [photoId]/
│   │               └── download/route.ts                     (new)
│   ├── components/
│   │   └── DownloadToggle.tsx                              (new)
│   └── lib/
│       └── drive.ts                                        (modified: +downloadOriginal)
└── tests/
    ├── lib/
    │   └── drive.test.ts                                    (modified)
    ├── api/
    │   ├── albums-download-toggle.test.ts                    (new)
    │   ├── photos-download.test.ts                           (new)
    │   └── albums-download-all.test.ts                       (new)
    └── components/
        ├── DownloadToggle.test.tsx                           (new)
        └── ClientGallery.test.tsx                            (modified)
```

---

### Task 1: Drive `downloadOriginal`

**Files:**
- Modify: `src/lib/drive.ts`
- Modify: `tests/lib/drive.test.ts`

**Interfaces:**
- Produces: `downloadOriginal(drive, fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }>`. Consumed by Task 3 (single-photo download route) and Task 4 (album ZIP route).

- [ ] **Step 1: Write the failing test**

Modify `tests/lib/drive.test.ts` — add a `filesGet` mock alongside the existing ones, and one new `describe` block. The full updated file:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const filesCreate = vi.fn()
const filesUpdate = vi.fn()
const filesDelete = vi.fn()
const filesGet = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function (this: { setCredentials: ReturnType<typeof vi.fn> }) {
        this.setCredentials = vi.fn()
      }),
    },
    drive: vi.fn().mockImplementation(() => ({
      files: { create: filesCreate, update: filesUpdate, delete: filesDelete, get: filesGet },
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
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: FAIL — `downloadOriginal` is not exported from `@/lib/drive` (the other, pre-existing tests still pass).

- [ ] **Step 3: Add `downloadOriginal` to `src/lib/drive.ts`**

Add this function at the end of `src/lib/drive.ts` (everything already in the file stays unchanged):

```ts
export async function downloadOriginal(
  drive: drive_v3.Drive,
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  const metadata = await drive.files.get({ fileId, fields: 'name,mimeType' })
  const content = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  return {
    buffer: Buffer.from(content.data as ArrayBuffer),
    mimeType: metadata.data.mimeType ?? 'application/octet-stream',
    name: metadata.data.name ?? 'photo',
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: PASS (13 tests: the 11 pre-existing plus 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.ts tests/lib/drive.test.ts
git commit -m "Add Drive downloadOriginal for fetching full-resolution files on demand"
```

---

### Task 2: Download-toggle API + UI

**Files:**
- Create: `src/app/api/albums/[albumId]/download-toggle/route.ts`
- Test: `tests/api/albums-download-toggle.test.ts`
- Create: `src/components/DownloadToggle.tsx`
- Test: `tests/components/DownloadToggle.test.tsx`
- Modify: `src/app/albums/[albumId]/page.tsx`

**Interfaces:**
- Produces: `POST /api/albums/[albumId]/download-toggle` (session-authenticated, body `{ enabled: boolean }`) → `200` with `{ id: string; downloadEnabled: boolean }`, or `401`/`403`/`404`/`400`.
- Produces: `DownloadToggle({ albumId, downloadEnabled }: { albumId: string; downloadEnabled: boolean })`, rendered on the album detail page.

- [ ] **Step 1: Write the failing tests for the toggle route**

`tests/api/albums-download-toggle.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/albums/[albumId]/download-toggle/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums/[albumId]/download-toggle', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))

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

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('returns 400 when enabled is not a boolean', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)

    const res = await POST(jsonRequest({ enabled: 'yes' }), routeParams('album_1'))

    expect(res.status).toBe(400)
  })

  it('enables downloads', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({
      id: 'album_1',
      downloadEnabled: true,
    } as never)

    const res = await POST(jsonRequest({ enabled: true }), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ id: 'album_1', downloadEnabled: true })
    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { downloadEnabled: true },
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/albums-download-toggle.test.ts`
Expected: FAIL — cannot find module `@/app/api/albums/[albumId]/download-toggle/route`.

- [ ] **Step 3: Write `src/app/api/albums/[albumId]/download-toggle/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
  const album = await prisma.album.findUnique({ where: { id: albumId } })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }
  if (!canManageAlbum(session.user, album)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { enabled } = body as { enabled?: unknown }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const updated = await prisma.album.update({
    where: { id: albumId },
    data: { downloadEnabled: enabled },
  })

  return NextResponse.json({ id: updated.id, downloadEnabled: updated.downloadEnabled })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums-download-toggle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing tests for `DownloadToggle`**

`tests/components/DownloadToggle.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DownloadToggle } from '@/components/DownloadToggle'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('DownloadToggle', () => {
  it('turns downloads on and refreshes when currently off', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', downloadEnabled: true }),
    } as never)

    render(<DownloadToggle albumId="album_1" downloadEnabled={false} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/download-toggle',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
      })
    )
  })

  it('turns downloads off when currently on', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', downloadEnabled: false }),
    } as never)

    render(<DownloadToggle albumId="album_1" downloadEnabled={true} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/download-toggle',
      expect.objectContaining({
        body: JSON.stringify({ enabled: false }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)

    render(<DownloadToggle albumId="album_1" downloadEnabled={false} />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })

  it('reflects the current state via aria-pressed and label', () => {
    render(<DownloadToggle albumId="album_1" downloadEnabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Downloads: On')
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/components/DownloadToggle.test.tsx`
Expected: FAIL — cannot find module `@/components/DownloadToggle`.

- [ ] **Step 7: Write `src/components/DownloadToggle.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DownloadToggle({
  albumId,
  downloadEnabled,
}: {
  albumId: string
  downloadEnabled: boolean
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/albums/${albumId}/download-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !downloadEnabled }),
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
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={submitting}
        aria-pressed={downloadEnabled}
      >
        {downloadEnabled ? 'Downloads: On' : 'Downloads: Off'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/components/DownloadToggle.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Wire `DownloadToggle` into the album detail page**

Modify `src/app/albums/[albumId]/page.tsx` — add the import and render `DownloadToggle`. Full updated file:

```tsx
import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'
import { LikeButton } from '@/components/LikeButton'
import { CommentThread } from '@/components/CommentThread'
import { DownloadToggle } from '@/components/DownloadToggle'

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
    include: {
      photos: {
        orderBy: { displayOrder: 'asc' },
        include: {
          likes: true,
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  })
  if (!album || !canManageAlbum(session.user, album)) {
    notFound()
  }

  return (
    <main>
      <h1>
        {album.name} — {album.clientName}
      </h1>
      <p>
        Share link: <code>/a/{album.shareToken}</code>
      </p>
      <SetAlbumPassword albumId={album.id} hasPassword={Boolean(album.passwordHash)} />
      <DownloadToggle albumId={album.id} downloadEnabled={album.downloadEnabled} />
      <UploadPhotos albumId={album.id} />
      <ul>
        {album.photos.map((photo) => {
          const suggestedByMe = photo.likes.some(
            (like) => like.actorType === 'PHOTOGRAPHER' && like.userId === session.user.id
          )
          const clientLikers = photo.likes
            .filter((like) => like.actorType === 'CLIENT')
            .map((like) => like.actorName)
            .filter((name): name is string => Boolean(name))
          const comments = photo.comments.map((comment) => ({
            id: comment.id,
            text: comment.text,
            authorLabel:
              comment.actorName ?? comment.user?.name ?? comment.user?.email ?? 'Photographer',
          }))

          return (
            <li key={photo.id}>
              <img src={photo.thumbnailUrl} alt="" width={200} />
              {photo.version > 1 && <span> v{photo.version}</span>}
              <ReplacePhotoButton photoId={photo.id} />
              <LikeButton
                photoId={photo.id}
                liked={suggestedByMe}
                label="⭐ Suggest to client"
              />
              {clientLikers.length > 0 && <p>❤ Selected by: {clientLikers.join(', ')}</p>}
              <CommentThread photoId={photo.id} comments={comments} />
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

- [ ] **Step 10: Verify the app builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/albums/\[albumId\]/download-toggle/route.ts tests/api/albums-download-toggle.test.ts src/components/DownloadToggle.tsx tests/components/DownloadToggle.test.tsx src/app/albums/\[albumId\]/page.tsx
git commit -m "Add download-permission toggle API and UI to the album detail page"
```

---

### Task 3: Single-photo download route

**Files:**
- Create: `src/app/api/photos/[photoId]/download/route.ts`
- Test: `tests/api/photos-download.test.ts`

**Interfaces:**
- Consumes: `resolveActor` (Plan 4), `getDriveClientForUser`/`downloadOriginal` (Task 1).
- Produces: `GET /api/photos/[photoId]/download` → `200` with the original file's bytes (`Content-Type`/`Content-Disposition` headers set), or `401`/`403`/`404`/`500`. Consumed by Task 5's `ClientGallery` download link.

- [ ] **Step 1: Write the failing tests**

`tests/api/photos-download.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  downloadOriginal: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { downloadOriginal } from '@/lib/drive'
import { GET } from '@/app/api/photos/[photoId]/download/route'

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

function photoRow(overrides: { downloadEnabled?: boolean } = {}) {
  return {
    id: 'photo_1',
    driveFileId: 'drive_file_1',
    album: {
      id: 'album_1',
      ownerId: 'user_1',
      passwordHash: null,
      downloadEnabled: overrides.downloadEnabled ?? false,
      owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/photos/[photoId]/download', () => {
  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('returns 403 for a client when downloads are disabled', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(403)
  })

  it('streams the original for a client when downloads are enabled', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow({ downloadEnabled: true }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('original-bytes'),
      mimeType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    })

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="IMG_0001.jpg"')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString()).toBe('original-bytes')
    expect(downloadOriginal).toHaveBeenCalledWith({ mockDrive: true }, 'drive_file_1')
  })

  it('streams the original for the photographer even when downloads are disabled', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('original-bytes'),
      mimeType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    })

    const res = await GET({} as never, routeParams('photo_1'))

    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/photos-download.test.ts`
Expected: FAIL — cannot find module `@/app/api/photos/[photoId]/download/route`.

- [ ] **Step 3: Write `src/app/api/photos/[photoId]/download/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { getDriveClientForUser, downloadOriginal } from '@/lib/drive'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { album: { include: { owner: true } } },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  const actor = await resolveActor(photo.album)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (actor.type === 'CLIENT' && !photo.album.downloadEnabled) {
    return NextResponse.json(
      { error: 'Downloads are not enabled for this album' },
      { status: 403 }
    )
  }

  try {
    const drive = getDriveClientForUser(photo.album.owner)
    const { buffer, mimeType, name } = await downloadOriginal(drive, photo.driveFileId)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    })
  } catch (error) {
    console.error('Failed to download photo:', error)
    return NextResponse.json({ error: 'Failed to download photo' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/photos-download.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/photos/\[photoId\]/download/route.ts tests/api/photos-download.test.ts
git commit -m "Add single-photo download route gated by album download permission"
```

---

### Task 4: Album ZIP download route

**Files:**
- Create: `src/app/api/albums/[albumId]/download-all/route.ts`
- Test: `tests/api/albums-download-all.test.ts`
- Modify: `package.json` (add `jszip`)

**Interfaces:**
- Consumes: `resolveActor` (Plan 4), `getDriveClientForUser`/`downloadOriginal` (Task 1), `JSZip`.
- Produces: `GET /api/albums/[albumId]/download-all` → `200` with a `application/zip` body containing every photo's original, or `401`/`403`/`404`/`500`. Consumed by Task 5's "Download all" link.

- [ ] **Step 1: Add the `jszip` dependency**

Edit `package.json`'s `dependencies` block to add:

```json
    "jszip": "3.10.1",
```

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Write the failing tests**

`tests/api/albums-download-all.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  downloadOriginal: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { downloadOriginal } from '@/lib/drive'
import { GET } from '@/app/api/albums/[albumId]/download-all/route'

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

function albumRow(overrides: { downloadEnabled?: boolean } = {}) {
  return {
    id: 'album_1',
    name: 'Wedding',
    ownerId: 'user_1',
    passwordHash: null,
    downloadEnabled: overrides.downloadEnabled ?? false,
    owner: { id: 'user_1', encryptedRefreshToken: 'cipher' },
    photos: [
      { id: 'photo_1', driveFileId: 'drive_file_1', displayOrder: 0 },
      { id: 'photo_2', driveFileId: 'drive_file_2', displayOrder: 1 },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/albums/[albumId]/download-all', () => {
  it('returns 404 when the album does not exist', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 403 for a client when downloads are disabled', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('builds a real zip containing every photo for a client when downloads are enabled', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow({ downloadEnabled: true }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(downloadOriginal)
      .mockResolvedValueOnce({ buffer: Buffer.from('photo-one'), mimeType: 'image/jpeg', name: 'one.jpg' })
      .mockResolvedValueOnce({ buffer: Buffer.from('photo-two'), mimeType: 'image/jpeg', name: 'two.jpg' })

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')

    const zipBuffer = Buffer.from(await res.arrayBuffer())
    const zip = await JSZip.loadAsync(zipBuffer)
    expect(Object.keys(zip.files).sort()).toEqual(['one.jpg', 'two.jpg'])
    expect(await zip.file('one.jpg')!.async('string')).toBe('photo-one')
    expect(await zip.file('two.jpg')!.async('string')).toBe('photo-two')
  })

  it('builds the zip for the photographer even when downloads are disabled', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(albumRow({ downloadEnabled: false }) as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(downloadOriginal).mockResolvedValue({
      buffer: Buffer.from('x'),
      mimeType: 'image/jpeg',
      name: 'x.jpg',
    })

    const res = await GET({} as never, routeParams('album_1'))

    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/api/albums-download-all.test.ts`
Expected: FAIL — cannot find module `@/app/api/albums/[albumId]/download-all/route`.

- [ ] **Step 4: Write `src/app/api/albums/[albumId]/download-all/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { getDriveClientForUser, downloadOriginal } from '@/lib/drive'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { owner: true, photos: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const actor = await resolveActor(album)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (actor.type === 'CLIENT' && !album.downloadEnabled) {
    return NextResponse.json(
      { error: 'Downloads are not enabled for this album' },
      { status: 403 }
    )
  }

  try {
    const drive = getDriveClientForUser(album.owner)
    const zip = new JSZip()
    for (const photo of album.photos) {
      const { buffer, name } = await downloadOriginal(drive, photo.driveFileId)
      zip.file(name, buffer)
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${album.name}.zip"`,
      },
    })
  } catch (error) {
    console.error('Failed to build album zip:', error)
    return NextResponse.json({ error: 'Failed to build album zip' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums-download-all.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/api/albums/\[albumId\]/download-all/route.ts tests/api/albums-download-all.test.ts
git commit -m "Add album-wide ZIP download route gated by download permission"
```

---

### Task 5: Client-facing download links

**Files:**
- Modify: `src/components/ClientGallery.tsx`
- Modify: `tests/components/ClientGallery.test.tsx`
- Modify: `src/app/a/[shareToken]/page.tsx`

**Interfaces:**
- Consumes: `resolveActor` (Plan 4, already imported on this page), `GET /api/photos/[photoId]/download` (Task 3), `GET /api/albums/[albumId]/download-all` (Task 4) — both consumed via plain `<a href>` links, no `fetch`/JS needed for a browser-triggered file download.
- Produces: a "Download" link per photo (inside the lightbox) and a "Download all" link (album-level), both rendered only when the current viewer is allowed to download. Terminal for this plan and for the whole 5-plan project.

This task has no new API test — it's UI wiring around already-tested routes and an already-tested `resolveActor`. The `ClientGallery` component test is updated to cover the new conditional rendering; the page itself is verified by `next build` and the manual walkthrough in Task 6, consistent with this plan's established pattern for page-level tasks.

- [ ] **Step 1: Write the updated tests for `ClientGallery`**

Replace the full contents of `tests/components/ClientGallery.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientGallery } from '@/components/ClientGallery'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const photos = [
  {
    id: 'p1',
    thumbnailUrl: 'https://blob/p1-thumb.jpg',
    previewUrl: 'https://blob/p1-preview.jpg',
    version: 1,
    likedByMe: false,
    suggestedByPhotographer: false,
    comments: [],
  },
  {
    id: 'p2',
    thumbnailUrl: 'https://blob/p2-thumb.jpg',
    previewUrl: 'https://blob/p2-preview.jpg',
    version: 2,
    likedByMe: true,
    suggestedByPhotographer: true,
    comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }],
  },
  {
    id: 'p3',
    thumbnailUrl: 'https://blob/p3-thumb.jpg',
    previewUrl: 'https://blob/p3-preview.jpg',
    version: 1,
    likedByMe: false,
    suggestedByPhotographer: false,
    comments: [],
  },
]

describe('ClientGallery', () => {
  it('renders a thumbnail for every photo and no lightbox initially', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the lightbox showing the preview image when a thumbnail is clicked', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    const dialog = screen.getByRole('dialog')
    const dialogImage = dialog.querySelector('img')
    expect(dialogImage?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('navigates to the next photo and closes the lightbox', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the suggested-by-photographer badge and existing comments for the open photo', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(screen.getByText(/suggested by photographer/i)).toBeTruthy()
    expect(screen.getByText(/Lovely/)).toBeTruthy()
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
  })

  it('does not show the suggested badge for a photo with no photographer like', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(screen.queryByText(/suggested by photographer/i)).toBeNull()
  })

  it('shows no download links when downloads are disabled', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.queryByRole('link', { name: /download all/i })).toBeNull()

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(screen.queryByRole('link', { name: /^download$/i })).toBeNull()
  })

  it('shows a per-photo download link and a download-all link when downloads are enabled', () => {
    render(<ClientGallery photos={photos} canDownload={true} albumId="album_1" />)

    const downloadAll = screen.getByRole('link', { name: /download all/i })
    expect(downloadAll).toHaveAttribute('href', '/api/albums/album_1/download-all')

    fireEvent.click(screen.getAllByRole('button')[1])

    const downloadPhoto = screen.getByRole('link', { name: /^download$/i })
    expect(downloadPhoto).toHaveAttribute('href', '/api/photos/p2/download')
  })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: FAIL — `ClientGallery` doesn't yet accept `canDownload`/`albumId` props or render any download links (the 5 pre-existing tests, unchanged from Plan 4, still pass).

- [ ] **Step 3: Replace the full contents of `src/components/ClientGallery.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { LikeButton } from './LikeButton'
import { CommentThread, type ThreadComment } from './CommentThread'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  likedByMe: boolean
  suggestedByPhotographer: boolean
  comments: ThreadComment[]
}

export function ClientGallery({
  photos,
  canDownload,
  albumId,
}: {
  photos: GalleryPhoto[]
  canDownload: boolean
  albumId?: string
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      {canDownload && albumId && (
        <a href={`/api/albums/${albumId}/download-all`}>Download all</a>
      )}
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button type="button" onClick={() => setOpenIndex(index)}>
              <img src={photo.thumbnailUrl} alt="Photo thumbnail" width={200} />
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <div role="dialog" aria-label="Photo preview">
          <button type="button" onClick={() => setOpenIndex(null)}>
            Close
          </button>
          {openIndex > 0 && (
            <button type="button" onClick={() => setOpenIndex(openIndex - 1)}>
              Previous
            </button>
          )}
          <img src={photos[openIndex].previewUrl} alt="Photo preview" />
          {openIndex < photos.length - 1 && (
            <button type="button" onClick={() => setOpenIndex(openIndex + 1)}>
              Next
            </button>
          )}
          {canDownload && (
            <a href={`/api/photos/${photos[openIndex].id}/download`}>Download</a>
          )}
          <LikeButton
            photoId={photos[openIndex].id}
            liked={photos[openIndex].likedByMe}
            label="❤ Select this photo"
          />
          {photos[openIndex].suggestedByPhotographer && <p>⭐ Suggested by photographer</p>}
          <CommentThread photoId={photos[openIndex].id} comments={photos[openIndex].comments} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Replace the full contents of `src/app/a/[shareToken]/page.tsx`**

```tsx
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { albumUnlockCookieName, isUnlocked } from '@/lib/album-unlock'
import { CLIENT_NAME_COOKIE } from '@/lib/client-identity'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { PasswordGate } from '@/components/PasswordGate'
import { NameGate } from '@/components/NameGate'
import { ClientGallery } from '@/components/ClientGallery'

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params
  const album = await prisma.album.findUnique({
    where: { shareToken },
    include: {
      photos: {
        orderBy: { displayOrder: 'asc' },
        include: {
          likes: true,
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  })
  if (!album) {
    notFound()
  }

  const cookieStore = await cookies()

  if (album.passwordHash) {
    const unlockCookie = cookieStore.get(albumUnlockCookieName(album.id))?.value
    if (!isUnlocked(album.id, unlockCookie)) {
      return <PasswordGate shareToken={shareToken} />
    }
  }

  const nameCookie = cookieStore.get(CLIENT_NAME_COOKIE)?.value
  if (!nameCookie) {
    return <NameGate />
  }

  const actor = await resolveActor(album)
  const myActorKey = actor ? actorKeyFor(actor) : null
  const canDownload = actor
    ? actor.type === 'PHOTOGRAPHER' || album.downloadEnabled
    : false

  const photos = album.photos.map((photo) => ({
    id: photo.id,
    thumbnailUrl: photo.thumbnailUrl,
    previewUrl: photo.previewUrl,
    version: photo.version,
    likedByMe: myActorKey ? photo.likes.some((like) => like.actorKey === myActorKey) : false,
    suggestedByPhotographer: photo.likes.some((like) => like.actorType === 'PHOTOGRAPHER'),
    comments: photo.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      authorLabel:
        comment.actorName ?? comment.user?.name ?? comment.user?.email ?? 'Photographer',
    })),
  }))

  return (
    <main>
      <h1>{album.name}</h1>
      <ClientGallery photos={photos} canDownload={canDownload} albumId={album.id} />
    </main>
  )
}
```

- [ ] **Step 6: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ClientGallery.tsx tests/components/ClientGallery.test.tsx src/app/a/\[shareToken\]/page.tsx
git commit -m "Add client-facing download links gated by album download permission"
```

---

### Task 6: Manual end-to-end verification

This exercises the real Drive download path — the part that can't be meaningfully unit-tested without live credentials (`downloadOriginal` fetching real bytes, a real ZIP containing real photos). Do this after Tasks 1–5 are complete and committed.

**Prerequisites:**
- Plans 1–4's manual verification already done (an album exists with a few uploaded photos, share link working).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Confirm downloads are off by default**

Open the album detail page as the photographer. Expected: the "Downloads: Off" toggle is shown (assuming this album was created before this plan and never toggled).

- [ ] **Step 3: Client sees no download options while disabled**

In a private/incognito window, open the share link, pass the gates, reach the gallery. Expected: no "Download all" link at the top, and opening the lightbox for any photo shows no "Download" link.

- [ ] **Step 4: Photographer enables downloads**

Click "Downloads: Off" to toggle it on. Expected: the label switches to "Downloads: On".

- [ ] **Step 5: Client now sees download options**

Reload the share link (same incognito window — cookies persist). Expected: a "Download all" link now appears, and opening the lightbox for any photo shows a "Download" link.

- [ ] **Step 6: Download a single photo**

Click "Download" on one photo. Expected: the browser downloads a file matching that photo's original filename and content (open it — it should be the actual uploaded image, not the cached preview).

- [ ] **Step 7: Download the whole album**

Click "Download all". Expected: a `.zip` file downloads; unzip it and confirm it contains every photo in the album, each with its original filename and full-resolution content.

- [ ] **Step 8: Photographer can always download, toggle or not**

Toggle downloads back off. As the photographer (signed in), manually visit `http://localhost:3000/api/photos/<a-photo-id>/download` directly in the browser (copy a photo id from Prisma Studio or the album page's HTML). Expected: the original still downloads successfully, since the photographer's own content is never gated by the toggle.

- [ ] **Step 9: Client is blocked again after re-disabling**

Back in the incognito window, reload the share link. Expected: the "Download all" and per-photo "Download" links are gone again.
