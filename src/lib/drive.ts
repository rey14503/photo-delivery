import { google, drive_v3 } from 'googleapis'
import { decrypt } from './crypto'
import { requireEnv } from './env'
import { Readable } from 'stream'

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

export async function uploadFile(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Drive did not return a file id')
  }
  return res.data.id
}

export async function replaceFile(
  drive: drive_v3.Drive,
  fileId: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  await drive.files.update({
    fileId,
    media: { mimeType, body: Readable.from(buffer) },
  })
}

export async function createShortcut(
  drive: drive_v3.Drive,
  targetFileId: string,
  parentId: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name: 'shortcut',
      mimeType: 'application/vnd.google-apps.shortcut',
      parents: [parentId],
      shortcutDetails: { targetId: targetFileId },
    },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Drive did not return a shortcut id')
  }
  return res.data.id
}

export async function deleteFile(drive: drive_v3.Drive, fileId: string): Promise<void> {
  await drive.files.delete({ fileId })
}

export async function downloadOriginal(
  drive: drive_v3.Drive,
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  const metadata = await drive.files.get({ fileId, fields: 'name,mimeType' })
  const content = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  return {
    buffer: Buffer.from(content.data as ArrayBuffer),
    mimeType: metadata.data.mimeType ?? 'application/octet-stream',
    name: metadata.data.name ?? 'photo',
  }
}

export function dedupeFilename(name: string, seen: Map<string, number>): string {
  const count = seen.get(name) ?? 0
  seen.set(name, count + 1)
  if (count === 0) {
    return name
  }
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0) {
    return `${name} (${count})`
  }
  return `${name.slice(0, lastDot)} (${count})${name.slice(lastDot)}`
}

export function parseDriveFolderId(link: string): string | null {
  const match = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export async function canEditFolder(drive: drive_v3.Drive, folderId: string): Promise<boolean> {
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'mimeType,trashed,capabilities(canEdit)',
    })
    return (
      res.data.mimeType === 'application/vnd.google-apps.folder' &&
      res.data.trashed !== true &&
      res.data.capabilities?.canEdit === true
    )
  } catch {
    return false
  }
}

export async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  })
  const existing = res.data.files?.[0]
  if (existing?.id) {
    return existing.id
  }
  return createFolder(drive, name, parentId)
}

const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function isSupportedImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType)
}

export interface DriveFolderFile {
  id: string
  name: string
  mimeType: string
}

export async function listFolderFiles(
  drive: drive_v3.Drive,
  folderId: string
): Promise<DriveFolderFile[]> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType)',
  })
  const files = res.data.files ?? []
  return files
    .filter((file) => file.id && file.name && file.mimeType)
    .map((file) => ({ id: file.id!, name: file.name!, mimeType: file.mimeType! }))
}

export async function driveFolderIsGone(
  drive: drive_v3.Drive,
  folderId: string
): Promise<boolean> {
  try {
    const res = await drive.files.get({ fileId: folderId, fields: 'trashed' })
    return res.data.trashed === true
  } catch (error) {
    const code = (error as { code?: number })?.code
    return code === 404
  }
}
