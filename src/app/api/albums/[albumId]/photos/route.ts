import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, uploadFile } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'
import { canManageAlbum } from '@/lib/album-permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
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
    const drive = getDriveClientForUser(album.owner)
    const driveFileId = await uploadFile(
      drive,
      album.driveFolderId,
      file.name ?? 'untitled',
      file.type,
      buffer
    )
    const { thumbnail, preview } = await processImage(buffer)

    const displayOrder = await prisma.photo.count({ where: { albumId } })
    const [thumbnailUrl, previewUrl] = await Promise.all([
      uploadToBlob(`drive-files/${driveFileId}/v1/thumb.jpg`, thumbnail, 'image/jpeg'),
      uploadToBlob(`drive-files/${driveFileId}/v1/preview.jpg`, preview, 'image/jpeg'),
    ])

    const photo = await prisma.photo.create({
      data: {
        albumId,
        driveFileId,
        displayOrder,
        thumbnailUrl,
        previewUrl,
      },
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('Failed to upload photo:', error)
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
}
