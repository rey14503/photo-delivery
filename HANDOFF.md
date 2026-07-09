# Handoff Notes

This project was built with Claude Code, then handed off for continued UI work (Antigravity, Google AI Studio). This file is the entry point — read it first. Rewritten after the drive-link and album-deletion backends landed and several rounds of UI-bug spec revisions; if you're picking this up fresh, everything below reflects the actual current state of `main`, not just the original plan.

## Repository

`https://github.com/rey14503/photo-delivery` (private). `main` is the only branch that matters — work directly on it or via short-lived feature branches merged back promptly; don't let work sit uncommitted for long, since this repo has multiple agents (you, and previously Claude Code) working on it concurrently, and uncommitted work is invisible to everyone else.

## Running locally

```bash
npm install
npx prisma generate   # regenerate the Prisma Client — do this after every fresh install
npm run dev
```

`.env` and `.env.local` already exist in this checkout with working real credentials (local Postgres, a real Google OAuth client with `drive.file` scope, a real Vercel Blob token). They are gitignored, so they exist only on this machine — never commit them. A `RESEND_API_KEY` is **not yet present** and is required before the (not-yet-built) forgot-password flow can be exercised for real.

Run the test suite with `npx vitest run` (255 tests, all passing as of this update) and verify the production build with `npx next build`.

## What's shipped and working on `main` (backend)

Every backend feature below is fully implemented, tested, and audited — this is not aspirational, it's what's actually there:

1. **Foundation** — Google OAuth w/ `drive.file` scope, Album model, per-photographer Drive folder creation.
2. **Upload & Versioning** — photo upload/replace, thumbnail/preview generation, Vercel Blob caching, `Photo.originalName` tracking.
3. **Client Album View** — password-gated share links, client-name capture, public gallery.
4. **Social Interactions** — client "select" vs. photographer "suggest" likes, comments, Drive-shortcut sync to a "Selected" folder.
5. **Download Permission** — per-album download toggle, single-photo/ZIP download routes.
6. **Photo Action UI logic** — hover icons, "..." action menu, lightbox component logic (`PhotoTile`, `PhotoActionMenu`, `PhotoLightbox`, `PhotographerGallery`, `useLikeToggle`/`useReplacePhoto` hooks) — built and further restyled since.
7. **Create album via Drive link** (`POST /api/albums` now accepts `{ name, clientName, driveLink }`) — parses the link, checks edit access, imports existing supported images (jpg/png/webp, skipping RAW/xmp/video), returns `{ imported, skipped }`, and auto-sets the first imported photo as the album's cover. `CreateAlbumForm`'s `googleDriveLink` field is now wired to send `driveLink` (D10, shipped).
8. **Album deletion** — `DELETE /api/albums/[albumId]` (photographer/admin only, web-only delete, never touches Drive, cascades to Photo/Like/Comment) plus an automatic check on the album detail page that removes an album from the app if its Drive folder is confirmed gone (trashed or a real 404 — never on a transient error). A live test (trash a real Drive folder, reload the album page) failed to trigger deletion once; `driveFolderIsGone()` in `src/lib/drive.ts` was subsequently hardened to also accept a string `'404'` code or a `404` response status (not just numeric `error.code`) as a confirmed-gone signal, plus debug logging in both it and `deleteAlbumIfDriveFolderGone()` (`src/lib/album-lifecycle.ts`). This is very likely the actual fix but **has not yet been re-confirmed with a fresh live test** — if you touch this path, watch the console logs on a real trashed-folder reload before assuming it's solid.
9. **Album editing** — `PATCH /api/albums/[albumId]` (same file as `DELETE`, both exports live in `src/app/api/albums/[albumId]/route.ts`) accepts `{ name?, clientName?, coverPhotoId? }`, all independently optional. `coverPhotoId` must reference a `Photo` that belongs to this same album (rejected with 400 otherwise); `coverPhotoId: null` explicitly clears it. **A simpler, incompatible draft `PATCH` (name/clientName only, no cover photo) was in progress in the UI effort's uncommitted work when this landed — it was superseded by this fuller version during the merge (the superseded draft is preserved in a `git stash` entry titled `antigravity-route-patch-conflict-20260709` if anyone ever needs to compare, but the merged version on `main` is authoritative going forward). If the existing "Edit album" button (already visible on the album-detail header banner, per recent UI work) was wired against the old draft's shape, double check it still works against this one — it should, since this version is a strict superset (same `name`/`clientName` behavior, plus optional `coverPhotoId`), but verify rather than assume.**

## What's specified but NOT yet implemented (all backend-complete, UI-only remaining)

- **`docs/superpowers/specs/2026-07-09-email-auth-design.md`** + **`docs/superpowers/plans/2026-07-09-email-auth.md`** — email/password login, registration, forgot/reset-password (via Resend), and a standalone Drive-connect flow. **Zero backend implementation yet** — `src/lib/auth.ts` is still Google-only. (Login/Register/Forgot/Reset UI pages already exist in the app per recent work — but they have no real backend to call yet. Building the backend plan is the prerequisite before those pages can actually work.)
- **`docs/superpowers/specs/2026-07-09-auth-ui-design.md`** — the UI spec those pages should already be following.

## UI work still needed (read the specs, they're binding, not suggestions)

- **D6/D8/D9/D10 in `docs/superpowers/specs/2026-07-09-ui-architecture-adr.md`** — all shipped on `main` as of this update (Client Access URL + Copy + QR code, Edit/Delete album menus on both the dashboard card and the detail header, the create-album Drive-link field). Spot-check against the ADR rather than assuming 100% fidelity — these landed via a large uncommitted-work merge, not a fresh implementation pass, so minor polish gaps are possible even though the build/tests are green.
  - D7: **appears mostly done** — the header banner now shows "by {photographerName}" and "Album: {name}" / "Client: {clientName}" as two lines, per recent screenshots. Double-check the location row is actually gone and photo count is icon+number only (`📂 5`, not `📂 5 items`/`5 original photos`) — not fully confirmed as of this writing.
  - The "album no longer available" fallback state still needs restyling (currently plain unstyled markup from the backend plan) — this part of D8 was not part of the recent merge.
- **`2026-07-09-photo-action-ui-design.md`'s "Visual & Interaction Correctness Requirements" and comment-panel sections** — the "..." menu and lightbox action bar had real overlap/legibility bugs in the first pass; this section spells out the exact fix (opaque anchored dropdown, no list bullets, flex+gap icon rows, icon-only quick actions with background chips). The comment panel needs rebuilding as one cohesive component (scrollable list on top, input+send anchored at bottom) — the first pass shipped it as a disconnected floating textarea.
- **Photo filenames must have their extension stripped** for display (`IMG_0001`, not `IMG_0001.jpg`) — also specified in the photo-action-ui spec.
- **D5 (theme consistency)**: no component's CSS Module may hardcode a color — everything must come from the shared CSS custom properties in `globals.css` (which already has both dark and light palettes via `@media (prefers-color-scheme: light)`). A recent bug (illegible near-invisible text in the create-album modal) traced back to a hardcoded color bypassing the token system — audit every component's `.module.css` for literal hex/rgb values as you touch it.

## Known issues already fixed (read this so you don't reintroduce them)

- `PhotoLightbox` not being a positioned overlay, the "..." menu rendering as a transparent bulleted list, `CreateAlbumForm` calling `PATCH` against a `POST`-only route, two pages reading a nonexistent `Album.location` field, photo tiles showing literal "thumb.jpg"/"LANDSCAPE" — all fixed. If you see any of these again, something regressed; check git history for the fix commit before re-solving from scratch.
- `globals.css` previously had zero light-mode support — a `prefers-color-scheme: light` block now exists. If dark/light still look inconsistent, the bug is almost certainly a hardcoded color somewhere (see D5 above), not a missing token.

## Conventions established — follow these

- **`resolveActor()`** (`src/lib/actor.ts`) is the single access-control gate distinguishing an authenticated PHOTOGRAPHER session from an anonymous CLIENT. Every route that needs to know "who is asking" goes through this — never reimplemented per-route.
- **Drive operations always use the album owner's stored credentials** (`getDriveClientForUser(album.owner)`), never the acting session's.
- **Deleting an album on the web never deletes anything on Google Drive** — same principle extended to the new album-deletion feature.
- **Error convention**: every user-triggered action shows `role="alert"` on failure, with `'Network error — please try again.'` for a thrown/rejected fetch and `data.error ?? 'Something went wrong'` for a non-ok response.
- **TDD throughout**: write-failing-test → verify RED → implement → verify GREEN → commit.
- **No caching layer for full-resolution originals**, **no background jobs of any kind** (both deliberate MVP simplifications) — don't "fix" either without discussing first.
- **Styling: CSS Modules only**, driven entirely by the CSS custom properties in `globals.css`. Not Tailwind.
- **Git hygiene**: never `git add -A`/`git add .` blindly — check `git status` and stage only what you intentionally changed. Small, focused commits. Run `npx vitest run` and `npx next build` before every commit.
- **Commit before switching tasks, especially for backend/route files.** A real merge collision already happened once: two agents (this project's Claude Code session and the UI effort) independently wrote different, uncommitted versions of the same `PATCH /api/albums/[albumId]` handler at the same time, which had to be manually reconciled. If you're mid-edit on a file and stepping away or switching focus, commit what you have (even as a checkpoint) rather than leaving it uncommitted indefinitely — uncommitted work is invisible to anyone else and collides silently.

## Project structure quick-reference

- `docs/superpowers/specs/` — design specs (the "what and why"). Read the newest-dated ones for the most current, binding requirements — several have been revised in place after real bugs were found.
- `docs/superpowers/plans/` — implementation plans (the "how," task-by-task with code).
- `docs/superpowers/design-references/` — external visual prototypes — reference material to adapt, not code to paste in; excluded from `tsconfig.json`'s compilation scope on purpose, don't remove that exclusion.
- `prisma/schema.prisma` — User, Album, Photo, Like, Comment. `Photo`/`Like`/`Comment` cascade-delete when their parent is removed.
- `src/lib/` — shared server logic.
- `src/app/` — Next.js App Router pages and API routes.
- `src/components/` — React components, each with a matching `.module.css`.
- `tests/` — mirrors `src/`'s structure 1:1.
