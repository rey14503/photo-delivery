import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { getDriveClientForUser, downloadOriginal, dedupeFilename } from '@/lib/drive'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params
  let body: { shareToken?: string; photoIds?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { shareToken, photoIds } = body
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: 'No photo IDs provided' }, { status: 400 })
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { owner: true },
  })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const actor = await resolveActor(album)
  const isPhotographer = actor?.type === 'PHOTOGRAPHER'
  const isClientWithToken = Boolean(shareToken && shareToken === album.shareToken)
  const isClientActor = actor?.type === 'CLIENT'

  if (!isPhotographer && !isClientWithToken && !isClientActor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPhotographer && !album.downloadEnabled) {
    return NextResponse.json(
      { error: 'Downloads are not enabled for this album' },
      { status: 403 }
    )
  }

  const photos = await prisma.photo.findMany({
    where: {
      albumId,
      id: { in: photoIds as string[] },
    },
    orderBy: { displayOrder: 'asc' },
  })

  try {
    const drive = getDriveClientForUser(album.owner)
    const zip = new JSZip()
    const usedNames = new Map<string, number>()
    for (const photo of photos) {
      const { buffer, name } = await downloadOriginal(drive, photo.driveFileId)
      const uniqueName = dedupeFilename(name, usedNames)
      zip.file(uniqueName, buffer)
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${album.name}-selected.zip"`,
      },
    })
  } catch (error) {
    console.error('Failed to build selected photos zip:', error)
    return NextResponse.json({ error: 'Failed to build selected photos zip' }, { status: 500 })
  }
}
