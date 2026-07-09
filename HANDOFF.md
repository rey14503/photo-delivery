# Handoff Notes

This project was built with Claude Code, then handed off for continued UI work (Antigravity, Google AI Studio). This file is the entry point — read it first. Updated after a full logic audit and several spec revisions; if you're picking this up fresh, everything below reflects the actual current state of `main`, not just the original plan.

## Running locally

```bash
npm install
npx prisma generate   # regenerate the Prisma Client — do this after every fresh install
npm run dev
```

`.env` and `.env.local` already exist in this checkout with working real credentials (local Postgres, a real Google OAuth client with `drive.file` scope, a real Vercel Blob token). They are gitignored, so they exist only on this machine. A `RESEND_API_KEY` is **not yet present** and is required before the (not-yet-built) forgot-password flow can be exercised for real — see below.

Run the test suite with `npx vitest run` (201 tests, all passing as of this update) and verify the production build with `npx next build`.

## What's shipped and working (on `main`)

All backend logic — audited fresh, end to end, and confirmed intact:

1. **Foundation** — Google OAuth w/ `drive.file` scope, Album model, per-photographer Drive folder creation.
2. **Upload & Versioning** — photo upload/replace, thumbnail/preview generation, Vercel Blob caching.
3. **Client Album View** — password-gated share links, client-name capture, public gallery.
4. **Social Interactions** — client "select" vs. photographer "suggest" likes, comments, Drive-shortcut sync to a "Selected" folder.
5. **Download Permission** — per-album download toggle, single-photo/ZIP download routes.
6. **Photo Action UI** (`2026-07-09-photo-action-ui.md`) — hover icons, "..." action menu, lightbox — implemented (this plan was executed; components exist: `PhotoTile`, `PhotoActionMenu`, `PhotoLightbox`, `PhotographerGallery`, `useLikeToggle`/`useReplacePhoto` hooks).
7. A substantial dashboard restyle (TopNav, DashboardToolbar, AlbumCard, CreateAlbumModal, dark-mode design tokens) — built independently, CSS/JSX only, no logic changes; verified not to have touched any access-control or Drive-credential logic.

**UI is now styled** (dark theme by default, light theme added — see Known Issues Just Fixed below), not the bare unstyled HTML from the original 5 plans.

## What's specified but NOT yet implemented

- **`docs/superpowers/specs/2026-07-09-drive-link-album-creation-design.md`** + **`docs/superpowers/plans/2026-07-09-drive-link-album-creation.md`** — backend for creating an album from an existing Drive folder link instead of an empty one. **Zero implementation** — `POST /api/albums` still only accepts `{ name, clientName }`. The dashboard's `CreateAlbumForm.tsx` already has a `googleDriveLink` input field, but it's captured in local state and never sent to the API — wiring that up is part of this plan.
- **`docs/superpowers/specs/2026-07-09-email-auth-design.md`** + **`docs/superpowers/plans/2026-07-09-email-auth.md`** — email/password login, registration, forgot/reset-password (via Resend), and a standalone Drive-connect flow for accounts with no Google-bundled Drive grant. **Zero implementation** — `src/lib/auth.ts` is still Google-only.
- **`docs/superpowers/specs/2026-07-09-auth-ui-design.md`** — the UI for the above (login/register/forgot-password/reset-password screens + logout + a Drive-connect banner), modeled on the ShotPik reference screenshot. Depends on the email-auth backend plan; also requires one small addition to that plan's Task 3 (`pages: { signIn: '/login' }` in `authOptions`) — noted in the spec itself.
- **`docs/superpowers/specs/2026-07-09-ui-architecture-adr.md`** — mostly superseded by the dashboard restyle that already happened, but still useful for the open questions it logged (styling approach — now answered: CSS Modules — branding/product name — still unanswered).

## Known issues just fixed (read this so you don't reintroduce them)

The first UI pass had several real bugs, found via screenshots and a full logic audit. All fixed on `main` already:
- `PhotoLightbox` wasn't a positioned overlay — it rendered inline in the page flow. Fixed with `PhotoLightbox.module.css`.
- The "..." action menu rendered as a transparent, default-bulleted list overlapping the photo instead of an opaque anchored dropdown card; the lightbox's action-bar icons overlapped each other illegibly. **Not yet re-fixed in code** — instead, `2026-07-09-photo-action-ui-design.md` got a new binding "Visual & Interaction Correctness Requirements" section spelling out exactly what's required (opaque card, no list bullets, `flex`+`gap` icon rows, icon-only quick actions with background chips, proper chrome buttons). **Whoever rebuilds this UI must follow that section — it's not optional.**
- `CreateAlbumForm.tsx` called `PATCH` against a `download-toggle` route that only accepts `POST` — silently did nothing. Fixed (now `POST`).
- Two pages read `(album as any).location`, a field that doesn't exist in the schema — always `undefined`, silently falling back to a hardcoded string. Removed the dead read.
- Photo tiles displayed the literal string "thumb.jpg" (parsed from the cached Blob URL) and a hardcoded "LANDSCAPE" tag for every photo. Added `Photo.originalName` (populated at upload time) and photographer-name attribution; both now flow through to `PhotoTile`.
- `globals.css` only ever defined dark-mode variables with no light variant and no `prefers-color-scheme` query — the app was always dark regardless of the OS setting. Added a `@media (prefers-color-scheme: light)` override block; dark remains the default.

## Conventions established — follow these

- **`resolveActor()`** (`src/lib/actor.ts`) is the single access-control gate distinguishing an authenticated PHOTOGRAPHER session from an anonymous CLIENT (unlock-cookie + name-cookie). Every route that needs to know "who is asking" goes through this — never reimplemented per-route. Confirmed still true everywhere as of the last audit.
- **Drive operations always use the album owner's stored credentials** (`getDriveClientForUser(album.owner)`), never the acting session's. Confirmed still true everywhere.
- **Error convention**: every user-triggered action shows `role="alert"` on failure, with `'Network error — please try again.'` for a thrown/rejected fetch and `data.error ?? 'Something went wrong'` for a non-ok response. Match this exactly in new code — including new UI screens (see the auth-ui spec's Shared Visual & Interaction Rules section).
- **TDD throughout**: write-failing-test → verify RED → implement → verify GREEN → commit. Test files mirror `src/`'s structure under `tests/`.
- **No caching layer for full-resolution originals** — deliberate MVP simplification (Plan 5's Global Constraints); don't "fix" this without discussing it first.
- **Styling approach is now decided**: CSS Modules (one `.module.css` per component), CSS custom properties in `globals.css` for the design-token palette (`--bg-base`, `--accent`, etc., with a light-mode override block). Not Tailwind.

## Project structure quick-reference

- `docs/superpowers/specs/` — design specs (the "what and why").
- `docs/superpowers/plans/` — implementation plans (the "how," task-by-task with code).
- `docs/superpowers/design-references/` — external visual prototypes (AI Studio mockups etc.) — reference material to adapt, not code to paste in directly; excluded from `tsconfig.json`'s compilation scope on purpose (it has its own, unrelated dependencies) — don't remove that exclusion.
- `prisma/schema.prisma` — the data model (User, Album, Photo, Like, Comment). No `Album.location` field exists — don't reintroduce reads of it without adding it properly first.
- `src/lib/` — shared server logic (Drive client, actor resolution, crypto, image processing).
- `src/app/` — Next.js App Router pages and API routes.
- `src/components/` — React components, mostly client components with co-located fetch logic, each with a matching `.module.css`.
- `tests/` — mirrors `src/`'s structure 1:1.
