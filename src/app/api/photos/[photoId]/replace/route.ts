import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, replaceFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { canManageAlbum } from '@/lib/album-permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { photoId } = await params
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { album: { include: { owner: true } } },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }
  if (!canManageAlbum(session.user, photo.album)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as { type?: string; name?: string; arrayBuffer?: () => Promise<ArrayBuffer> } | null
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'file must be an image' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const drive = getDriveClientForUser(photo.album.owner)
    await replaceFile(drive, photo.driveFileId, file.type, buffer)
    const { thumbnail, preview } = await processImage(buffer)

    const newVersion = photo.version + 1
    const [thumbnailUrl, previewUrl] = await Promise.all([
      uploadToBlob(`drive-files/${photo.driveFileId}/v${newVersion}/thumb.jpg`, thumbnail, 'image/jpeg'),
      uploadToBlob(`drive-files/${photo.driveFileId}/v${newVersion}/preview.jpg`, preview, 'image/jpeg'),
    ])

    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: {
        version: newVersion,
        thumbnailUrl,
        previewUrl,
        originalName: file.name ? file.name : photo.originalName,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to replace photo:', error)
    return NextResponse.json({ error: 'Failed to replace photo' }, { status: 500 })
  }
}
