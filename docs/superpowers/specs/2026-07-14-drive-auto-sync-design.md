# Google Drive Background Auto-Sync Engine & Manual Sync

## 1. Goal & Architecture
When a photographer adds or removes photo files directly inside their linked Google Drive folder, the web application (`photo-delivery`) should automatically detect and synchronize these changes when the photographer visits the web app or clicks sync.

To prevent blocking page renders and ensure `0.1s` initial page load times, synchronization runs asynchronously via a **Stale-While-Revalidate Background Sync Engine**.

## 2. API Endpoints (`Server-side Sync Engine`)

### `POST /api/albums/[albumId]/sync`
1. **Authentication & Authorization**: Verify `session.user` can manage the album (`canManageAlbum`).
2. **Drive Folder Inspection**:
   - Call `listFolderFiles(drive, album.driveFolderId)` to get all image files currently inside the album's Drive folder.
   - Query existing database photos: `prisma.photo.findMany({ where: { albumId } })`.
   - Build lookup sets (`driveFileIds` vs `dbPhotoIds`).
3. **Detect & Process New Photos (`Uploads`)**:
   - For every Drive file where `!dbPhotoIds.has(file.id)`:
     - Download original buffer (`downloadOriginal(drive, file.id)`).
     - Generate thumbnail & preview buffers (`processImage(buffer)`).
     - Upload both to Vercel Blob (`uploadToBlob`).
     - Insert `Photo` row into database (`prisma.photo.create`) with `originalName: file.name`, `driveFileId: file.id`, and calculated `displayOrder`.
4. **Detect & Clean Up Deleted Photos (`Removals`)**:
   - For every DB photo where `!driveFileIds.has(photo.driveFileId)`:
     - Verify via `drive.files.get({ fileId: photo.driveFileId, fields: 'trashed' })` or assume removed from folder.
     - Delete `Photo` row (`prisma.photo.delete({ where: { id: photo.id } })`).
5. **Response Payload**:
   - Return JSON summary: `{ added: number, removed: number, total: number, syncedAt: string }`.

## 3. Frontend Integration (`Auto-Sync & Manual Sync UI`)

### `useAutoSyncAlbum(albumId)` Custom Hook
- Triggered automatically inside `PhotographerGallery.tsx` (`useEffect`) right after the page mounts.
- Calls `POST /api/albums/[albumId]/sync` quietly in the background.
- If `res.added > 0` or `res.removed > 0`, invokes `router.refresh()` to update the photo grid and displays a notification toast/banner (`⚡ Đã tự động cập nhật X ảnh mới từ Google Drive!`).

### Manual Sync Button inside `PhotographerGallery.tsx`
- Located adjacent to the `+ Upload photos` button.
- Button text: `🔄 Đồng bộ Drive (`Sync from Drive`)`.
- Shows a spinning icon / loading state when manually triggered.
