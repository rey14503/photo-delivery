# Handoff Notes

This project was built with Claude Code through 5 sequential implementation plans, and is being handed off to Antigravity for continued work. This file is the entry point — read it first.

## Running locally

```bash
npm install
npx prisma generate   # regenerate the Prisma Client — do this after every fresh install
npm run dev
```

`.env` and `.env.local` already exist in this checkout with working real credentials (local Postgres, a real Google OAuth client with `drive.file` scope, a real Vercel Blob token). They are gitignored, so they exist only on this machine — if you clone this repo elsewhere, you'll need to recreate them (see `docs/superpowers/specs/2026-07-07-photo-delivery-design.md` for what each variable is for).

Run the test suite with `npx vitest run` (147 tests, all passing as of this handoff) and verify the production build with `npx next build`.

## What's shipped (on `main`, tested, merged)

Five plans, each with its own design spec + implementation plan under `docs/superpowers/`:

1. **Foundation** (`2026-07-07-foundation.md`) — Next.js/Prisma/NextAuth scaffold, Google OAuth with `drive.file` scope, per-photographer Drive folder creation, Album model.
2. **Upload & Versioning** (`2026-07-08-upload-and-versioning.md`) — photo upload to Drive, sharp-based thumbnail/preview generation, Vercel Blob caching, replace-photo version bumping.
3. **Client Album View** (`2026-07-08-client-album-view.md`) — password-gated public share links, client name capture, the client-facing gallery.
4. **Social Interactions** (`2026-07-08-social-interactions.md`) — client "select" likes vs. photographer "suggest" likes, shared comments, Drive-shortcut sync into a "Selected" folder.
5. **Download Permission** (`2026-07-08-download-permission.md`) — per-album download toggle, single-photo and album-ZIP download routes, gated by actor type.

All five are functionally complete and merged. **The UI for all of this is currently unstyled semantic HTML** — every button, list, and form works but has no visual design applied.

## What's written but NOT yet built

- **`docs/superpowers/specs/2026-07-09-photo-action-ui-design.md`** + **`docs/superpowers/plans/2026-07-09-photo-action-ui.md`** — a fully detailed 9-task plan (with complete TDD code for every step) to replace the current raw always-visible buttons with a Google Photos-style interaction model: hover icons on grid thumbnails, a lightbox, a "..." action menu. **This plan is ready to execute as-is** — no design decisions are pending, just implementation.
- **`docs/superpowers/specs/2026-07-09-ui-architecture-adr.md`** — the architecture decision record covering the parts the above plan doesn't: the dashboard/album-list page (currently a bare `<ul>`), modeled after ShotPik's dashboard shell (top nav, toolbar counters, card grid with an inline "+" create tile). **This one has no implementation plan yet** — it needs its own brainstorm → spec → plan cycle before building. The ADR also flags open questions (styling approach, dark mode, branding) that were deliberately left unresolved.
- **`docs/superpowers/design-references/`** — drop zone for visual prototypes from external tools (e.g. Google AI Studio). Read that folder's own README before using anything in it — it's reference material to adapt, not code to paste in directly.

## Conventions established across all 5 plans — follow these

- **`resolveActor()`** (`src/lib/actor.ts`) is the single access-control gate distinguishing an authenticated PHOTOGRAPHER session from an anonymous CLIENT (unlock-cookie + name-cookie). Every route that needs to know "who is asking" goes through this — never reimplemented per-route.
- **Drive operations always use the album owner's stored credentials** (`getDriveClientForUser(album.owner)`), never the acting session's — photographers only ever touch their own Drive.
- **Error convention**: every user-triggered action shows `role="alert"` on failure, with `'Network error — please try again.'` for a thrown/rejected fetch and `data.error ?? 'Something went wrong'` for a non-ok response. Match this exactly in new code.
- **TDD throughout**: every task in every plan follows write-failing-test → verify RED → implement → verify GREEN → commit. Test files mirror this codebase's existing patterns closely (see any `tests/` file for the shape).
- **No caching layer for full-resolution originals** — deliberate MVP simplification (see Plan 5's Global Constraints); don't "fix" this without discussing it first, it was a conscious tradeoff.

## Project structure quick-reference

- `docs/superpowers/specs/` — design specs (the "what and why").
- `docs/superpowers/plans/` — implementation plans (the "how," task-by-task with code).
- `docs/superpowers/design-references/` — external visual prototypes (see above).
- `prisma/schema.prisma` — the data model (User, Album, Photo, Like, Comment).
- `src/lib/` — shared server logic (Drive client, actor resolution, crypto, image processing).
- `src/app/` — Next.js App Router pages and API routes.
- `src/components/` — React components, mostly client components with co-located fetch logic.
- `tests/` — mirrors `src/`'s structure 1:1.
