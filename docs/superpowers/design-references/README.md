# Design References

Drop visual/prototype output from external tools (e.g. Google AI Studio's Build mode) here — one subfolder per source, e.g. `ai-studio-dashboard-mockup/` or `bk-media-box/`.

**These are reference material only, never production code.** Nothing in this folder is imported by the app. Whoever picks up the corresponding plan (see `docs/superpowers/specs/2026-07-09-ui-architecture-adr.md`) should look at what's here for layout/visual direction, then implement it as real components inside `src/`, following the existing codebase's conventions (component boundaries, prop shapes, TDD, error handling).

## Contents

- **`bk-media-box/`**: Full Google AI Studio mockup (`DashboardShell.tsx`, `PhotographerGallery.tsx`, `ClientGallery.tsx`, `PhotoTile.tsx`, `PhotoLightbox.tsx`). Added on 2026-07-09. Exact visual baseline for `CreateAlbumModal`, `CreateAlbumForm`, `PhotographerGallery`, `ClientGallery`, and `PhotoTile`.
