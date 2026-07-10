# Photo Delivery Superpowers Design Spec (Sequential Features 1-4)

Date: 2026-07-10
Status: Approved
Target System: `photo-delivery` (BK Media Box / Next.js 15 + Prisma + Google Drive + Vercel Blob)

## Overview

This specification defines the sequential implementation of four high-impact open-source-inspired features (`Piwigo`, `Immich`, `Lychee`) for `photo-delivery` without adding server storage overhead or unnecessary features (no automatic watermark or link expiration timer). All UI elements strictly maintain **English** text and match existing **BK Media Box Glassmorphism** and exact `PhotoIcons.tsx` SVG icon styling (`viewBox="0 0 24 24"`, `strokeWidth="2.2" | "1.8"`, round linecaps).

---

## Feature 1: Client Proofing Lock & Final Submission (`Submit Final Selection`)

### Purpose
Allows clients to lock and submit their final selection of liked photos once proofing is complete. Prevents ongoing modification while the photographer is post-processing and displays an unmistakable badge and summary for the photographer.

### 1.1 Database Schema Changes (`prisma/schema.prisma`)
Add two fields to `Album`:
```prisma
model Album {
  // Existing fields...
  selectionLocked      Boolean   @default(false)
  selectionSubmittedAt DateTime?
}
```
*Migration*: Generate via `npx prisma migrate dev --name add_album_selection_lock`.

### 1.2 API Endpoints
1. `POST /api/albums/[albumId]/lock-selection`
   - **Auth**: Authorizes either `shareToken` (client) or authenticated owner/photographer (`session.user.id === album.ownerId`).
   - **Action**: Sets `selectionLocked = true` and `selectionSubmittedAt = new Date()` on the `Album`.
   - **Response**: `{ success: true, selectionLocked: true, selectionSubmittedAt: string }`

2. `PATCH /api/albums/[albumId]/unlock-selection`
   - **Auth**: Strictly requires authenticated owner (`session.user.id === album.ownerId`).
   - **Action**: Sets `selectionLocked = false` on the `Album`.
   - **Response**: `{ success: true, selectionLocked: false }`

### 1.3 Client UI (`src/components/ClientGallery.tsx`)
- **Floating Selection Bar (`FloatingSelectionBar`)**:
  - Rendered fixed at the bottom center/right (`bottom-6 z-40`) whenever `selectedCount > 0` or when `selectionLocked === true`.
  - **When `selectionLocked === false`**:
    - Text: `Selected: {selectedCount} photo(s)` (and `/ {limit}` if limit enabled).
    - CTA Button: `Submit Final Selection` (Orange accent `#ff5722`).
    - Clicking opens a modal/confirmation:
      > *"Are you sure you want to submit your selection of {N} photos? Once submitted, you won't be able to add or remove selections unless the photographer unlocks the album."*
  - **When `selectionLocked === true`**:
    - Banner Text: `🔒 Selection Submitted — Your photographer is currently reviewing your selected photos.`
    - All `ClientPhotoTile` like buttons and `PhotoLightbox` like buttons become `disabled={selectionLocked || toggling}` with tooltip: `"Selection locked after final submission"`.

### 1.4 Photographer UI (`src/components/PhotographerGallery.tsx`)
- On the album header/banner:
  - If `selectionLocked === true`: Show `✅ CLIENT SUBMITTED ({selectedCount} PHOTOS)` in emerald (`#10b981`).
  - If `selectionLocked === false`: Show `⏳ PROOFING IN PROGRESS`.
- In the toolbar: Show an action button with `<UnlockIcon />`: `Unlock Client Selection` (calls `PATCH /api/albums/[albumId]/unlock-selection`).

---

## Feature 2: Copy Selected Filenames for Lightroom / Capture One

### Purpose
Eliminates manual filename lookup for photographers when post-processing. A single click copies all selected/liked filenames so they can be pasted directly into Lightroom's text filter.

### 2.1 Photographer Toolbar UI (`src/components/PhotographerGallery.tsx`)
In the toolbar right/action group, add:
1. **`📋 Copy Selected Filenames` Button**:
   - Calculates selected photos: `photos.filter(p => p.clientLikers.length > 0 || p.suggestedByMe)` (or defaults to photos with `clientLikers.length > 0` if any exist, otherwise falls back to `suggestedByMe`).
   - Extracts filenames: Strips path if present, uses `originalName || name || id`.
   - Formats: Comma-separated string: `IMG_0123.CR2, IMG_0145.CR2, IMG_0889.JPG...`
   - Action: Uses `navigator.clipboard.writeText(...)` and sets a transient toast/feedback state: `"Copied {N} filenames to clipboard!"`

2. **`📥 Export Lightroom List (.TXT)` Button**:
   - Generates a Blob (`text/plain;charset=utf-8`) with each selected filename on a new line.
   - Triggers download of `[album-name]-selected-filenames.txt`.

### 2.2 Icon Support (`src/components/PhotoIcons.tsx`)
Add exact inline SVG glyph components:
- `ClipboardListIcon` (`size`, `className`, `style`)
- `TxtFileIcon` (`size`, `className`, `style`)

---

## Feature 3: Dynamic Grid Zoom (`[ - ] / [ + ]`) & Photo Info Panel (`[ i ]`)

### Purpose
Empowers users to customize grid density (from high-level scan to detailed view) and inspect technical photo metadata and selection notes inside the Lightbox.

### 3.1 Dynamic Grid Zoom (`ClientGallery.tsx` & `PhotographerGallery.tsx`)
- **State**: `const [gridLevel, setGridLevel] = useState<'small' | 'normal' | 'large'>('normal')`
- **Toolbar Control**:
  - Button group: `[ - ]` (Zoom Out) | `[ 4 cols ]` | `[ + ]` (Zoom In)
  - Uses `<ZoomOutIcon />` and `<ZoomInIcon />` from `PhotoIcons.tsx`.
- **Responsive CSS Mapping**:
  - `small`: 6 columns on desktop (`grid-template-columns: repeat(6, minmax(0, 1fr))`), 3 on mobile.
  - `normal`: 4 columns on desktop (`grid-template-columns: repeat(4, minmax(0, 1fr))`), 2 on mobile.
  - `large`: 2 columns on desktop (`grid-template-columns: repeat(2, minmax(0, 1fr))`), 1 on mobile.
- Applied via CSS classes or inline CSS custom property `--grid-cols` with `transition: grid-template-columns 0.2s ease`.

### 3.2 Photo Info Panel in Lightbox (`src/components/PhotoLightbox.tsx`)
- **Top Control Bar**: Add `<button onClick={() => setShowInfo(!showInfo)} aria-label="Photo Info"><InfoOutlineIcon /></button>`
- **Info Sidebar Overlay**:
  - When `showInfo === true`, renders a right-side glass panel (`width: 300px`, `background: rgba(18, 18, 20, 0.85)`):
    - **Original Filename**: `IMG_0123.JPG`
    - **Version Number**: `v2` (`Jul 10, 2026`)
    - **Client Likers**: `Liked by: Nguyễn Văn A`
    - **Suggested Status**: `Suggested by Photographer`
    - **Status Note**: `"Brighten skin tones"` (if present)
    - **Comments**: Shows comment thread count and direct link to focus input.

---

## Feature 4: Batch Download Selected ZIP (`Download Selected (X)`)

### Purpose
Allows clients or photographers to download a single ZIP package containing only the photos they selected during proofing.

### 4.1 UI Controls (`ClientGallery.tsx` & `PhotographerGallery.tsx`)
- Next to `Download All Photos`, if `downloadEnabled === true` and `selectedPhotosCount > 0`, render:
  `<button onClick={handleDownloadSelected} className={styles.downloadSelectedBtn}><ZipBoxIcon /> Download Selected ({selectedCount}) ZIP</button>`

### 4.2 API Endpoint (`src/app/api/albums/[albumId]/download-selected/route.ts`)
- **Method**: `POST`
- **Body**: `{ photoIds: string[], shareToken?: string }`
- **Authorization**:
  - If `shareToken` is provided, verifies `album.shareToken === shareToken` and `album.downloadEnabled === true`.
  - Or verifies `session.user.id === album.ownerId`.
- **Streaming Implementation**:
  - Queries `Photo` rows where `id in photoIds` and `albumId === albumId`.
  - Uses `archiver('zip')` to stream files directly from Google Drive (`drive.files.get({ fileId: photo.driveFileId, alt: 'media' }, { responseType: 'stream' })`) into the HTTP response stream (`Content-Type: application/zip`, `Content-Disposition: attachment; filename="[album-name]-selected-photos.zip"`).

---

## Verification & Testing Plan

### Automated Tests (`npx vitest run`)
1. **Feature 1**:
   - `tests/api/albums-selection-lock.test.ts`: Test locking selection with shareToken and unlocking with photographer session.
   - `tests/components/ClientGallery.test.tsx`: Verify `FloatingSelectionBar` renders, submit selection disables `♥` buttons, and `selectionLocked` banner displays.
2. **Feature 2**:
   - `tests/components/PhotographerGallery.test.tsx`: Test `Copy Selected Filenames` extracts and formats filenames correctly, triggers clipboard write, and `Export .TXT` creates file download.
3. **Feature 3**:
   - `tests/components/ClientGallery.test.tsx`: Verify `[ - ] / [ + ]` buttons change `gridLevel` state and CSS classes.
   - `tests/components/PhotoLightbox.test.tsx`: Test `[ i ]` button toggles info panel visibility and renders metadata correctly.
4. **Feature 4**:
   - `tests/api/albums-download-selected.test.ts`: Verify POST `/api/albums/[albumId]/download-selected` streams ZIP archive for requested photo IDs when authorized.

### Manual Verification
- Run dev server on port 3000 (`npm run dev -- --turbo`), open `ClientGallery` (`/a/[shareToken]`) and `PhotographerGallery` (`/albums/[albumId]`), and verify all 4 sequential workflows end-to-end.
