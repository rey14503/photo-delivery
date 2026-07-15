# User Profile Menu & Google Drive Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich User Profile & Studio Menu (`avatarUrl`, `studioName`) and a Stale-While-Revalidate Google Drive Auto-Sync Engine so photos added to Drive folders sync automatically on the web app.

**Architecture:** 
1. `User Profile & Menu`: Expand Prisma `User` schema with `avatarUrl` and `studioName`. Add `PUT /api/user/profile` and `POST /api/user/avatar` (Vercel Blob storage). Build `UserAccountMenu` dropdown popover and `EditProfileModal` portal modal.
2. `Drive Auto-Sync Engine`: Add `POST /api/albums/[albumId]/sync` which checks Drive folder contents vs database rows (`listFolderFiles`), downloads/processes new images into Vercel Blob, and removes trashed/missing rows. Add `useAutoSyncAlbum` hook and a manual `Sync from Drive` button inside `PhotographerGallery.tsx`.

**Tech Stack:** Next.js 15 (App Router), React 18 (`createPortal`), Prisma ORM, `@vercel/blob`, `sharp`, `googleapis` Drive API v3, Vitest.

## Global Constraints
- All existing 255+ unit tests must continue to pass.
- New unit tests written in Vitest targeting `tests/` directory.
- `sharp` processing and `@vercel/blob` storage patterns must match existing `image-processing.ts` and `blob-storage.ts` conventions.

---

### Task 1: Prisma Schema & Session Extension for `User Profile`

**Files:**
- Modify: `prisma/schema.prisma:15-26`
- Modify: `src/lib/auth.ts:1-50`
- Modify: `src/types/next-auth.d.ts:1-20` (or create if needed)
- Test: `tests/api/user-profile.test.ts`

**Interfaces:**
- Consumes: Existing `session.user` identity (`id`, `email`, `name`, `role`).
- Produces: `session.user.avatarUrl?: string | null` and `session.user.studioName?: string | null`.

- [ ] **Step 1: Write failing test for profile update API (`PUT /api/user/profile`)**
Write unit test checking that `PUT /api/user/profile` requires authentication and successfully updates `name` and `studioName` in database.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/api/user-profile.test.ts`
Expected: FAIL (route not found / schema error)

- [ ] **Step 3: Update `prisma/schema.prisma` with `avatarUrl` and `studioName`**
```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  role                  Role     @default(PHOTOGRAPHER)
  avatarUrl             String?
  studioName            String?
  encryptedRefreshToken String?
  driveRootFolderId     String?
  createdAt             DateTime @default(now())
  albums                Album[]
  likes                 Like[]
  comments              Comment[]
}
```
Run `npx prisma db push` (or `npx prisma migrate dev`) to update local database schema.

- [ ] **Step 4: Create `PUT /api/user/profile` endpoint (`src/app/api/user/profile/route.ts`)**
Create API route updating user profile (`name`, `studioName`) in `User` table and returning updated fields.

- [ ] **Step 5: Run unit test to verify PASS**
Run: `npx vitest run tests/api/user-profile.test.ts`
Expected: PASS

- [ ] **Step 6: Commit Task 1**
Run `git add . && git commit -m "feat(user): add avatarUrl and studioName to User schema and PUT /api/user/profile endpoint"`

---

### Task 2: Avatar Upload Endpoint (`POST /api/user/avatar`)

**Files:**
- Create: `src/app/api/user/avatar/route.ts`
- Test: `tests/api/user-avatar.test.ts`

**Interfaces:**
- Consumes: `uploadToBlob` from `@/lib/blob-storage`, `processImage` from `@/lib/image-processing`.
- Produces: Updated `User.avatarUrl` (`https://...blob.vercel-storage.com/...`).

- [ ] **Step 1: Write failing test (`tests/api/user-avatar.test.ts`)**
Write test sending `FormData` containing an image buffer to `POST /api/user/avatar`, expecting a 200 JSON with `{ avatarUrl: "..." }`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/api/user-avatar.test.ts`
Expected: FAIL (route not found)

- [ ] **Step 3: Implement `src/app/api/user/avatar/route.ts`**
Receive `FormData.get('file')`, process image/buffer using `processImage` or `uploadToBlob`, save blob URL to `User.avatarUrl` via `prisma.user.update`, return `{ avatarUrl }`.

- [ ] **Step 4: Run test to verify PASS**
Run: `npx vitest run tests/api/user-avatar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 2**
Run `git add . && git commit -m "feat(user): add POST /api/user/avatar endpoint uploading avatar to Vercel Blob"`

---

### Task 3: `UserAccountMenu` Dropdown Popover & `EditProfileModal` Portal

**Files:**
- Create: `src/components/EditProfileModal.tsx`
- Create: `src/components/EditProfileModal.module.css`
- Create: `src/components/UserAccountMenu.tsx`
- Create: `src/components/UserAccountMenu.module.css`
- Modify: `src/components/TopNav.tsx`
- Modify: `src/components/TopNav.module.css`
- Test: `tests/components/UserAccountMenu.test.tsx`

**Interfaces:**
- Consumes: `session.user` props (`name`, `email`, `avatarUrl`, `studioName`), `signOut` from `next-auth/react`.
- Produces: Interactive top-right user pill in `TopNav` toggling glassmorphic menu popover and profile edit modal (`createPortal`).

- [ ] **Step 1: Write unit test for `UserAccountMenu` and `EditProfileModal`**
Test clicking user pill opens dropdown menu, displaying name/email/badge. Test clicking "Chỉnh sửa thông tin / Quản lý Studio" opens modal with inputs for `name` and `studioName`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/components/UserAccountMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `EditProfileModal.tsx` & CSS**
Render centered modal via `createPortal(..., document.body)` with Avatar preview + upload button (`input[type="file"]`), text inputs for Full Name (`name`) and Studio Title (`studioName`), and Save/Cancel buttons.

- [ ] **Step 4: Implement `UserAccountMenu.tsx` & CSS**
Render dropdown popover right below TopNav with Avatar, Name, Email, `Chủ Studio (PRO)` badge (`studioName`), menu items, and red `Sign out` button (`[-> Đăng xuất`).

- [ ] **Step 5: Integrate into `TopNav.tsx`**
Replace old plain user text + sign out button with circular Avatar / Pill button connected to `UserAccountMenu`.

- [ ] **Step 6: Run test to verify PASS**
Run: `npx vitest run tests/components/UserAccountMenu.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit Task 3**
Run `git add . && git commit -m "feat(ui): implement UserAccountMenu dropdown popover and EditProfileModal portal"`

---

### Task 4: Google Drive Auto-Sync Server Engine (`POST /api/albums/[albumId]/sync`)

**Files:**
- Create: `src/app/api/albums/[albumId]/sync/route.ts`
- Test: `tests/api/albums-sync.test.ts`

**Interfaces:**
- Consumes: `listFolderFiles(drive, album.driveFolderId)`, `downloadOriginal(drive, fileId)`, `processImage(buffer)`, `uploadToBlob(path, buffer, mimeType)`.
- Produces: `POST /api/albums/[albumId]/sync` -> `{ added: number, removed: number, total: number, syncedAt: string }`.

- [ ] **Step 1: Write failing test (`tests/api/albums-sync.test.ts`)**
Mock `listFolderFiles` returning 2 new Drive files not currently in `Photo` table. Verify `POST /api/albums/[albumId]/sync` downloads/processes/inserts both photos into `Photo` table (`originalName` populated correctly) and returns `{ added: 2 }`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/api/albums-sync.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/app/api/albums/[albumId]/sync/route.ts`**
```ts
// 1. Check auth and permissions
// 2. Query drive files via listFolderFiles(drive, album.driveFolderId)
// 3. Query existing db photos via prisma.photo.findMany({ where: { albumId } })
// 4. For new drive files, downloadOriginal -> processImage -> uploadToBlob -> prisma.photo.create({ ... originalName: file.name ... })
// 5. For db photos whose driveFileId is missing/trashed from drive files list, prisma.photo.delete({ where: { id: photo.id } })
// 6. Return { added, removed, total: updatedCount, syncedAt: new Date().toISOString() }
```

- [ ] **Step 4: Run test to verify PASS**
Run: `npx vitest run tests/api/albums-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 4**
Run `git add . && git commit -m "feat(sync): implement POST /api/albums/[albumId]/sync Drive auto-sync engine"`

---

### Task 5: Frontend Integration (`Auto-Sync Hook` & Manual `Sync from Drive` Button)

**Files:**
- Create: `src/lib/hooks/useAutoSyncAlbum.ts`
- Modify: `src/components/PhotographerGallery.tsx`
- Modify: `src/components/PhotographerGallery.module.css`
- Test: `tests/components/PhotographerGallery-sync.test.tsx`

**Interfaces:**
- Consumes: `POST /api/albums/[albumId]/sync`, `useRouter()` (`router.refresh()`).
- Produces: Background auto-sync trigger on page mount (`useAutoSyncAlbum`) plus `🔄 Đồng bộ Drive` button right next to `+ Upload photos` button.

- [ ] **Step 1: Write unit test (`tests/components/PhotographerGallery-sync.test.tsx`)**
Verify `useAutoSyncAlbum` fires `/api/albums/[albumId]/sync` right after component mount and invokes `router.refresh()` when `res.added > 0`. Verify clicking `Sync from Drive` button triggers manual sync and shows spinning indicator.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/components/PhotographerGallery-sync.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `useAutoSyncAlbum.ts`**
Create custom hook calling `fetch('/api/albums/' + albumId + '/sync', { method: 'POST' })` silently on mount (`useEffect` once per albumId). When `data.added > 0 || data.removed > 0`, call `router.refresh()` to update the gallery.

- [ ] **Step 4: Add Manual `Sync from Drive` Button & Hook inside `PhotographerGallery.tsx`**
Call `useAutoSyncAlbum(album.id)`. Add button `🔄 Đồng bộ Drive (`Sync from Drive`)` beside `+ Upload photos`.

- [ ] **Step 5: Run all unit tests to verify 100% PASS**
Run: `npx vitest run`
Expected: All 260+ tests PASS

- [ ] **Step 6: Commit Task 5**
Run `git add . && git commit -m "feat(ui): add useAutoSyncAlbum hook and manual Sync from Drive button to PhotographerGallery"`
