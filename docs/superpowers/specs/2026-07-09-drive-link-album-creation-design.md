# Create Album via Google Drive Link — Design Spec

## Overview

Today, creating an album always auto-creates a brand-new, empty Drive folder (plus a nested "Selected" subfolder) via `createAlbumFolders`, and photos are added afterward one at a time through the upload UI (Plan 2). Many photographers already have a folder of edited photos sitting in their Drive from their normal workflow, and re-uploading each one through the app is wasted effort. This spec replaces album creation with a Drive-link-based flow, modeled on ShotPik's own "Create album" form: the photographer pastes a link to an existing Drive folder, and the app adopts that folder as the album's storage, importing every supported image already inside it as `Photo` rows.

This is a full replacement of the creation flow, not an additional option — the old "always create a new empty folder" behavior is removed entirely, per explicit decision.

**Scope note:** this spec covers *only* the server side — `POST /api/albums`'s request/response contract and the new `src/lib/drive.ts` functions it needs. **`CreateAlbumForm.tsx` and every other UI file are explicitly out of scope and must not be touched by this plan.** As of this spec, `CreateAlbumForm.tsx` already has its own `googleDriveLink` input field and a much richer set of fields/toggles (client email, location, category, refresh time, comments/password/download toggles, a selection-limit field) built independently, as part of a separate, actively in-progress dashboard redesign effort. This backend work only needs to accept `driveLink` in the POST body under that same name the form already uses (`googleDriveLink` client-side, sent as `driveLink` in the request body — confirm this exact key against the form's current `fetch` call before implementing, since the form owner may adjust it) and return `{ imported, skipped }` in the response for that UI to consume however it already plans to. Every other ShotPik-inspired field (album cover photo, comments toggle, password/download toggles at creation time, a photo-selection-limit field, and a scheduled auto-resync interval) is being handled by that separate UI effort or is independent future backend work — not part of this spec. Face-search is out of scope permanently, not deferred.

## Goals

- Replace `POST /api/albums`'s empty-folder creation with: parse a Drive folder link → validate access → adopt the folder → import its existing supported images as `Photo` rows.
- Reuse every existing building block (`downloadOriginal` from Plan 5, `processImage` from Plan 2, the Blob-caching convention from Plan 2, `createFolder` from Plan 1) — no duplicated Drive-fetching or image-processing logic.
- Fail clearly and before creating anything if the link is invalid or the connected account lacks edit access — never leave a partially-created album behind.

## Flow

1. Photographer fills in the create-album form: **Drive folder link** (required), **album name** (required), **client name** (required, unchanged from today).
2. Server parses the link to extract a Drive folder ID. Supported form: `https://drive.google.com/drive/folders/<id>`, with or without a trailing query string (e.g. `?usp=sharing`). An unparseable link is rejected with a 400 before any Drive call is made.
3. Server calls the Drive API to confirm the ID resolves to an existing, non-trashed folder that the connected account can edit (`capabilities.canEdit`). Any failure here (not found, not a folder, no edit access) is rejected with a 400 and a message telling the photographer to check sharing permissions — no Drive writes happen yet.
4. Server looks for an existing subfolder literally named `Selected` directly inside the linked folder. If found, it's reused as the album's `selectedFolderId`; if not, a new one is created (same mechanism as today's `createFolder`). This avoids creating a duplicate/confusing second "Selected" folder if the photographer already had one.
5. Server creates the `Album` row: `driveFolderId` = the linked folder's ID, `selectedFolderId` = from step 4, plus `name`/`clientName`/`ownerId`/`shareToken` exactly as today.
6. Server lists the files directly inside the linked folder (not recursing into subfolders — a subfolder like an existing "Selected" or "RAW" folder is never scanned for photos), filtering to `image/jpeg`, `image/png`, and `image/webp` mime types. Everything else (RAW formats, `.xmp` sidecars, videos, documents, other subfolders) is silently skipped and counted.
7. For each supported image file, in the order Drive returns them: download its bytes via the existing `downloadOriginal`, run the existing `processImage` to produce a thumbnail and preview, upload both to Blob using the same `drive-files/{driveFileId}/v1/{thumb|preview}.jpg` key convention as Plan 2's upload route, then create a `Photo` row using that file's *existing* Drive file ID — this is a registration of an already-uploaded file, not a new upload, so `uploadFile` is never called in this path. `displayOrder` is assigned sequentially in the order processed.
8. The response is the created album plus `{ imported: number, skipped: number }` — skipped counts every non-image file found, so the photographer can tell at a glance whether anything was left out.
9. This entire flow runs synchronously inside the one HTTP request. There is no background job, no pagination, and no hard cap on folder size — a very large folder may take a long time or, in the worst case, time out the request. This is a known, accepted MVP limitation (consistent with Plan 5's ZIP-download route, which made the same synchronous/no-cap tradeoff for the same reason: no job infrastructure exists in this app yet).

## Data Model

No schema changes. `Album.driveFolderId` and `Album.selectedFolderId` already exist (Plan 1) and are populated the same way as today, just sourced differently. `Photo` rows are created with the same shape Plan 2 already produces.

## API Changes

`POST /api/albums` — request body changes from `{ name, clientName }` to `{ name, clientName, driveLink }`, all three required. Response body changes from the bare `Album` record to `{ ...album, imported: number, skipped: number }`.

## Drive Service Additions (`src/lib/drive.ts`)

- `parseDriveFolderId(link: string): string | null` — extracts a folder ID from a Drive folder URL, or `null` if the link doesn't match the expected shape.
- `canEditFolder(drive, folderId: string): Promise<boolean>` — resolves the folder's metadata (`mimeType`, `capabilities.canEdit`, `trashed`) and returns whether it's a real, non-trashed, editable folder.
- `findOrCreateFolder(drive, name: string, parentId: string): Promise<string>` — lists `parentId`'s immediate children for one named exactly `name` of folder mime type; returns its ID if found, otherwise creates it via the existing folder-creation call.
- `listImageFiles(drive, folderId: string): Promise<{ id: string; name: string; mimeType: string }[]>` — lists non-trashed files directly inside `folderId` (not recursive) whose `mimeType` is one of `image/jpeg`, `image/png`, `image/webp`.

`createAlbumFolders` (the old always-create-both-folders helper) is no longer called from the album-creation route after this change; it's left in place since nothing else in this spec requires removing it, and removing dead code is out of scope here.

## UI Changes

None. This spec is server-only — see the Scope note above. Whoever owns `CreateAlbumForm.tsx` wires its existing Drive-link field to this API and decides how to surface `imported`/`skipped` in the UI; that is not decided or specified here.

## Error Handling

Follows the established convention throughout: `role="alert"` on the client for any failure, a generic `data.error ?? 'Something went wrong'` message surfaced from non-ok responses, `'Network error — please try again.'` for a thrown/rejected fetch. Server-side, every rejection (bad link, inaccessible folder, an unexpected error partway through import) returns a clear 400/500 with a `{ error }` body; on any failure before the `Album` row is created, nothing is written to the database. A failure partway through the *photo import* loop (after the album row already exists) does not roll back the album or already-imported photos — the album is still usable, just with fewer photos than expected; this is an accepted MVP limitation, not silently swallowed (the error still surfaces to the photographer).

## Testing

- `parseDriveFolderId`: valid link with/without query string, an unrelated URL, a bare folder ID with no URL wrapper, an empty string.
- `canEditFolder`: editable folder → true; view-only/no-access folder → false; a file ID (not a folder) → false; a trashed folder → false.
- `findOrCreateFolder`: existing "Selected" subfolder is reused (no new folder created); absent subfolder triggers creation.
- `listImageFiles`: mixed folder contents (jpg, png, ARW, xmp, mp4, a subfolder) return only the image files.
- `POST /api/albums`: missing/unparseable `driveLink` → 400, no Drive calls made; inaccessible folder → 400, no `Album` row created; happy path creates the `Album` with the linked folder's ID, imports only the supported images, returns the correct `imported`/`skipped` counts, and does not call the existing `uploadFile` function (proving imported photos register the existing Drive file rather than re-uploading it).

## Out of Scope

`CreateAlbumForm.tsx` and all other UI (see Scope note above). Every other ShotPik-inspired field (cover photo, comments toggle, password/download toggles at creation time, selection limits, scheduled auto-resync, face search) — each is independent future work, not part of this spec. Recursive subfolder scanning is also out of scope — only files directly inside the linked folder are imported.
