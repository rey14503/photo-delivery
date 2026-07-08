import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { getDriveClientForUser, downloadOriginal } from '@/lib/drive'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { album: { include: { owner: true } } },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  const actor = await resolveActor(photo.album)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (actor.type === 'CLIENT' && !photo.album.downloadEnabled) {
    return NextResponse.json(
      { error: 'Downloads are not enabled for this album' },
      { status: 403 }
    )
  }

  try {
    const drive = getDriveClientForUser(photo.album.owner)
    const { buffer, mimeType, name } = await downloadOriginal(drive, photo.driveFileId)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    })
  } catch (error) {
    console.error('Failed to download photo:', error)
    return NextResponse.json({ error: 'Failed to download photo' }, { status: 500 })
  }
}
