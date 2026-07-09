# ADR: UI/UX Architecture Direction — ShotPik & Google Photos Reference

**Status:** Accepted as the reference baseline for continued UI work. Not an implementation plan — the dashboard redesign described here has no task breakdown yet and must go through brainstorming → plan before anyone builds it.

## Context

Plans 1-5 shipped a fully working product (Google Drive-backed albums, upload/versioning, password-gated share links, likes/comments, download permission) with functionally correct but visually bare UI — plain HTML elements, no design system, no styling beyond one CSS Module (planned, not yet built) for the per-photo hover-icon redesign. The project is being handed off to Antigravity for continued work. This ADR records the intended visual/interaction direction so that hand-off doesn't lose the reasoning behind decisions already made, and so the next phase of work (dashboard styling, broader design system) starts from an explicit reference rather than a blank slate.

Two products were used as reference points, per the user's direction:
- **ShotPik** — a direct competitor in the same product category (photographer-to-client delivery), screenshotted from its own dashboard (see Reference Screenshots below).
- **Google Photos** — the interaction model for per-photo actions (like/select, comment, hover icons, "..." menu), already fully specified in `docs/superpowers/specs/2026-07-09-photo-action-ui-design.md` and planned in `docs/superpowers/plans/2026-07-09-photo-action-ui.md`.

This ADR does not replace or duplicate those two documents — it sits one level above them, covering the parts of the UI they don't: the dashboard/album-list shell, top navigation, and overall information architecture.

## Reference Screenshot: ShotPik Dashboard

Captured from ShotPik's own "Bảng điều khiển" (Dashboard) view. Structure, top to bottom:

1. **Top nav bar**: product logo (left) · a primary CTA button ("+ Tạo album", filled/accent color) · a secondary CTA button ("Thiết lập website", outline style) · right-aligned utility icons (help, notifications, language switcher, dark-mode toggle, signed-in user name).
2. **Toolbar row**: view controls ("Sắp xếp" / sort, "Cách hiển thị" / display mode) on the left · a row of at-a-glance usage counters ("Tổng số album đã tạo: 0", "Số album tạo mới trong tháng này: 0/5", "Số website album tạo mới trong tháng này: 0/1") · a highlighted rewards/upsell badge ("🎁 Nhận thưởng") · a search box, right-aligned.
3. **Content grid**: a card grid of albums where the **first card is itself the "create" affordance** — a dashed-border tile with a "+" icon and "Tạo album" label, inline with the album cards rather than only in the top-bar button. Empty state shown is just this one tile (no albums yet).

## Decisions

### D1 — Dashboard / album-list page adopts ShotPik's shell pattern

`src/app/albums/page.tsx` (currently a bare `<ul>` of text links, see Current State below) should be restructured to match the ShotPik reference:
- Top nav: product name/logo, a primary "Create album" action, and (once/if a public "album website" concept exists — it doesn't yet in this codebase) a secondary action slot.
- A toolbar row surfacing at-a-glance counts already available from existing queries (total albums, e.g.) — no new backend needed for a basic version; usage-limit-style counters ("X/5 this month") are **not** in scope since this app has no plan/quota concept anywhere in Plans 1-5.
- A card grid where the first tile is the "create album" affordance itself (dashed border + "+"), not a separate button floating elsewhere — this directly replaces the current plain `<Link href="/albums/new">Create album</Link>` text link.

**This has no implementation plan yet.** It should go through the same brainstorming → design spec → implementation plan cycle used for every other piece of this project before anyone builds it — this ADR is scope framing, not a task list.

### D2 — Per-photo interaction model follows Google Photos

Already fully decided and documented — see `docs/superpowers/specs/2026-07-09-photo-action-ui-design.md` (design) and `docs/superpowers/plans/2026-07-09-photo-action-ui.md` (9-task implementation plan, written, not yet executed). Do not re-derive this decision; execute that plan when picking this up.

### D3 — No design system exists yet

There is currently zero shared visual language: no color tokens, spacing scale, typography scale, or component library — every screen across Plans 1-5 is unstyled semantic HTML. Before or alongside building D1, whoever continues this project should make an explicit decision (not yet made) on:
- A styling approach (CSS Modules — already the precedent set by `PhotoTile.module.css` in the pending plan — vs. Tailwind vs. a component library).
- A minimal token set (accent color, neutral palette, spacing scale) — ShotPik's screenshot suggests a warm red/coral accent for primary actions and a blue accent for secondary actions, but this is not a binding decision, just what the reference happens to use.
- Dark mode — ShotPik's dashboard has a dark-mode toggle; this codebase has no dark-mode support at all today. Explicitly undecided whether to add it.

### D4 — Album detail (photographer) and share page (client) follow the Google Photos grid + lightbox pattern

Already covered by D2's referenced spec/plan — both pages get the same `PhotoTile` grid + `PhotoLightbox` treatment, differing only in which actions are available (see that spec's role-based action table).

## Current State (as of this ADR)

- `src/app/albums/page.tsx` — plain `<ul>` of `<Link>`s, no styling, no card grid, no toolbar, no counters. This is the gap D1 addresses.
- `src/app/albums/new/page.tsx`, `src/app/albums/[albumId]/page.tsx` — functionally complete, unstyled.
- `src/app/a/[shareToken]/page.tsx` — functionally complete; will pick up D2/D4's visual treatment once `docs/superpowers/plans/2026-07-09-photo-action-ui.md` is executed.
- No CSS framework, no design tokens, no dark mode anywhere in the codebase.

## Non-Goals

- **Not a pixel-accurate clone of ShotPik or Google Photos.** Both are reference points for information architecture and interaction patterns (where does the "create" action live, how does hover-to-reveal work), not assets or exact visual styling to copy wholesale.
- **Not a quota/usage-limit system.** ShotPik's "0/5 albums this month" counters imply a plan/billing model this project has no equivalent of, and none is being added by this ADR.
- **Not a rebrand.** This project has no chosen product name/logo yet; that's out of scope here.

## Open Questions for Whoever Continues

1. ~~Styling approach~~ — **resolved**: CSS Modules, one per component, backed by CSS custom properties in `globals.css`. See D5 below for the binding consistency rule this alone doesn't guarantee.
2. ~~Dark mode~~ — **resolved, in scope**. See D5.
3. Product name/branding — still not decided.
4. Does D1 (dashboard redesign) get its own brainstorm/spec/plan cycle before or after `docs/superpowers/plans/2026-07-09-photo-action-ui.md` is executed? No dependency between them, so either order works — moot now, both have been built.

## D5 — Theme consistency (added after the first build shipped inconsistent theming)

The first dashboard/album-detail build shipped with light-themed and dark-themed screens mixed inconsistently within the same app — e.g. the album-detail header card rendering as a hardcoded white card sitting on a dark page background, while the dashboard list page rendered fully light regardless of the OS/stored theme preference. `globals.css` does define a full token set (`--bg-base`, `--bg-surface`, `--text-main`, etc., light and dark variants via `@media (prefers-color-scheme: light)`) — the bug is that not every component actually *consumes* those tokens; some hardcode literal colors (e.g. `background-color: #ffffff` / `#000000`) instead of `var(--bg-surface)` / `var(--text-main)`.

**Binding rule, going forward:** no component's CSS Module may hardcode a background, text, or border color as a literal hex/rgb value. Every color must come from the shared custom properties in `globals.css`. This is what actually makes "dark mode" and "light mode" work as a single coherent theme rather than a per-page coin-flip — the token system already exists, it just needs to be the *only* source of color for every component, with no exceptions. When auditing or reviewing any new component, check its `.module.css` for literal color values as a first pass; any hit is a bug.

## D6 — Client Access / share-link presentation

The album-detail page currently shows the client share link as a bare relative path (`/a/<32-char-hex-token>`), not a full clickable URL, with no copy affordance on that page (the dashboard's own album-card list does have a "Copy link" button, but the album detail page's own header banner doesn't) and no way for a photographer to hand a client a scannable link.

**Decision:** improve the *presentation* only — the underlying `shareToken` (32 hex characters, from `randomBytes(16)`) must not be shortened. For an album with no password, that token is the sole access control; shortening it would measurably weaken it. Instead:
- Always render the share link as a full, absolute URL (`${origin}/a/${shareToken}`, not the bare path) so it's meaningfully copy-pasteable outside the app.
- Add a one-click "Copy link" control on the album-detail header banner itself (not just the dashboard card list), with a brief visual confirmation on click (e.g. a checkmark or "Copied" label for ~2 seconds) — this app already has this exact pattern's underlying convention (`role="alert"`/inline feedback) to draw from.
- Add a QR code rendering of that same full URL next to it, so a client can scan-and-open on their phone instead of typing or receiving a pasted link. Generate the QR code entirely client-side (a small, well-known library such as `qrcode.react` is a reasonable choice) — do not call any third-party QR-generation API with the link, since that would leak an unguessable, unauthenticated album-access token to an external service.
- The *visible* text of the link may be visually truncated/ellipsized for readability (e.g. `.../a/257afd…f17cb`) as long as the actual `href`/copy action always uses the full, untruncated token — never let the display truncation leak into the real value.

## D7 — Album-detail header banner content (rewrite)

The current header banner (screenshotted during review) has three problems, each with a specific fix:

1. **"ID: cmrbj8px100018ltoanzqoqyz" next to the "PHOTOGRAPHER MODE" badge is a raw database id, meaningless to the photographer viewing it.** Replace it with the owning photographer's name: `by {photographerName}` (the same `photographerName` data already threaded through to `PhotoTile` for photo attribution — reuse it here, don't refetch).
2. **The album name and client name are currently concatenated on one line** (`{name} — {clientName}`, rendering as e.g. "test — none" when a client name is a placeholder). Split into two separate, clearly labeled lines:
   ```
   Album: {album's name}
   Client: {client's name}
   ```
3. **The meta row (`📍 location  📅 date  📂 N original photos`) has a location field that doesn't exist in the data model** (see D5's note — `(album as any).location` was already found and removed as dead code) and an overly verbose photo-count label. Fix:
   - Remove the location item entirely — no pin icon, no fallback text, nothing in its place.
   - Keep the date item as-is (📅 + the album's creation date).
   - Simplify the photo-count item to just an icon plus the number — `📂 5`, not `📂 5 original photos`.

## D8 — Album deletion control

`docs/superpowers/plans/2026-07-09-album-deletion.md` adds `DELETE /api/albums/[albumId]` (photographer/admin only, deletes the album from the app without touching anything on Drive) and an automatic removal when the linked Drive folder is confirmed gone. The UI needs:
- A "Delete album" action on the album-detail page (e.g. near the existing management controls — password/download-toggle/upload section) that calls this route. Since deletion is irreversible from the web app's side, require an explicit confirmation step (a native `confirm()` is acceptable for MVP, or a small confirmation dialog matching this app's existing modal patterns — either is fine, just don't delete on a single unconfirmed click).
- A rendered state for "this album is no longer available" (the plan's page-level auto-delete check returns this when it fires) — simple centered message + a link back to the dashboard, no special styling requirements beyond matching the app's existing typography/spacing.
