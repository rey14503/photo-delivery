import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { getDriveClientForUser, downloadOriginal } from '@/lib/drive'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { owner: true, photos: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const actor = await resolveActor(album)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (actor.type === 'CLIENT' && !album.downloadEnabled) {
    return NextResponse.json(
      { error: 'Downloads are not enabled for this album' },
      { status: 403 }
    )
  }

  try {
    const drive = getDriveClientForUser(album.owner)
    const zip = new JSZip()
    for (const photo of album.photos) {
      const { buffer, name } = await downloadOriginal(drive, photo.driveFileId)
      zip.file(name, buffer)
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${album.name}.zip"`,
      },
    })
  } catch (error) {
    console.error('Failed to build album zip:', error)
    return NextResponse.json({ error: 'Failed to build album zip' }, { status: 500 })
  }
}
