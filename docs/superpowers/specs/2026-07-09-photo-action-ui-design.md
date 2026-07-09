# Photo Action UI Redesign — Design Spec

## Overview

Plans 1-5 shipped every per-photo interaction (select/suggest like, comment, download, replace/version-bump) as raw, always-visible buttons and text links stacked underneath each thumbnail. This spec redesigns how those same interactions are *presented*, on both the client-facing gallery (`/a/[shareToken]`) and the photographer's album detail page (`/albums/[albumId]`), to match the Google Photos / Google Drive interaction model: quick-access icons that appear on hover, plus a "..." menu that lists every available action for that photo.

**This is a frontend-only redesign.** No new Prisma models, no new API routes, no changes to access control (`resolveActor`, `canManageAlbum`, `Album.downloadEnabled`) — every action already has a working, tested backend endpoint from Plans 1-5. The only thing changing is which React components render those actions and how they're triggered.

## Goals

- Replace always-visible action buttons/links with a Google Photos-style interaction model: hover reveals quick icons on grid thumbnails, a "..." menu lists every action.
- Add a lightbox (full-photo view) to the photographer's album page — it currently has none; only the client-facing gallery has one (from Plan 3/4).
- Keep status indicators (version badge, "selected by" client names) always visible — these are state, not actions, and hiding them behind hover/menu would make them easy to miss.
- Reuse every existing API route and fetch/error-handling pattern (`role="alert"` on failure) — no behavior changes, only presentation changes.

## User-Facing Behavior

### Grid thumbnails (both pages)

Each thumbnail shows, always visible (no hover needed): the version badge (`v2`, `v3`, ...) if the photo has been replaced, and — on the photographer's page only — the list of client names who selected that photo.

On hover (or always, on touch devices — see Touch Devices below), a semi-transparent overlay reveals exactly two icons:
- **❤️ / ⭐** (top-left) — the select/suggest toggle. One click toggles it immediately, no menu needed. Heart for a CLIENT actor ("select this photo"), star for a PHOTOGRAPHER actor ("suggest to client").
- **••• (top-right)** — opens the action menu (see below).

Clicking anywhere else on the tile opens the lightbox for that photo.

### Lightbox (both pages — new on the photographer's page)

Full-size photo view with prev/next/close navigation (existing behavior from `ClientGallery`, extended to the photographer's page). Adds a row of three quick-access icons over the image:
- **❤️ / ⭐** — same toggle as the grid tile.
- **⬇️ Download** — triggers the original-file download immediately. On the client page, only rendered when `canDownload` is true (unchanged existing logic). On the photographer's page, always rendered (photographer always allowed to download their own content, per Plan 5).
- **💬 Comment** — toggles a comment panel that slides in beside the photo (not over it). The panel hosts the existing comment list + input form.
- **•••** — opens the same action menu as the grid tile.

### Action menu ("...")

A dropdown list anchored to the "..." button (click to open, click outside or Escape to close) — same interaction model as Google Drive's "More actions" menu. Lists **every** action for that photo, not just the ones without a dedicated quick icon:

| Actor | Menu items |
|---|---|
| CLIENT | Select / Unselect this photo · Download (only if `canDownload`) · View comments |
| PHOTOGRAPHER | Suggest / Unsuggest to client · Download · View comments · Replace / update version |

"Replace / update version" opens the same file picker as today's `ReplacePhotoButton`, uploads via the existing replace API, and bumps the version badge on success — no change to that flow, only to how it's triggered.

### Touch devices

Devices with no hover capability (`@media (hover: none)`) show the grid tile's two icons and the lightbox's icon row permanently rather than gating them behind a hover event, since there is no hover event to gate on.

## Component Architecture

New components:
- **`PhotoTile`** — one grid thumbnail: image, always-visible status badges, hover overlay with the heart/star icon and the "..." trigger.
- **`PhotoActionMenu`** — the dropdown's contents. Takes the actor role and the photo's current state as props and renders the role-appropriate item list from the table above; each item invokes the same toggle/download/comment-open/replace trigger used by the quick icons, so there is exactly one code path per action regardless of whether it was triggered from a quick icon or from the menu.
- **`PhotoLightbox`** — full-photo view + navigation + the three quick icons + the slide-in comment panel + the "..." trigger. Replaces the dialog currently built inline inside `ClientGallery`.
- **`PhotographerGallery`** — orchestrates a grid of `PhotoTile` + `PhotoLightbox` for the photographer's album page, mirroring what `ClientGallery` already does for the client page.

Changed components:
- **`ClientGallery`** — slims down to orchestrating `PhotoTile` (grid) + `PhotoLightbox`, instead of building its own inline thumbnail grid and dialog. The album-level "Download all" link/button is untouched — it's not a per-photo action, so it stays outside this menu system.
- **`src/app/albums/[albumId]/page.tsx`** — the current inline `<ul>` of photos (each row manually wiring `ReplacePhotoButton` + `LikeButton` + `CommentThread` + a plain-text client-likers list) is replaced by a single `PhotographerGallery` render, fed the same data the page already queries.
- **`LikeButton`, `CommentThread`, `ReplacePhotoButton`** — their fetch/error-handling logic is preserved and reused (not reimplemented), extracted into shared logic that both quick icons and menu items call into, so there's no duplicated fetch/toggle/error code between the two trigger points.

## Data Flow

No new data is fetched. `PhotoTile`/`PhotoLightbox`/`PhotoActionMenu` receive the same per-photo fields already computed server-side today: `id`, `thumbnailUrl`, `previewUrl`, `version`, `likedByMe`/`suggestedByMe`, `suggestedByPhotographer`/`clientLikers`, `comments`, plus the page-level `canDownload`/`albumId` (client page) or an implicit always-true download permission (photographer page).

## Error Handling

Unchanged from the existing convention: each action (toggle, replace, comment submit) shows a `role="alert"` error message on failure, scoped to where the action was triggered (inside the open menu or lightbox), never a full-page error. No new error states are introduced by this redesign.

## Testing

Component tests via Testing Library, following the existing project conventions:
- `PhotoTile`: badges render regardless of hover state; hover (or `hover: none` media) reveals exactly the heart/star + "..." icons; clicking the tile body opens the lightbox; clicking an icon does not also open the lightbox.
- `PhotoActionMenu`: renders the correct item list per actor role; each item invokes the correct existing endpoint with the correct method/body; the Download item is absent for a CLIENT actor when `canDownload` is false; "Replace / update version" is absent for a CLIENT actor entirely.
- `PhotoLightbox`: the three quick icons render with correct hrefs/handlers; the comment panel toggles open/closed without navigating away from the photo; prev/next/close behavior is preserved from the current `ClientGallery` dialog tests.
- `ClientGallery` / `PhotographerGallery`: integration-level tests confirming the grid + lightbox wire together correctly, mirroring the existing `ClientGallery.test.tsx` structure.

## Visual & Interaction Correctness Requirements (added after the first implementation shipped broken)

The first build of this spec (by an external UI tool) shipped with real, user-visible bugs: the "..." menu rendered as a bare, transparent, bulleted list stacked directly on top of the photo (default `<ul>`/`<li>` markers visible, no card background, text unreadable against the image), and the lightbox's bottom action-bar icons overlapped each other illegibly ("Download" and "Comments (0)" rendering at the same position). The original spec left visual treatment entirely to the implementer — that was the mistake. The rules below are now binding, not optional, for whoever rebuilds this UI next.

**The "..." action menu:**
- Renders as an opaque, self-contained card — a solid background color (not transparent, not the photo showing through), `border-radius`, and a drop shadow, so it reads as a distinct floating panel regardless of what's behind it (dark photo, light photo, either theme).
- Is anchored to the "..." trigger button as a proper dropdown — appears directly below/beside the button, never as a vertical stack of items overlaid down the middle of the photo.
- The item list has **zero default list-marker bullets** (`list-style: none` on any `<ul>`) — every menu item is a full-width row with its own padding (12-16px vertical, 16px horizontal) and a hover/focus background state, exactly like Google Drive's or Google Photos' "More actions" menu.
- Each item may pair a small icon with its text label (optional), but the text itself must always be legible — never rely on the photo behind the menu for contrast, since the card background already guarantees this if the above rules are followed.

**The lightbox's action bar (like/download/comments/menu row) and grid-tile quick icons:**
- Laid out with `display: flex` and an explicit `gap` (8-12px) between every icon — two icons must never be able to render at the same coordinates. If icons visually overlap at any viewport width, that's a bug, not a tradeoff.
- Every icon is its own fixed-size circular button (minimum 36x36px tap target) with a semi-opaque background chip of its own (e.g. `rgba(0,0,0,0.6)` in a dark theme) — icons must never sit directly on bare photo pixels with no background, since photo content varies from all-white to all-black and unbacked icons become invisible against matching backgrounds.
- Quick-action icons show an icon glyph, not a full text label, as the visible content (the text becomes the `aria-label`/tooltip, not rendered inline) — this is what actually makes them "quick icons" rather than the text-pill buttons ("Suggest to client", "Download") seen in the first broken build, which is closer to the "..." menu's presentation than to a Google Photos quick-action icon.

**Lightbox chrome (Close / Previous / Next):**
- Each renders as its own circular icon button with a semi-opaque background chip (same treatment as the action-bar icons above) — never as bare unstyled text floating directly on the image, which is illegible against light photo content and has no discoverable tap target boundary.
- Close sits top-right, Previous/Next sit vertically centered at the left/right edges — standard Google Photos placement.

**Stacking:** every menu, action bar, and chrome button must render above the photo in stacking order with an explicit `z-index` — never interleaved with image content such that a later-painted image element could cover an earlier control.

**The comment panel:** the first build shipped this as a bare, floating textarea + a disconnected "Post comment" button, positioned arbitrarily, with no visible list of existing comments and no panel background — effectively unusable. Model it explicitly on Google Photos' own comment panel:
- The panel is a proper side panel with its own solid background (`var(--bg-surface)`, per D5 in the ADR — never transparent, never see-through to the photo behind it), full-height alongside the image (already specified as "beside the image, not over it" earlier in this doc — that part of the spec was correctly followed; the panel's *internal* layout was not).
- **Existing comments render as a scrollable list at the top of the panel**, each comment showing its author label and text (the data this needs — `authorLabel`, `text` — already exists on every comment object; nothing new to fetch). Newest-at-bottom or oldest-at-bottom is fine either way, but pick one and be consistent — don't leave the list unstyled/unlisted the way the first build did.
- **The input control is anchored at the bottom of the panel**, not floating disconnected at the top — a single-line (auto-growing) text input plus a compact send affordance directly beside it (an icon button is sufficient — a full separate "Post comment" button rendered far from the input, as in the first build, is the bug being fixed here). Submitting clears the input and the new comment appears in the list above.
- The panel's own padding, comment-row spacing, and input styling should read as one cohesive component — not, as shipped, two unrelated floating elements that happen to be near each other.

## Out of Scope

- Any change to access control, API routes, or the data model — this is purely a presentation change.
- The album-level "Download all" button/link and the album-level `DownloadToggle` control — neither is a per-photo action, both stay as visible controls outside this menu system.
- Bulk/multi-select across multiple photos at once — not part of this request.
- Any change to the password-gate, name-gate, or share-link flows.
