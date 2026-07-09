# Album Editing (Rename, Change Client, Cover Photo) — Design Spec

## Overview

There is currently no way to edit an album after creation — the name, client name, and any cover photo are fixed at creation time forever. This spec adds a single `PATCH /api/albums/[albumId]` route covering all three: renaming the album, changing the client name, and setting a cover photo chosen from among the album's own already-uploaded photos.

**This is a backend-only spec.** The UI (an "Edit album" action reachable from a new "..." menu on the dashboard's album cards) is specified separately in `2026-07-09-ui-architecture-adr.md`'s D9.

## Decisions

- **The cover photo is always one of the album's own existing `Photo` rows** — never a separately uploaded image. This reuses the existing upload/thumbnail infrastructure entirely; no new Drive or Blob storage path is introduced. A direct consequence: an album with zero photos yet has no cover photo option available (the UI should reflect this — nothing to fix here, it's inherent to the decision).
- **All three fields are independently optional in the update request** — a photographer can rename without touching the client name or cover, or set only a cover, etc. This is a partial update (`PATCH` semantics), not a full-replace.

## Data Model

```prisma
model Album {
  // ...existing fields unchanged...
  coverPhotoId String?
  coverPhoto   Photo?  @relation("AlbumCoverPhoto", fields: [coverPhotoId], references: [id])
}

model Photo {
  // ...existing fields unchanged...
  coverOfAlbums Album[] @relation("AlbumCoverPhoto")
}
```

(A named relation is required since `Photo`/`Album` already have a different, unnamed relation between them — `Photo.album`/`Album.photos` — for photo membership; this is a second, independent relation for the cover-photo reference.) No `onDelete` behavior is needed on this new relation — there is no delete-single-photo feature anywhere in this app yet, so the referenced `Photo` row can never disappear out from under a `coverPhotoId` reference.

## API Change: `PATCH /api/albums/[albumId]`

Added to the existing `src/app/api/albums/[albumId]/route.ts` (which already has a `DELETE` handler from the album-deletion plan) as a new exported `PATCH` function, not a new file.

- Requires an active session; `canManageAlbum` gates it exactly like `DELETE` on the same route (owner or ADMIN only).
- Body: `{ name?: string; clientName?: string; coverPhotoId?: string | null }` — every field optional; only the fields present in the body are updated. Passing `coverPhotoId: null` explicitly clears the cover photo (distinct from omitting the field, which leaves it unchanged).
- If `coverPhotoId` is provided (and not `null`), it must reference a `Photo` row that belongs to *this* album (`photo.albumId === albumId`) — reject with `400` otherwise. This prevents a photographer from setting another album's photo (even one of their own other albums) as this album's cover, which would be a data-integrity/authorization mixup, not just a cosmetic error.
- `name`/`clientName`, if provided, must be non-empty strings (same validation the create-album route already applies) — reject with `400` for an empty string.
- On success: returns the updated `Album` row. `401`/`404`/`403` follow the same conventions as every other album route.

## Error Handling

Same conventions as every prior plan: `{ error: string }` JSON bodies with appropriate status codes; no partial/inconsistent state — the update is a single `prisma.album.update` call, either the whole request succeeds or nothing changes.

## Testing

- `401` no session, `404` album not found, `403` non-owner PHOTOGRAPHER (asserting `prisma.album.update` is never called).
- Updates `name` only, leaving `clientName`/`coverPhotoId` untouched (assert the exact `data` object passed to `prisma.album.update` contains only the changed field).
- Updates `clientName` only, same assertion pattern.
- Sets `coverPhotoId` to a photo that genuinely belongs to the album — succeeds.
- Rejects (`400`) a `coverPhotoId` belonging to a *different* album, or a nonexistent photo id — and does not call `prisma.album.update` in that case.
- Explicitly clearing the cover (`coverPhotoId: null`) — succeeds, sets it back to `null`.
- Rejects (`400`) an empty-string `name` or `clientName`.

## Out of Scope

- Uploading a dedicated cover image separate from the album's own photos (explicit decision above).
- Any UI (see the ADR's D9 for the "..." menu / edit form this route is meant to be called from).
- Editing anything else about an album (password, download toggle, Drive folder) — those already have their own dedicated routes from earlier plans and are unaffected by this one.
