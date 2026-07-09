# Album Deletion + Drive-Folder-Gone Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `DELETE /api/albums/[albumId]` route (photographer-initiated deletion), plus an automatic check on the photographer's own album detail page that deletes the album from the app if its linked Drive folder is confirmed gone (not found, or trashed) — without ever deleting anything on Drive itself.

**Architecture:** A new `driveFolderIsGone` Drive-service function (careful to only ever return `true` on an unambiguous "gone" signal, `false` for everything else including transient errors) composed with a small `deleteAlbumIfDriveFolderGone` lifecycle helper that both the automatic page-load check and (indirectly, by sharing the same underlying `prisma.album.delete` cascade) the manual delete route rely on. Schema gains cascade deletes so removing an `Album` row cleanly removes its `Photo`/`Like`/`Comment` rows in one call.

**Tech Stack:** Same as every prior plan (Next.js 15, Prisma 5, googleapis, Vitest).

## Global Constraints

- **This plan is backend-only.** No UI files are touched — a "Delete album" UI control and an "album was removed" page are specified separately for a different, concurrently-active UI effort to build against this plan's routes.
- **Never delete anything on Google Drive.** Every function/route in this plan only ever reads from Drive (`driveFolderIsGone`'s single `files.get` call) or writes to this app's own database — never `deleteFile` or any other Drive mutation.
- **`driveFolderIsGone` must only return `true` on a confirmed-gone signal** (a real 404, or a successful response with `trashed: true`). Every other failure mode (network error, permission error, malformed response, anything ambiguous) must return `false`. This is the single most safety-critical property in this plan — the caller treats `true` as license to delete data, so a false positive here is a real data-loss bug, not a cosmetic one.
- **The automatic gone-folder check only runs on the photographer's own album detail page (`GET /albums/[albumId]`), never on the public client share page and never as a background job** — no background-job infrastructure exists in this app.
- Before touching `src/app/albums/[albumId]/page.tsx` in Task 5, read its actual current content first — it may have changed since this plan was written (a separate UI effort is concurrently active on this exact file). Adapt the insertion point to whatever the current file looks like; the important part is the two lines of new logic (the gone-check + conditional early return), not matching this plan's snapshot of the surrounding JSX verbatim.

---

## File Structure

```
photo-delivery/
├── prisma/
│   ├── schema.prisma                          (modified: +onDelete: Cascade on 3 relations)
│   └── migrations/<timestamp>_cascade_delete_album/  (new)
├── src/
│   ├── app/
│   │   ├── albums/[albumId]/page.tsx           (modified: +gone-folder auto-delete check)
│   │   └── api/
│   │       └── albums/[albumId]/route.ts       (new: DELETE handler)
│   └── lib/
│       ├── drive.ts                            (modified: +driveFolderIsGone)
│       └── album-lifecycle.ts                  (new: deleteAlbumIfDriveFolderGone)
└── tests/
    ├── lib/
    │   ├── drive.test.ts                       (modified: +driveFolderIsGone tests)
    │   └── album-lifecycle.test.ts             (new)
    └── api/
        └── albums-albumId.test.ts              (new: DELETE handler tests)
```

---

### Task 1: Schema — cascade deletes

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_cascade_delete_album/` (generated)

**Interfaces:**
- Produces: deleting an `Album` row now cascades through `Photo` → `Like`/`Comment` at the database level. Consumed implicitly by Task 4's `DELETE` route and Task 3's lifecycle helper — neither needs to manually delete child rows.

- [ ] **Step 1: Add `onDelete: Cascade` to three relations in `prisma/schema.prisma`**

In `model Photo`, change:
```prisma
  album        Album     @relation(fields: [albumId], references: [id])
```
to:
```prisma
  album        Album     @relation(fields: [albumId], references: [id], onDelete: Cascade)
```

In `model Like`, change:
```prisma
  photo           Photo     @relation(fields: [photoId], references: [id])
```
to:
```prisma
  photo           Photo     @relation(fields: [photoId], references: [id], onDelete: Cascade)
```

In `model Comment`, change:
```prisma
  photo     Photo     @relation(fields: [photoId], references: [id])
```
to:
```prisma
  photo     Photo     @relation(fields: [photoId], references: [id], onDelete: Cascade)
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name cascade_delete_album`
Expected: a new folder under `prisma/migrations/` is created, the local database is updated, the Prisma Client is regenerated with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Cascade-delete Photo/Like/Comment rows when their Album is deleted"
```

---

### Task 2: `driveFolderIsGone`

**Files:**
- Modify: `src/lib/drive.ts`
- Modify: `tests/lib/drive.test.ts`

**Interfaces:**
- Produces: `driveFolderIsGone(drive, folderId: string): Promise<boolean>`. Consumed by Task 3 (`deleteAlbumIfDriveFolderGone`).

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to the end of `tests/lib/drive.test.ts` (after the `listFolderFiles` block added by the prior Drive-link-album-creation plan — if that plan hasn't landed yet on the branch you're working from, append after whatever the current last `describe` block is; import `driveFolderIsGone` alongside the other named imports from `@/lib/drive` at the top of the file):

```ts
describe('driveFolderIsGone', () => {
  it('returns true when the folder resolves as trashed', async () => {
    filesGet.mockResolvedValue({ data: { trashed: true } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    expect(await driveFolderIsGone(drive, 'folder_1')).toBe(true)
    expect(filesGet).toHaveBeenCalledWith({ fileId: 'folder_1', fields: 'trashed' })
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
```

Also add `driveFolderIsGone` to the existing named import list from `@/lib/drive` near the top of the test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: FAIL — `driveFolderIsGone` is not exported from `@/lib/drive`.

- [ ] **Step 3: Add `driveFolderIsGone` to the end of `src/lib/drive.ts`**

```ts
export async function driveFolderIsGone(
  drive: drive_v3.Drive,
  folderId: string
): Promise<boolean> {
  try {
    const res = await drive.files.get({ fileId: folderId, fields: 'trashed' })
    return res.data.trashed === true
  } catch (error) {
    const code = (error as { code?: number })?.code
    return code === 404
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: PASS, with 5 new tests over whatever the pre-existing count was on the branch you're working from.

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.ts tests/lib/drive.test.ts
git commit -m "Add driveFolderIsGone, confirming only on a real 404 or trashed:true"
```

---

### Task 3: `deleteAlbumIfDriveFolderGone`

**Files:**
- Create: `src/lib/album-lifecycle.ts`
- Create: `tests/lib/album-lifecycle.test.ts`

**Interfaces:**
- Consumes: `driveFolderIsGone` (Task 2).
- Produces: `deleteAlbumIfDriveFolderGone(drive, album: { id: string; driveFolderId: string }): Promise<boolean>` — returns `true` and deletes the `Album` row if the folder was confirmed gone, `false` (no deletion) otherwise. Consumed by Task 5 (the album detail page).

- [ ] **Step 1: Write the failing tests**

`tests/lib/album-lifecycle.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/album-lifecycle.test.ts`
Expected: FAIL — cannot find module `@/lib/album-lifecycle`.

- [ ] **Step 3: Write `src/lib/album-lifecycle.ts`**

```ts
import type { drive_v3 } from 'googleapis'
import { prisma } from './prisma'
import { driveFolderIsGone } from './drive'

export async function deleteAlbumIfDriveFolderGone(
  drive: drive_v3.Drive,
  album: { id: string; driveFolderId: string }
): Promise<boolean> {
  const gone = await driveFolderIsGone(drive, album.driveFolderId)
  if (!gone) {
    return false
  }
  await prisma.album.delete({ where: { id: album.id } })
  return true
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/album-lifecycle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/album-lifecycle.ts tests/lib/album-lifecycle.test.ts
git commit -m "Add deleteAlbumIfDriveFolderGone lifecycle helper"
```

---

### Task 4: `DELETE /api/albums/[albumId]`

**Files:**
- Create: `src/app/api/albums/[albumId]/route.ts`
- Create: `tests/api/albums-albumId.test.ts`

**Interfaces:**
- Consumes: `canManageAlbum` (existing, `src/lib/album-permissions.ts`).
- Produces: `DELETE /api/albums/[albumId]` → `204` on success, `401`/`404`/`403` otherwise.

**Note:** if `src/app/api/albums/[albumId]/route.ts` already exists by the time you run this task (check first — it's plausible another concurrently-developed feature added one), add the `DELETE` export to that existing file alongside whatever else is there, rather than overwriting it; adapt the test file the same way, adding a new `describe('DELETE ...')` block to whatever test file already covers that route rather than replacing it wholesale.

- [ ] **Step 1: Write the failing tests**

`tests/api/albums-albumId.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn(), delete: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { DELETE } from '@/app/api/albums/[albumId]/route'

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/albums/[albumId]', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await DELETE({} as never, routeParams('album_1'))

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

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(403)
    expect(prisma.album.delete).not.toHaveBeenCalled()
  })

  it('deletes the album and returns 204 for the owner', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(204)
    expect(prisma.album.delete).toHaveBeenCalledWith({ where: { id: 'album_1' } })
  })

  it('deletes the album and returns 204 for an ADMIN who does not own it', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin_1', role: 'ADMIN' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
    } as never)
    vi.mocked(prisma.album.delete).mockResolvedValue({} as never)

    const res = await DELETE({} as never, routeParams('album_1'))

    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/albums-albumId.test.ts`
Expected: FAIL — cannot find module `@/app/api/albums/[albumId]/route`.

- [ ] **Step 3: Write `src/app/api/albums/[albumId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'

export async function DELETE(
  _request: NextRequest,
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

  await prisma.album.delete({ where: { id: albumId } })

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums-albumId.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/albums/\[albumId\]/route.ts tests/api/albums-albumId.test.ts
git commit -m "Add DELETE /api/albums/[albumId] for photographer-initiated album deletion"
```

---

### Task 5: Wire the auto-delete check into the album detail page

**Files:**
- Modify: `src/app/albums/[albumId]/page.tsx`

**Interfaces:**
- Consumes: `deleteAlbumIfDriveFolderGone` (Task 3), `getDriveClientForUser` (existing).

**No dedicated test file for this task** — page-level Server Components in this codebase are not directly unit-tested (see any other page under `src/app/`); the logic this task adds is a thin call into `deleteAlbumIfDriveFolderGone`, which already has its own full test coverage from Task 3. This task's correctness is verified by Task 6's manual walkthrough.

- [ ] **Step 1: Read the current file**

Run: `cat "src/app/albums/[albumId]/page.tsx"` (prefixed with the mandatory `cd` if you're a dispatched subagent) and read it in full before editing — per this plan's Global Constraints, a separate UI effort may have changed this file since the plan was written.

- [ ] **Step 2: Insert the gone-folder check**

Find where the page currently loads the `album` (a `prisma.album.findUnique` call that includes `owner`) and checks `canManageAlbum`/renders `notFound()` for a missing/forbidden album. Immediately after that existing check (i.e., once you know a valid, accessible album exists), insert:

```ts
  const drive = getDriveClientForUser(album.owner)
  const wasDeleted = await deleteAlbumIfDriveFolderGone(drive, {
    id: album.id,
    driveFolderId: album.driveFolderId,
  })
  if (wasDeleted) {
    return (
      <main>
        <h1>This album is no longer available</h1>
        <p>Its Google Drive folder was deleted, so the album was removed.</p>
        <a href="/albums">Back to your albums</a>
      </main>
    )
  }
```

Add the two new imports at the top of the file alongside the existing ones:

```ts
import { getDriveClientForUser } from '@/lib/drive'
import { deleteAlbumIfDriveFolderGone } from '@/lib/album-lifecycle'
```

(If `getDriveClientForUser` is already imported in the current file for some other reason, don't duplicate the import — just add `deleteAlbumIfDriveFolderGone`.)

Everything below this insertion — the rest of the page's existing render logic — stays exactly as it already is; this task only adds the one early-return branch above it.

- [ ] **Step 3: Verify the app builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: no regressions (this task added no new automated tests, per the note above, but must not break any existing ones).

- [ ] **Step 5: Commit**

```bash
git add "src/app/albums/[albumId]/page.tsx"
git commit -m "Auto-delete an album when its linked Drive folder is confirmed gone"
```

---

### Task 6: Manual end-to-end verification

This exercises real Drive API responses (a genuine 404, a genuine `trashed: true`) that mocks can't fully substitute for.

**Prerequisites:** an existing test album linked to a real Drive folder you can freely trash/delete.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify manual deletion**

While signed in as the album's owner, call `DELETE /api/albums/<id>` (e.g. via `curl` with your session cookie, or once UI exists for it). Expected: `204`; the album no longer appears in `GET /api/albums`; the Drive folder is untouched (check Drive directly).

- [ ] **Step 3: Verify the gone-folder auto-delete — trashed case**

Trash (don't permanently delete) the Drive folder for a second test album directly in Drive. Reload that album's detail page (`/albums/<id>`) as its owner. Expected: the "This album is no longer available" message renders, and `GET /api/albums` no longer lists it.

- [ ] **Step 4: Verify the gone-folder auto-delete — not-found case**

For a third test album, permanently delete its Drive folder (empty the trash, or use a folder ID that never existed by editing the DB row directly via Prisma Studio for this test). Reload its detail page. Expected: same "no longer available" outcome.

- [ ] **Step 5: Verify a transient error does NOT delete anything**

Temporarily break Drive connectivity for a legitimate, still-existing album — e.g. briefly revoke/corrupt the stored refresh token via Prisma Studio, or disconnect network access to `googleapis.com` while loading the page — and confirm the album detail page still renders normally (or shows a generic error, but critically: the `Album` row must still exist in the database afterward, restore the token/connectivity and confirm the album is still there).
