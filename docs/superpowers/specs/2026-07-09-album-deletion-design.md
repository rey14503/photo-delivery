# Album Deletion + Drive-Folder-Gone Sync — Design Spec

## Overview

There is currently no way to delete an album from this app at all — not manually, and not in response to the underlying Drive folder disappearing. This spec adds both: an explicit "delete album" action for the photographer, and a lazy check that removes an album from the app if its linked Drive folder is confirmed gone (deleted or trashed externally), so the web app never keeps showing an album whose real photos no longer exist.

**This is a backend-only spec.** No UI files are in scope — a "Delete album" control in the dashboard/album-detail UI is specified separately (see the UI spec addendum in `2026-07-09-ui-architecture-adr.md`) and consumes the route this spec defines.

## Decisions

- **Deleting an album on the web never deletes anything on Google Drive.** The photographer's real folder and photos stay exactly as they are. Only this app's own data (the `Album` row and everything under it — `Photo`, `Like`, `Comment` rows, plus the cached thumbnail/preview Blob objects are left as harmless orphans, matching this project's existing no-cleanup-job precedent) is removed.
- **If the linked Drive folder is confirmed gone (not found, or trashed), the album is automatically deleted from the app the next time the photographer opens it** — no confirmation prompt, no undo. This is a deliberate choice (see the question this was resolved from): a Drive-side deletion is treated as an unambiguous signal the photographer wants the album gone.
- **The automatic check only ever triggers on a *confirmed* absence** — a Drive API 404 (file truly not found) or a folder resolved with `trashed: true`. Any other Drive API failure (network error, rate limit, a transient permission error, an unexpected response shape) must NOT trigger deletion — those are reported as a transient error and the album is left untouched. This distinction matters because the chosen behavior is destructive; it must never fire on a Drive hiccup that has nothing to do with the folder actually being gone.
- **The automatic check only runs when the photographer opens their own album detail page** — not on every client share-page view. Clients aren't the ones who'd delete a photographer's Drive folder, and checking on every client page load would add Drive API calls (and quota usage) with no benefit.

## Data Model

Add cascade deletes so removing an `Album` row cleanly removes its `Photo`/`Like`/`Comment` rows without a manual multi-step delete in application code:

```prisma
model Photo {
  // ...
  album Album @relation(fields: [albumId], references: [id], onDelete: Cascade)
  // ...
}

model Like {
  // ...
  photo Photo @relation(fields: [photoId], references: [id], onDelete: Cascade)
  // ...
}

model Comment {
  // ...
  photo Photo @relation(fields: [photoId], references: [id], onDelete: Cascade)
  // ...
}
```

(Only the `onDelete: Cascade` addition to these three existing relations — no new fields, no new models.)

## New Route: `DELETE /api/albums/[albumId]`

- Requires an active session; `canManageAlbum` gates it exactly like every other album-management route (owner or ADMIN only).
- On success: deletes the `Album` row (cascading to `Photo`/`Like`/`Comment` per the schema change above). No Drive calls of any kind. Returns `204` with an empty body.
- `401` no session, `404` album not found, `403` not the owner/admin — same conventions as every other album route.

## Drive-Folder-Gone Check

A new function, `driveFolderIsGone(drive, folderId): Promise<boolean>`, added to `src/lib/drive.ts`:
- Calls `drive.files.get({ fileId: folderId, fields: 'trashed' })`.
- Returns `true` if the call resolves with `trashed: true`, or if it rejects with a Drive "not found" error (HTTP 404 — check the thrown error's `code`/`status`, matching how the existing `canEditFolder` already distinguishes real Drive errors).
- Returns `false` for a successful, non-trashed resolution, **and also `false` for any other kind of failure** (network error, 403, 5xx, malformed response) — the caller must never treat an ambiguous failure as "gone." This is the safety-critical distinction from the Decisions section above; get this function's error handling right, since everything downstream trusts its `true` to mean "confirmed gone," not "something went wrong."

`GET /albums/[albumId]` (the photographer's server-rendered album detail page — currently a plain data fetch) gains one extra step: after loading the `Album` (with its `owner`), call `getDriveClientForUser(album.owner)` and `driveFolderIsGone(drive, album.driveFolderId)`. If `true`: delete the `Album` row (same cascade as the manual delete route — reuse the same underlying delete logic, don't duplicate it) and render a "This album's Drive folder was deleted, so it was removed" message instead of the album, with a link back to the dashboard. If `false` (folder still there) or the check itself failed to run cleanly for a non-"gone" reason: render the album normally, exactly as today — the check must never block or degrade the normal page render for a transient Drive issue.

## Error Handling

Same conventions as every prior plan: `{ error: string }` JSON bodies with appropriate status codes for the `DELETE` route; the page-level auto-delete check never surfaces a raw error to the photographer if the Drive call itself fails for a non-"gone" reason — it silently falls through to rendering the album normally (the check is a best-effort enhancement, not a hard dependency of the page loading at all).

## Testing

- `driveFolderIsGone`: `trashed: true` → `true`; a real 404 → `true`; a non-trashed successful response → `false`; a network/permission/5xx error → `false` (never `true` for an ambiguous failure — this is the single most important test in this spec).
- `DELETE /api/albums/[albumId]`: `401`/`404`/`403` same as other routes; happy path deletes the `Album` row and cascades — assert the mocked `prisma.album.delete` was called with the right `where`, and (since this is tested against a mocked Prisma client) that no Drive client/call is invoked at all.
- The album detail page's auto-delete check: folder confirmed gone → album deleted, "removed" message rendered, no crash; folder present → page renders normally; Drive call throws a non-"gone" error → page still renders normally, no album deleted, no error surfaced to the user.

## Out of Scope

- Deleting the actual Drive folder/photos — never happens from this app, by explicit decision.
- Any UI (the delete button/confirmation, the "album was removed" page) — see the UI spec addendum.
- Cleaning up orphaned Vercel Blob cache objects after a delete — accepted as harmless waste, matching this project's existing no-cleanup-job precedent (see Plan 5's Global Constraints for the same reasoning applied to originals-caching).
- Checking for a gone folder anywhere except the photographer's own album detail page load (not on the client share page, not as a background job — no such infrastructure exists in this app).
