# Photo Delivery Platform — Design Spec

Date: 2026-07-07
Status: Approved for planning

## 1. Purpose

Internal tool for a photography studio/team to deliver photo albums to clients — similar to ShotPik — with Google Photos-like interaction (like/comment), version tracking backed by Google Drive, and per-album control over whether clients can download originals. Storage lives entirely in each photographer's own Google Drive; the app stores only metadata (Postgres) plus small cached previews.

Single-tenant: this is built for one studio/team only. No multi-tenant/billing concerns.

## 2. Roles & Access

- **Admin**: manages the whole studio; sees and manages every photographer's albums.
- **Photographer**: signs in with Google OAuth. Signing in with Google *is* the Drive connection — no separate "connect Drive" step. Only sees/manages albums they created.
- **Client**: no account. Accesses an album via a unique share link (`/a/<share_token>`), with an optional password set by the photographer. On first visit, the client enters a display name (no email required); this name is persisted in a cookie for that browser and attached to all their likes/comments on subsequent visits.

## 3. Data Model

- **User** (admin/photographer): id, email, role, encrypted Google OAuth refresh token, Drive root folder id.
- **Album**: id, name, owner_user_id, client_name, drive_folder_id, share_token, password_hash (nullable), download_enabled (bool), created_at.
- **Photo**: id, album_id, drive_file_id, version (int, starts at 1, incremented on replace), display_order, thumbnail_url (cached), preview_url (cached), created_at, updated_at.
- **Like**: id, photo_id, actor_type (`client` | `photographer`), actor_name (client) or user_id (photographer), created_at. Unique on (photo_id, actor_type, actor_name/user_id) — toggling re-clicks unlikes.
- **Comment**: id, photo_id, actor_type, actor_name or user_id, text, created_at. Single shared thread per photo for both client and photographer.

No separate version-history table: Google Drive's native file revisions are the source of truth for old bytes, but the app does not expose browsing/reverting old versions — it only shows a "vN / updated" badge on the photo (see §5).

## 4. Google Drive Integration

- OAuth scope: `drive.file` (app can only touch files/folders it creates — not full Drive access).
- Creating an album creates a folder in the photographer's Drive.
- Uploading a photo calls `files.create` into that folder; `drive_file_id` is stored.
- Replacing a photo (e.g. after a client comment asking for an edit) calls `files.update` on the *same* `drive_file_id`. This lets Drive's own revision history capture the old bytes automatically (unused by the app, but preserved for free). The app increments `Photo.version` and bumps `updated_at`, and busts the cached thumbnail/preview.
- No revision-history UI, no revert. A "vN"/"updated" badge is shown on the photo when `version > 1`.

## 5. Image Serving Strategy

Clients have no Google account, so the app backend must mediate all image access. Chosen approach — hybrid caching:

- **Thumbnails and web-preview images** are generated and cached (Vercel Blob/Supabase Storage) at upload time and whenever a photo's version changes. Used for the gallery grid and default lightbox view. No watermark.
- **Full-resolution / original bytes** are proxied live from Drive on demand (`files.get?alt=media`), fronted by CDN edge caching keyed on `drive_file_id` + `version` (immutable cache — a new version naturally busts the cache key).
- This keeps gallery browsing fast and cheap while avoiding duplicate full-size storage, and ties cache invalidation directly to the version-increment mechanism in §4.

## 6. Likes, Comments, Download Permission

- **Client like** ("selected"): heart/checkbox per photo. Marks the photo as chosen by the client (e.g. for prints/final delivery). Filed under `actor_type=client`. Photographers get a filtered view of "client-selected photos."
- **Photographer like** ("suggested"): a visually distinct marker (e.g. star), settable only by the owning photographer, shown to the client as "recommended by photographer." Filed under `actor_type=photographer`.
- **Comments**: one shared thread per photo; both client and photographer post into the same `Comment` table, rendered chronologically with the author's name/role label.
- **Download permission** (`Album.download_enabled`, toggled by photographer/admin, takes effect immediately):
  - On: client sees a per-photo "Download" button and an album-level "Download all" (zip); backend streams the original from Drive.
  - Off: no download affordance anywhere; client only ever sees the cached web-resolution preview. No watermarking.

## 7. "Selected" Drive Folder (client picks)

- Each album folder gets a `Selected` subfolder in the photographer's Drive.
- When a client likes a photo, the app creates a **Drive shortcut** (`application/vnd.google-apps.shortcut`) pointing at the original file, placed inside `Selected`. The original file is never moved or duplicated — it stays in the main album folder so the app's gallery keeps working normally.
- When a client unlikes a photo, the app deletes the corresponding shortcut from `Selected`.
- Net effect: opening the photographer's Drive always shows a folder that mirrors exactly which photos the client currently has selected.

## 8. Upload Flow

- Photographer creates an Album in the web app → app creates the Drive folder (+ `Selected` subfolder).
- Photographer drags/drops photos into the web app → app uploads each to Drive via `files.create`, records `Photo` rows, generates cached thumbnail/preview.
- Replacing an existing photo re-uses the flow in §4 (`files.update`, version bump, cache bust).

## 9. Tech Stack

- Next.js (App Router) + TypeScript, deployed on Vercel.
- NextAuth.js with Google OAuth provider (scope `drive.file`) for both login and Drive access — one login step serves both purposes.
- Postgres via Supabase (or Neon) for all metadata (User, Album, Photo, Like, Comment).
- Vercel Blob (or Supabase Storage) for cached thumbnails/previews only — never original bytes.
- `googleapis` Node SDK for all Drive operations (folder create, upload/update, shortcuts).
- Client-facing routes are public (keyed by `share_token`, optional password), no NextAuth session — client identity is a name stored in a cookie.
- Like/comment updates use simple polling (refetch on an interval) for MVP; no WebSocket/real-time infrastructure yet.

## 10. MVP Scope

**In scope:**
- Admin/Photographer Google OAuth login (`drive.file` scope)
- Album creation, web-based photo upload → Drive folder per album
- Version badge on replace (no history/revert UI)
- Shareable album link with optional password; client name capture
- Client "selected" like, photographer "suggested" like, shared comments
- Per-album download-permission toggle (no watermarking)
- `Selected` Drive-shortcut folder synced to client likes

**Out of scope (future):**
- Multi-tenant/multi-studio support
- Version history browsing / revert to old revision
- Watermarking
- Real-time (WebSocket/Pusher) updates — polling only for now
- Email notifications
- Separate "Editor" internal role
- Payments/billing
