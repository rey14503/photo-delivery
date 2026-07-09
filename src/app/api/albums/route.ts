import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getDriveClientForUser,
  parseDriveFolderId,
  canEditFolder,
  findOrCreateFolder,
  isSupportedImageMimeType,
  listFolderFiles,
  downloadOriginal,
} from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { albumScopeFor } from '@/lib/album-scope'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, clientName, driveLink } = body as {
    name?: string
    clientName?: string
    driveLink?: string
  }
  if (!name || !clientName || !driveLink) {
    return NextResponse.json(
      { error: 'name, clientName, and driveLink are required' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const folderId = parseDriveFolderId(driveLink)
  if (!folderId) {
    return NextResponse.json({ error: 'driveLink is not a valid Google Drive folder link' }, { status: 400 })
  }

  const drive = getDriveClientForUser(user)

  const editable = await canEditFolder(drive, folderId)
  if (!editable) {
    return NextResponse.json(
      {
        error:
          'This folder is not accessible with edit permission. Make sure it is shared with edit access to your connected Google account.',
      },
      { status: 400 }
    )
  }

  try {
    const selectedFolderId = await findOrCreateFolder(drive, 'Selected', folderId)
    const shareToken = randomBytes(16).toString('hex')

    const album = await prisma.album.create({
      data: {
        name,
        clientName,
        ownerId: user.id,
        driveFolderId: folderId,
        selectedFolderId,
        shareToken,
      },
    })

    const files = await listFolderFiles(drive, folderId)
    const imageFiles = files.filter((file) => isSupportedImageMimeType(file.mimeType))
    const skipped = files.length - imageFiles.length

    let displayOrder = await prisma.photo.count({ where: { albumId: album.id } })
    for (const file of imageFiles) {
      const { buffer } = await downloadOriginal(drive, file.id)
      const { thumbnail, preview } = await processImage(buffer)
      const [thumbnailUrl, previewUrl] = await Promise.all([
        uploadToBlob(`drive-files/${file.id}/v1/thumb.jpg`, thumbnail, 'image/jpeg'),
        uploadToBlob(`drive-files/${file.id}/v1/preview.jpg`, preview, 'image/jpeg'),
      ])

      await prisma.photo.create({
        data: {
          albumId: album.id,
          driveFileId: file.id,
          originalName: file.name,
          displayOrder,
          thumbnailUrl,
          previewUrl,
        },
      })
      displayOrder += 1
    }

    return NextResponse.json({ ...album, imported: imageFiles.length, skipped }, { status: 201 })
  } catch (error) {
    console.error('Failed to create album:', error)
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(albums)
}
