# Social Interactions (Plan 4 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client (viewing the public share page) mark a photo as "selected" (which also syncs a Drive shortcut into the album's `Selected` folder), let the photographer mark a photo as "suggested" to the client, and let both sides comment on a photo in one shared thread — all on both the client-facing gallery (Plan 3) and the photographer-facing album detail page (Plan 2).

**Architecture:** A single `resolveActor()` server-side utility determines "who is acting" for any mutation — a signed-in photographer (via NextAuth session + `canManageAlbum`) or an anonymous client (via the Plan 3 unlock/name cookies) — so one pair of API routes (`POST /api/photos/[photoId]/like`, `POST /api/photos/[photoId]/comments`) serves both audiences without duplicating logic. Two new Prisma models (`Like`, `Comment`) share an `ActorType` enum; `Like` rows use a computed `actorKey` for toggle-safe uniqueness. Client "likes" additionally create/delete a Drive shortcut (per the spec's `Selected`-folder design from Plan 1); photographer "likes" never touch Drive. Two small shared React components (`LikeButton`, `CommentThread`) are reused verbatim on both surfaces — the server computes each viewer's own like/suggestion state and passes it down as props.

**Tech Stack:** Builds on Plans 1–3's stack (Next.js 15, Prisma 5, next-auth 4, googleapis, Vitest). No new dependencies.

## Global Constraints

- Single-tenant (unchanged).
- Google OAuth scope is `drive.file` only.
- **Drive shortcut sync applies only to CLIENT likes, never PHOTOGRAPHER likes** (per spec §7 — the `Selected` folder mirrors what the *client* has chosen, not what the photographer suggests).
- **All Drive operations use the album OWNER's stored credentials** (`photo.album.owner`), never the acting session user's — unchanged rule from Plans 2–3.
- **Actor resolution is the single access-control gate for every mutation in this plan.** A CLIENT actor may only be resolved when the album has no password (or the visitor's unlock cookie is valid) AND a name cookie is present — reusing Plan 3's `isUnlocked`/`CLIENT_NAME_COOKIE` exactly, not reimplemented. A PHOTOGRAPHER actor may only be resolved via a real NextAuth session that passes `canManageAlbum` — reusing Plan 1's helper exactly.
- No download-permission logic and no live Drive-proxy route — both belong to Plan 5. This plan's Drive work is limited to shortcut create/delete in the already-existing `Selected` folder.
- No watermarking, no email sending, no real-time/WebSocket infra — comment/like updates are seen on next page load (`router.refresh()`), not pushed live.
- An anonymous client's identity is their typed display name (from Plan 3's cookie) with no stronger uniqueness guarantee — two visitors typing the identical name on the identical photo are treated as the same actor (their second "like" toggles off the first's). This is an intentional, documented MVP trade-off, not a bug to fix in this plan.

---

## File Structure

```
photo-delivery/
├── prisma/
│   └── schema.prisma                                    (modified: +Like, +Comment, +ActorType)
├── src/
│   ├── app/
│   │   ├── a/
│   │   │   └── [shareToken]/
│   │   │       └── page.tsx                               (modified: +likes/comments wiring)
│   │   ├── albums/
│   │   │   └── [albumId]/
│   │   │       └── page.tsx                               (modified: +likes/comments wiring)
│   │   └── api/
│   │       └── photos/
│   │           └── [photoId]/
│   │               ├── like/route.ts                        (new)
│   │               └── comments/route.ts                     (new)
│   ├── components/
│   │   ├── LikeButton.tsx                                 (new)
│   │   └── CommentThread.tsx                               (new)
│   └── lib/
│       ├── actor.ts                                        (new)
│       └── drive.ts                                        (modified: +createShortcut, +deleteFile)
└── tests/
    ├── lib/
    │   ├── actor.test.ts                                    (new)
    │   └── drive.test.ts                                    (modified)
    ├── api/
    │   ├── photos-like.test.ts                               (new)
    │   └── photos-comments.test.ts                           (new)
    └── components/
        ├── LikeButton.test.tsx                               (new)
        ├── CommentThread.test.tsx                            (new)
        └── ClientGallery.test.tsx                            (modified)
```

---

### Task 1: `Like` and `Comment` Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma-generated `Like` and `Comment` types, and an `ActorType` enum (`'CLIENT' | 'PHOTOGRAPHER'`). Consumed by every later task in this plan.

No unit test for this task (schema/migration only) — verified by a successful migration and `next build`, same approach as prior plans' schema tasks.

- [ ] **Step 1: Add the models and relations**

Edit `prisma/schema.prisma`:
- Add `likes Like[]` and `comments Comment[]` to the existing `User` model (after `albums Album[]`).
- Add `likes Like[]` and `comments Comment[]` to the existing `Photo` model (before its `@@index([albumId])` line — Prisma requires field declarations before block attributes).
- Add the new `ActorType` enum and the two new models.

Full updated `User` model:

```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  role                  Role     @default(PHOTOGRAPHER)
  encryptedRefreshToken String?
  driveRootFolderId     String?
  createdAt             DateTime @default(now())
  albums                Album[]
  likes                 Like[]
  comments              Comment[]
}
```

Full updated `Photo` model:

```prisma
model Photo {
  id           String    @id @default(cuid())
  albumId      String
  album        Album     @relation(fields: [albumId], references: [id])
  driveFileId  String
  version      Int       @default(1)
  displayOrder Int
  thumbnailUrl String
  previewUrl   String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  likes        Like[]
  comments     Comment[]

  @@index([albumId])
}
```

New enum and models (add at the end of the file):

```prisma
enum ActorType {
  CLIENT
  PHOTOGRAPHER
}

model Like {
  id              String    @id @default(cuid())
  photoId         String
  photo           Photo     @relation(fields: [photoId], references: [id])
  actorType       ActorType
  actorName       String?
  userId          String?
  user            User?     @relation(fields: [userId], references: [id])
  actorKey        String
  driveShortcutId String?
  createdAt       DateTime  @default(now())

  @@unique([photoId, actorKey])
  @@index([photoId])
}

model Comment {
  id        String    @id @default(cuid())
  photoId   String
  photo     Photo     @relation(fields: [photoId], references: [id])
  actorType ActorType
  actorName String?
  userId    String?
  user      User?     @relation(fields: [userId], references: [id])
  text      String
  createdAt DateTime  @default(now())

  @@index([photoId])
}
```

(`actorKey` is a computed, always-non-null string — `client:<name>` or `photographer:<userId>` — used instead of a nullable composite unique constraint, because Postgres treats each `NULL` as distinct in a unique index, which would silently fail to prevent duplicate likes if `actorName`/`userId` themselves were part of the unique key. `actorKey` is computed by application code in Task 2, not by the database.)

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_like_and_comment`
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 4: Verify the app still builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Like and Comment models with a shared ActorType enum"
```

---

### Task 2: Actor resolution

**Files:**
- Create: `src/lib/actor.ts`
- Test: `tests/lib/actor.test.ts`

**Interfaces:**
- Consumes: `getServerSession`/`authOptions` (Plan 1), `canManageAlbum` (Plan 1), `cookies` from `next/headers`, `albumUnlockCookieName`/`isUnlocked` (Plan 3), `CLIENT_NAME_COOKIE` (Plan 3).
- Produces: `type Actor = { type: 'PHOTOGRAPHER'; userId: string } | { type: 'CLIENT'; name: string }`, `resolveActor(album: { id: string; ownerId: string; passwordHash: string | null }): Promise<Actor | null>`, `actorKeyFor(actor: Actor): string`. Consumed by Tasks 4 and 5's API routes, and Task 7's page wiring.

- [ ] **Step 1: Write the failing tests**

`tests/lib/actor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { unlockToken } from '@/lib/album-unlock'

function mockCookieStore(values: Record<string, string>) {
  return {
    get: (name: string) => (values[name] ? { value: values[name] } : undefined),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

describe('resolveActor', () => {
  it('returns a PHOTOGRAPHER actor when the session user can manage the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: null })

    expect(actor).toEqual({ type: 'PHOTOGRAPHER', userId: 'user_1' })
  })

  it('falls back to CLIENT when the session user cannot manage the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_2', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(cookies).mockResolvedValue(mockCookieStore({ client_name: 'Jane Doe' }) as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: null })

    expect(actor).toEqual({ type: 'CLIENT', name: 'Jane Doe' })
  })

  it('returns null for a visitor with no session and no name cookie', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(cookies).mockResolvedValue(mockCookieStore({}) as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: null })

    expect(actor).toBeNull()
  })

  it('returns null for a client with a name cookie but no valid unlock cookie on a password-protected album', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(cookies).mockResolvedValue(mockCookieStore({ client_name: 'Jane Doe' }) as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: 'hashed' })

    expect(actor).toBeNull()
  })

  it('returns a CLIENT actor for a password-protected album with a valid unlock cookie', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(cookies).mockResolvedValue(
      mockCookieStore({
        client_name: 'Jane Doe',
        album_unlock_album_1: unlockToken('album_1'),
      }) as never
    )

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: 'hashed' })

    expect(actor).toEqual({ type: 'CLIENT', name: 'Jane Doe' })
  })
})

describe('actorKeyFor', () => {
  it('builds a key for a photographer actor', () => {
    expect(actorKeyFor({ type: 'PHOTOGRAPHER', userId: 'user_1' })).toBe('photographer:user_1')
  })

  it('builds a key for a client actor', () => {
    expect(actorKeyFor({ type: 'CLIENT', name: 'Jane Doe' })).toBe('client:Jane Doe')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/actor.test.ts`
Expected: FAIL — cannot find module `@/lib/actor`.

- [ ] **Step 3: Write `src/lib/actor.ts`**

```ts
import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { authOptions } from './auth'
import { canManageAlbum } from './album-permissions'
import { albumUnlockCookieName, isUnlocked } from './album-unlock'
import { CLIENT_NAME_COOKIE } from './client-identity'

export type Actor = { type: 'PHOTOGRAPHER'; userId: string } | { type: 'CLIENT'; name: string }

export async function resolveActor(album: {
  id: string
  ownerId: string
  passwordHash: string | null
}): Promise<Actor | null> {
  const session = await getServerSession(authOptions)
  if (session?.user && canManageAlbum(session.user, album)) {
    return { type: 'PHOTOGRAPHER', userId: session.user.id }
  }

  const cookieStore = await cookies()

  if (album.passwordHash) {
    const unlockCookie = cookieStore.get(albumUnlockCookieName(album.id))?.value
    if (!isUnlocked(album.id, unlockCookie)) {
      return null
    }
  }

  const name = cookieStore.get(CLIENT_NAME_COOKIE)?.value
  if (!name) {
    return null
  }
  return { type: 'CLIENT', name }
}

export function actorKeyFor(actor: Actor): string {
  return actor.type === 'PHOTOGRAPHER' ? `photographer:${actor.userId}` : `client:${actor.name}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/actor.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actor.ts tests/lib/actor.test.ts
git commit -m "Add dual-mode actor resolution for photographer/client interactions"
```

---

### Task 3: Drive shortcut create/delete

**Files:**
- Modify: `src/lib/drive.ts`
- Modify: `tests/lib/drive.test.ts`

**Interfaces:**
- Produces: `createShortcut(drive, targetFileId: string, parentId: string): Promise<string>` (returns the new shortcut's file id), `deleteFile(drive, fileId: string): Promise<void>`. Consumed by Task 4's like-toggle route.

- [ ] **Step 1: Write the failing tests**

Modify `tests/lib/drive.test.ts` — add a `filesDelete` mock alongside the existing `filesCreate`/`filesUpdate` mocks, and two new `describe` blocks. The full updated file:

```ts
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
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: FAIL — `createShortcut`/`deleteFile` are not exported from `@/lib/drive` (the other, pre-existing tests still pass).

- [ ] **Step 3: Add `createShortcut` and `deleteFile` to `src/lib/drive.ts`**

Add these two functions at the end of `src/lib/drive.ts` (everything already in the file stays unchanged):

```ts
export async function createShortcut(
  drive: drive_v3.Drive,
  targetFileId: string,
  parentId: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name: 'shortcut',
      mimeType: 'application/vnd.google-apps.shortcut',
      parents: [parentId],
      shortcutDetails: { targetId: targetFileId },
    },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Drive did not return a shortcut id')
  }
  return res.data.id
}

export async function deleteFile(drive: drive_v3.Drive, fileId: string): Promise<void> {
  await drive.files.delete({ fileId })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: PASS (11 tests: the 8 pre-existing plus 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.ts tests/lib/drive.test.ts
git commit -m "Add Drive createShortcut/deleteFile for the Selected-folder sync"
```

---

### Task 4: Like toggle API

**Files:**
- Create: `src/app/api/photos/[photoId]/like/route.ts`
- Test: `tests/api/photos-like.test.ts`

**Interfaces:**
- Consumes: `resolveActor`/`actorKeyFor` (Task 2), `getDriveClientForUser`/`createShortcut`/`deleteFile` (Task 3).
- Produces: `POST /api/photos/[photoId]/like` → `200` with `{ liked: boolean }`, or `401`/`404`/`500`. Consumed by Task 6's `LikeButton`.

- [ ] **Step 1: Write the failing tests**

`tests/api/photos-like.test.ts`:

```ts
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
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/photos-like.test.ts`
Expected: FAIL — cannot find module `@/app/api/photos/[photoId]/like/route`.

- [ ] **Step 3: Write `src/app/api/photos/[photoId]/like/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { getDriveClientForUser, createShortcut, deleteFile } from '@/lib/drive'

export async function POST(
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

  const actorKey = actorKeyFor(actor)

  try {
    const existing = await prisma.like.findUnique({
      where: { photoId_actorKey: { photoId, actorKey } },
    })

    if (existing) {
      if (existing.driveShortcutId) {
        const drive = getDriveClientForUser(photo.album.owner)
        await deleteFile(drive, existing.driveShortcutId)
      }
      await prisma.like.delete({ where: { id: existing.id } })
      return NextResponse.json({ liked: false })
    }

    let driveShortcutId: string | null = null
    if (actor.type === 'CLIENT') {
      const drive = getDriveClientForUser(photo.album.owner)
      driveShortcutId = await createShortcut(drive, photo.driveFileId, photo.album.selectedFolderId)
    }

    await prisma.like.create({
      data: {
        photoId,
        actorType: actor.type,
        actorName: actor.type === 'CLIENT' ? actor.name : null,
        userId: actor.type === 'PHOTOGRAPHER' ? actor.userId : null,
        actorKey,
        driveShortcutId,
      },
    })
    return NextResponse.json({ liked: true })
  } catch (error) {
    console.error('Failed to toggle like:', error)
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/photos-like.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/photos/\[photoId\]/like/route.ts tests/api/photos-like.test.ts
git commit -m "Add like-toggle API with Selected-folder Drive shortcut sync"
```

---

### Task 5: Comment creation API

**Files:**
- Create: `src/app/api/photos/[photoId]/comments/route.ts`
- Test: `tests/api/photos-comments.test.ts`

**Interfaces:**
- Consumes: `resolveActor` (Task 2).
- Produces: `POST /api/photos/[photoId]/comments` (body `{ text: string }`) → `201` with the created `Comment` row, or `401`/`404`/`400`. Consumed by Task 6's `CommentThread`.

- [ ] **Step 1: Write the failing tests**

`tests/api/photos-comments.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findUnique: vi.fn() },
    comment: { create: vi.fn() },
  },
}))
vi.mock('@/lib/actor', () => ({
  resolveActor: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { POST } from '@/app/api/photos/[photoId]/comments/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(photoId: string) {
  return { params: Promise.resolve({ photoId }) }
}

function photoRow() {
  return {
    id: 'photo_1',
    album: { id: 'album_1', ownerId: 'user_1', passwordHash: null },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/photos/[photoId]/comments', () => {
  it('returns 404 when the photo does not exist', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ text: 'Nice shot' }), routeParams('photo_1'))

    expect(res.status).toBe(404)
  })

  it('returns 401 when no actor can be resolved', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue(null)

    const res = await POST(jsonRequest({ text: 'Nice shot' }), routeParams('photo_1'))

    expect(res.status).toBe(401)
  })

  it('returns 400 for an empty comment', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await POST(jsonRequest({ text: '   ' }), routeParams('photo_1'))

    expect(res.status).toBe(400)
  })

  it('returns 400 for a comment over 2000 characters', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })

    const res = await POST(jsonRequest({ text: 'a'.repeat(2001) }), routeParams('photo_1'))

    expect(res.status).toBe(400)
  })

  it('creates a client comment', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'CLIENT', name: 'Jane Doe' })
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: 'comment_1',
      text: 'Nice shot',
      actorType: 'CLIENT',
      actorName: 'Jane Doe',
    } as never)

    const res = await POST(jsonRequest({ text: 'Nice shot' }), routeParams('photo_1'))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('comment_1')
    const createArgs = vi.mocked(prisma.comment.create).mock.calls[0][0] as {
      data: { photoId: string; actorType: string; actorName: string | null; userId: string | null; text: string }
    }
    expect(createArgs.data.photoId).toBe('photo_1')
    expect(createArgs.data.actorType).toBe('CLIENT')
    expect(createArgs.data.actorName).toBe('Jane Doe')
    expect(createArgs.data.userId).toBeNull()
    expect(createArgs.data.text).toBe('Nice shot')
  })

  it('creates a photographer comment', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(photoRow() as never)
    vi.mocked(resolveActor).mockResolvedValue({ type: 'PHOTOGRAPHER', userId: 'user_1' })
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: 'comment_2',
      text: 'Can you crop this tighter?',
      actorType: 'PHOTOGRAPHER',
      userId: 'user_1',
    } as never)

    const res = await POST(
      jsonRequest({ text: 'Can you crop this tighter?' }),
      routeParams('photo_1')
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('comment_2')
    const createArgs = vi.mocked(prisma.comment.create).mock.calls[0][0] as {
      data: { actorType: string; actorName: string | null; userId: string | null }
    }
    expect(createArgs.data.actorType).toBe('PHOTOGRAPHER')
    expect(createArgs.data.actorName).toBeNull()
    expect(createArgs.data.userId).toBe('user_1')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/photos-comments.test.ts`
Expected: FAIL — cannot find module `@/app/api/photos/[photoId]/comments/route`.

- [ ] **Step 3: Write `src/app/api/photos/[photoId]/comments/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'

const MAX_COMMENT_LENGTH = 2000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { album: true },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  const actor = await resolveActor(photo.album)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { text } = body as { text?: string }
  const trimmed = text?.trim()
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: 'A comment between 1 and 2000 characters is required' },
      { status: 400 }
    )
  }

  const comment = await prisma.comment.create({
    data: {
      photoId,
      actorType: actor.type,
      actorName: actor.type === 'CLIENT' ? actor.name : null,
      userId: actor.type === 'PHOTOGRAPHER' ? actor.userId : null,
      text: trimmed,
    },
  })

  return NextResponse.json(comment, { status: 201 })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/photos-comments.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/photos/\[photoId\]/comments/route.ts tests/api/photos-comments.test.ts
git commit -m "Add shared comment-thread API for photographer and client"
```

---

### Task 6: Shared `LikeButton` and `CommentThread` components

**Files:**
- Create: `src/components/LikeButton.tsx`
- Test: `tests/components/LikeButton.test.tsx`
- Create: `src/components/CommentThread.tsx`
- Test: `tests/components/CommentThread.test.tsx`

**Interfaces:**
- Consumes: `POST /api/photos/[photoId]/like` (Task 4), `POST /api/photos/[photoId]/comments` (Task 5), both via `fetch`.
- Produces: `LikeButton({ photoId, liked, label }: { photoId: string; liked: boolean; label: string })` and `CommentThread({ photoId, comments }: { photoId: string; comments: ThreadComment[] })` (exporting the `ThreadComment` type). Both consumed by Task 7's page wiring — the identical components render on both the client gallery and the photographer's album page, just with different `label`/`liked` values computed server-side.

- [ ] **Step 1: Write the failing tests for `LikeButton`**

`tests/components/LikeButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LikeButton } from '@/components/LikeButton'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('LikeButton', () => {
  it('toggles by posting to the like endpoint and refreshing on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ liked: true }),
    } as never)

    render(<LikeButton photoId="photo_1" liked={false} label="Select" />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/photo_1/like', { method: 'POST' })
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    } as never)

    render(<LikeButton photoId="photo_1" liked={false} label="Select" />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized')
  })

  it('reflects the liked state in its label and aria-pressed', () => {
    render(<LikeButton photoId="photo_1" liked={true} label="Select" />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Select (on)')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/LikeButton.test.tsx`
Expected: FAIL — cannot find module `@/components/LikeButton`.

- [ ] **Step 3: Write `src/components/LikeButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LikeButton({
  photoId,
  liked,
  label,
}: {
  photoId: string
  liked: boolean
  label: string
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' })
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
      <button type="button" onClick={handleClick} disabled={submitting} aria-pressed={liked}>
        {liked ? `${label} (on)` : `${label} (off)`}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/components/LikeButton.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing tests for `CommentThread`**

`tests/components/CommentThread.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommentThread } from '@/components/CommentThread'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('CommentThread', () => {
  it('renders existing comments', () => {
    render(
      <CommentThread
        photoId="photo_1"
        comments={[{ id: 'c1', text: 'Love this!', authorLabel: 'Jane Doe' }]}
      />
    )

    expect(screen.getByText(/Love this!/)).toBeTruthy()
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
  })

  it('submits a new comment and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'c2', text: 'Nice shot', authorLabel: 'Jane Doe' }),
    } as never)

    render(<CommentThread photoId="photo_1" comments={[]} />)
    fireEvent.change(screen.getByLabelText('Add a comment'), {
      target: { value: 'Nice shot' },
    })
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/photos/photo_1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Nice shot' }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A comment between 1 and 2000 characters is required' }),
    } as never)

    render(<CommentThread photoId="photo_1" comments={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A comment between 1 and 2000 characters is required'
    )
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/components/CommentThread.test.tsx`
Expected: FAIL — cannot find module `@/components/CommentThread`.

- [ ] **Step 7: Write `src/components/CommentThread.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export interface ThreadComment {
  id: string
  text: string
  authorLabel: string
}

export function CommentThread({
  photoId,
  comments,
}: {
  photoId: string
  comments: ThreadComment[]
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      setText('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <ul>
        {comments.map((comment) => (
          <li key={comment.id}>
            <strong>{comment.authorLabel}:</strong> {comment.text}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label>
          Add a comment
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run tests/components/CommentThread.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/LikeButton.tsx tests/components/LikeButton.test.tsx src/components/CommentThread.tsx tests/components/CommentThread.test.tsx
git commit -m "Add shared LikeButton and CommentThread components"
```

---

### Task 7: Wire likes and comments into both pages

**Files:**
- Modify: `src/components/ClientGallery.tsx`
- Modify: `tests/components/ClientGallery.test.tsx`
- Modify: `src/app/a/[shareToken]/page.tsx`
- Modify: `src/app/albums/[albumId]/page.tsx`

**Interfaces:**
- Consumes: `LikeButton`/`CommentThread` (Task 6), `resolveActor`/`actorKeyFor` (Task 2), `canManageAlbum` (Plan 1).
- Produces: rendered like/comment UI on both `/a/[shareToken]` and `/albums/[albumId]`. Terminal for this plan — Plan 5 will extend the same two pages further (download controls).

This task has no new automated test beyond the modified `ClientGallery.test.tsx` — the two page files are server-component wiring, thin glue around already-tested pieces (`resolveActor`, `LikeButton`, `CommentThread`), verified by `next build` and the manual walkthrough in Task 8, consistent with this plan's established pattern for page-level tasks.

- [ ] **Step 1: Write the failing/updated tests for `ClientGallery`**

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
    render(<ClientGallery photos={photos} />)

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the lightbox showing the preview image when a thumbnail is clicked', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    const dialog = screen.getByRole('dialog')
    const dialogImage = dialog.querySelector('img')
    expect(dialogImage?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('navigates to the next photo and closes the lightbox', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the suggested-by-photographer badge and existing comments for the open photo', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(screen.getByText(/suggested by photographer/i)).toBeTruthy()
    expect(screen.getByText(/Lovely/)).toBeTruthy()
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
  })

  it('does not show the suggested badge for a photo with no photographer like', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(screen.queryByText(/suggested by photographer/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: FAIL — `ClientGallery`'s current `GalleryPhoto` type doesn't have `likedByMe`/`suggestedByPhotographer`/`comments`, so TypeScript/the missing UI causes the new assertions to fail (the first 3 tests, unchanged from Plan 3, still pass).

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

export function ClientGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
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
Expected: PASS (5 tests).

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
      <ClientGallery photos={photos} />
    </main>
  )
}
```

- [ ] **Step 6: Replace the full contents of `src/app/albums/[albumId]/page.tsx`**

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

- [ ] **Step 7: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ClientGallery.tsx tests/components/ClientGallery.test.tsx src/app/a/\[shareToken\]/page.tsx src/app/albums/\[albumId\]/page.tsx
git commit -m "Wire likes and comments into the client gallery and album detail page"
```

---

### Task 8: Manual end-to-end verification

This exercises the full interaction loop across both surfaces, plus the real Drive shortcut sync — the parts that can't be meaningfully unit-tested without live credentials and two simultaneous "viewers" (photographer + anonymous client). Do this after Tasks 1–7 are complete and committed.

**Prerequisites:**
- Plans 1–3's manual verification already done (an album exists with photos, a password set, and a working share link).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Photographer suggests a photo**

Signed in as the photographer, open the album detail page. Click "⭐ Suggest to client" on one photo. Expected: the button's label switches to show the "on" state.

- [ ] **Step 3: Photographer adds a comment**

On the same photo, post a comment (e.g. "This one's my favorite"). Expected: it appears in that photo's comment list immediately after the page refreshes.

- [ ] **Step 4: Client views the album**

In a private/incognito window, open the share link, enter the password and a name (e.g. "Jane Doe"), reach the gallery.

- [ ] **Step 5: Confirm the suggestion and comment are visible to the client**

Open the lightbox for the photo suggested in Step 2. Expected: "⭐ Suggested by photographer" is shown, and the photographer's comment from Step 3 appears in the thread.

- [ ] **Step 6: Client selects a different photo**

In the lightbox for a *different* photo, click "❤ Select this photo". Expected: the button switches to its "on" state after the refresh.

- [ ] **Step 7: Client adds a comment**

On that same photo, post a comment (e.g. "Love this one!"). Expected: it appears in the thread, labeled with the name entered in Step 4.

- [ ] **Step 8: Confirm the Drive shortcut was created**

Open the album's `Selected` folder in Google Drive. Expected: a new shortcut appears, pointing at the photo selected in Step 6 (opening the shortcut should navigate to that original file).

- [ ] **Step 9: Photographer sees the client's activity**

Reload the photographer's album detail page. Expected: the photo selected in Step 6 now shows "❤ Selected by: Jane Doe", and the client's comment from Step 7 appears in that photo's thread (alongside any earlier photographer comments, in chronological order).

- [ ] **Step 10: Client unselects the photo**

Back in the incognito window, click "❤ Select this photo" again on the same photo to toggle it off. Expected: the button reverts to its "off" state.

- [ ] **Step 11: Confirm the Drive shortcut was removed**

Reload the `Selected` folder in Google Drive. Expected: the shortcut from Step 8 is gone. The original photo file itself is untouched (still visible in the main album folder).

- [ ] **Step 12: Confirm the photographer's page reflects the removal**

Reload the photographer's album detail page again. Expected: "❤ Selected by: ..." no longer appears for that photo (or shows only other clients, if any).
