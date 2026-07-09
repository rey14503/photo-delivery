# Album Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PATCH /api/albums/[albumId]` so a photographer can rename an album, change its client name, and set/clear a cover photo chosen from among the album's own existing photos.

**Architecture:** One new nullable `coverPhotoId` field on `Album`, referencing `Photo` via a second, explicitly-named relation (since `Photo`/`Album` already have an unnamed one for plain membership). One new `PATCH` handler added to the existing `src/app/api/albums/[albumId]/route.ts` (which already has `DELETE` from a prior plan), doing a single partial `prisma.album.update` call gated by the existing `canManageAlbum` check.

**Tech Stack:** Same as every prior plan (Next.js 15, Prisma 5, Vitest).

## Global Constraints

- **This plan is backend-only.** No UI files are touched — the "Edit album" form and the dashboard card's "..." menu that triggers it are specified separately (`2026-07-09-ui-architecture-adr.md`, D9) for a different, concurrently-active UI effort to build against this route.
- **Add the `PATCH` handler to the existing `src/app/api/albums/[albumId]/route.ts` file** — do not create a second route file for the same path. Read the current file first; it already has a `DELETE` export from the album-deletion plan.
- **Add the new tests to the existing `tests/api/albums-albumId.test.ts` file** as a new `describe('PATCH ...', ...)` block — do not create a second test file for the same route file.
- **The cover photo is always one of the album's own `Photo` rows.** Reject (`400`) any `coverPhotoId` that doesn't belong to the target album — this is both a data-integrity and an authorization boundary (never let a photographer point one album's cover at a photo from a different album, even one they also own).
- Before touching either file, run `git status --short` and `git log --oneline -3 -- src/app/api/albums/[albumId]/route.ts` to confirm current state — a separate UI effort may be concurrently active elsewhere in the tree, though this specific route file is unlikely to be UI-owned territory.

---

## File Structure

```
photo-delivery/
├── prisma/
│   ├── schema.prisma                          (modified: +Album.coverPhotoId +relation)
│   └── migrations/<timestamp>_album_cover_photo/  (new)
├── src/
│   └── app/api/albums/[albumId]/route.ts       (modified: +PATCH export)
└── tests/
    └── api/albums-albumId.test.ts              (modified: +PATCH describe block)
```

---

### Task 1: Schema — `Album.coverPhotoId`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_album_cover_photo/` (generated)

**Interfaces:**
- Produces: `Album.coverPhotoId: string | null`, `Album.coverPhoto: Photo | null` (relation). Consumed by Task 2.

- [ ] **Step 1: Add the field and relation to `prisma/schema.prisma`**

In `model Album`, add (anywhere among the existing scalar fields, e.g. right after `downloadEnabled`):
```prisma
  coverPhotoId     String?
  coverPhoto       Photo?   @relation("AlbumCoverPhoto", fields: [coverPhotoId], references: [id])
```

In `model Photo`, add (anywhere among the existing relation fields, e.g. near `likes`/`comments`):
```prisma
  coverOfAlbums Album[] @relation("AlbumCoverPhoto")
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name album_cover_photo`
Expected: a new folder under `prisma/migrations/`, local database updated, Prisma Client regenerated with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Album.coverPhotoId, referencing one of the album's own photos"
```

---

### Task 2: `PATCH /api/albums/[albumId]`

**Files:**
- Modify: `src/app/api/albums/[albumId]/route.ts`
- Modify: `tests/api/albums-albumId.test.ts`

**Interfaces:**
- Produces: `PATCH /api/albums/[albumId]` (body `{ name?: string; clientName?: string; coverPhotoId?: string | null }`) → `200` with the updated album, or `400`/`401`/`403`/`404`.

- [ ] **Step 1: Write the failing tests**

Read the current full content of `tests/api/albums-albumId.test.ts` first. Add `PATCH` to the import from `@/app/api/albums/[albumId]/route`, add `photo: { findUnique: vi.fn() }` to the existing `vi.mock('@/lib/prisma', ...)` factory's returned object (alongside the existing `album: {...}`), then append this new `describe` block after the existing `describe('DELETE ...', ...)` block:

```ts
describe('PATCH /api/albums/[albumId]', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

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

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

    expect(res.status).toBe(403)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty name', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)

    const res = await PATCH(jsonRequest({ name: '' }), routeParams('album_1'))

    expect(res.status).toBe(400)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('updates only the name when only name is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1', name: 'New name' } as never)

    const res = await PATCH(jsonRequest({ name: 'New name' }), routeParams('album_1'))

    expect(res.status).toBe(200)
    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { name: 'New name' },
    })
  })

  it('updates only the clientName when only clientName is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1' } as never)

    await PATCH(jsonRequest({ clientName: 'New client' }), routeParams('album_1'))

    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { clientName: 'New client' },
    })
  })

  it('sets coverPhotoId when it belongs to this album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_1',
      albumId: 'album_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1' } as never)

    await PATCH(jsonRequest({ coverPhotoId: 'photo_1' }), routeParams('album_1'))

    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { coverPhotoId: 'photo_1' },
    })
  })

  it('returns 400 when coverPhotoId belongs to a different album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'photo_9',
      albumId: 'some_other_album',
    } as never)

    const res = await PATCH(jsonRequest({ coverPhotoId: 'photo_9' }), routeParams('album_1'))

    expect(res.status).toBe(400)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('returns 400 when coverPhotoId does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    const res = await PATCH(jsonRequest({ coverPhotoId: 'missing_photo' }), routeParams('album_1'))

    expect(res.status).toBe(400)
    expect(prisma.album.update).not.toHaveBeenCalled()
  })

  it('clears coverPhotoId when explicitly set to null', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({ id: 'album_1' } as never)

    await PATCH(jsonRequest({ coverPhotoId: null }), routeParams('album_1'))

    expect(prisma.photo.findUnique).not.toHaveBeenCalled()
    expect(prisma.album.update).toHaveBeenCalledWith({
      where: { id: 'album_1' },
      data: { coverPhotoId: null },
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/albums-albumId.test.ts`
Expected: FAIL — `PATCH` is not exported from `@/app/api/albums/[albumId]/route` (the pre-existing `DELETE` tests still pass).

- [ ] **Step 3: Add the `PATCH` handler**

Add `prisma.photo` usage requires no new import (the file already imports `prisma`). Append to `src/app/api/albums/[albumId]/route.ts`:

```ts
export async function PATCH(
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
  const { name, clientName, coverPhotoId } = body as {
    name?: string
    clientName?: string
    coverPhotoId?: string | null
  }

  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'name must not be empty' }, { status: 400 })
  }
  if (clientName !== undefined && !clientName) {
    return NextResponse.json({ error: 'clientName must not be empty' }, { status: 400 })
  }

  const data: { name?: string; clientName?: string; coverPhotoId?: string | null } = {}
  if (name !== undefined) data.name = name
  if (clientName !== undefined) data.clientName = clientName

  if (coverPhotoId !== undefined) {
    if (coverPhotoId === null) {
      data.coverPhotoId = null
    } else {
      const photo = await prisma.photo.findUnique({ where: { id: coverPhotoId } })
      if (!photo || photo.albumId !== albumId) {
        return NextResponse.json(
          { error: 'coverPhotoId must reference a photo in this album' },
          { status: 400 }
        )
      }
      data.coverPhotoId = coverPhotoId
    }
  }

  const updated = await prisma.album.update({ where: { id: albumId }, data })

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums-albumId.test.ts`
Expected: PASS (15 tests: 5 pre-existing `DELETE` tests plus 10 new `PATCH` tests).

- [ ] **Step 5: Run the full suite and verify the build**

Run: `npx vitest run` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/albums/\[albumId\]/route.ts tests/api/albums-albumId.test.ts
git commit -m "Add PATCH /api/albums/[albumId] for renaming, client name, and cover photo"
```

---

### Task 3: Manual end-to-end verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Rename and change client name**

While signed in as an album's owner, `PATCH /api/albums/<id>` with `{"name": "Renamed"}`, then separately with `{"clientName": "New Client"}`. Expected: each call updates only the targeted field; reload the album and confirm both changes stuck.

- [ ] **Step 3: Set and clear a cover photo**

`PATCH` with `{"coverPhotoId": "<a real photo id from this album>"}` — expect success. Then `{"coverPhotoId": "<a photo id from a different album>"}` — expect `400`. Then `{"coverPhotoId": null}` — expect success, clearing it.
