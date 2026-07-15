import type { drive_v3 } from 'googleapis'
import { prisma } from './prisma'
import { driveFolderIsGone } from './drive'

export async function deleteAlbumIfDriveFolderGone(
  drive: drive_v3.Drive,
  album: { id: string; driveFolderId: string }
): Promise<boolean> {
  const gone = await driveFolderIsGone(drive, album.driveFolderId)
  if (!gone) {
    return false
  }
  await prisma.album.delete({ where: { id: album.id } })
  return true
}
