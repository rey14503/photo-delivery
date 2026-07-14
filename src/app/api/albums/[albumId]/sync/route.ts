import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, listFolderFiles, isSupportedImageMimeType } from '@/lib/drive'
import { canManageAlbum } from '@/lib/album-permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { albumId } = await params
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: { owner: true },
    })

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }

    if (!canManageAlbum(session.user, album)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!album.driveFolderId || !album.owner?.encryptedRefreshToken) {
      return NextResponse.json({ error: 'Album is not linked to an active Drive account' }, { status: 400 })
    }

    const drive = getDriveClientForUser(album.owner)
    const allFiles = await listFolderFiles(drive, album.driveFolderId)
    const driveImageFiles = allFiles.filter((f) => isSupportedImageMimeType(f.mimeType, f.name))

    const existingPhotos = await prisma.photo.findMany({
      where: { albumId },
      select: { id: true, driveFileId: true },
    })

    const currentDriveMap = new Map(driveImageFiles.map((f) => [f.id, f]))
    const existingDriveIds = new Set(existingPhotos.map((p) => p.driveFileId))

    // 1. Process deletions
    const deletedPhotos = existingPhotos.filter((p) => !currentDriveMap.has(p.driveFileId))
    const deletedIds = deletedPhotos.map((p) => p.id)

    if (deletedIds.length > 0) {
      await prisma.photo.deleteMany({
        where: { id: { in: deletedIds } },
      })

      if (album.coverPhotoId && deletedIds.includes(album.coverPhotoId)) {
        const remainingPhotos = await prisma.photo.findMany({
          where: { albumId },
          orderBy: { displayOrder: 'asc' },
          take: 1,
          select: { id: true },
        })
        await prisma.album.update({
          where: { id: albumId },
          data: { coverPhotoId: remainingPhotos[0]?.id ?? null },
        })
      }
    }

    // 2. Process additions
    const addedFiles = driveImageFiles.filter((f) => !existingDriveIds.has(f.id))
    if (addedFiles.length > 0) {
      const baseDisplayOrder = await prisma.photo.count({ where: { albumId } })

      const createdPhotos = await Promise.all(
        addedFiles.map(async (file, idx) => {
          const thumbUrl = `/api/photos/${file.id}/proxy?albumId=${albumId}&type=thumb`
          const prevUrl = `/api/photos/${file.id}/proxy?albumId=${albumId}&type=preview`

          return prisma.photo.create({
            data: {
              albumId,
              driveFileId: file.id,
              originalName: file.name,
              displayOrder: baseDisplayOrder + idx,
              thumbnailUrl: thumbUrl,
              previewUrl: prevUrl,
            },
          })
        })
      )

      if (!album.coverPhotoId && createdPhotos.length > 0 && createdPhotos[0]?.id) {
        await prisma.album.update({
          where: { id: albumId },
          data: { coverPhotoId: createdPhotos[0].id },
        })
      }
    }

    const totalPhotos = await prisma.photo.count({ where: { albumId } })

    return NextResponse.json({
      synced: true,
      addedCount: addedFiles.length,
      deletedCount: deletedIds.length,
      totalPhotos,
    })
  } catch (error) {
    console.error('POST /api/albums/[albumId]/sync error:', error)
    return NextResponse.json({ error: 'Failed to sync with Google Drive' }, { status: 500 })
  }
}
