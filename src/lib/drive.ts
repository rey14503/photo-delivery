import { google, drive_v3 } from 'googleapis'
import { decrypt } from './crypto'
import { requireEnv } from './env'

export interface DriveUser {
  encryptedRefreshToken: string | null
}

export function getDriveClientForUser(user: DriveUser): drive_v3.Drive {
  if (!user.encryptedRefreshToken) {
    throw new Error('User has no stored Drive refresh token')
  }
  const oauth2Client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET')
  )
  oauth2Client.setCredentials({ refresh_token: decrypt(user.encryptedRefreshToken) })
  return google.drive({ version: 'v3', auth: oauth2Client })
}

export async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Drive did not return a folder id')
  }
  return res.data.id
}

export interface AlbumFolders {
  albumFolderId: string
  selectedFolderId: string
}

export async function createAlbumFolders(
  drive: drive_v3.Drive,
  albumName: string
): Promise<AlbumFolders> {
  const albumFolderId = await createFolder(drive, albumName)
  const selectedFolderId = await createFolder(drive, 'Selected', albumFolderId)
  return { albumFolderId, selectedFolderId }
}
