import type { drive_v3 } from 'googleapis'
import { prisma } from './prisma'
import { driveFolderIsGone } from './drive'

export async function deleteAlbumIfDriveFolderGone(
  drive: drive_v3.Drive,
  album: { id: string; driveFolderId: string }
): Promise<boolean> {
  console.log('[deleteAlbumIfDriveFolderGone] Checking album:', album.id, 'driveFolderId:', album.driveFolderId)
  const gone = await driveFolderIsGone(drive, album.driveFolderId)
  console.log('[deleteAlbumIfDriveFolderGone] Result of driveFolderIsGone for album:', album.id, 'is:', gone)
  if (!gone) {
    return false
  }
  await prisma.album.delete({ where: { id: album.id } })
  console.log('[deleteAlbumIfDriveFolderGone] Successfully deleted album from DB:', album.id)
  return true
}
