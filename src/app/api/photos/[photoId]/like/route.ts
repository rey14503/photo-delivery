import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { getDriveClientForUser, createShortcut, deleteFile } from '@/lib/drive'

export async function POST(
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

  const actorKey = actorKeyFor(actor)

  try {
    const existing = await prisma.like.findUnique({
      where: { photoId_actorKey: { photoId, actorKey } },
    })

    if (existing) {
      if (existing.driveShortcutId) {
        const drive = getDriveClientForUser(photo.album.owner)
        await deleteFile(drive, existing.driveShortcutId)
      }
      await prisma.like.delete({ where: { id: existing.id } })
      return NextResponse.json({ liked: false })
    }

    let driveShortcutId: string | null = null
    if (actor.type === 'CLIENT') {
      const drive = getDriveClientForUser(photo.album.owner)
      driveShortcutId = await createShortcut(drive, photo.driveFileId, photo.album.selectedFolderId)
    }

    await prisma.like.create({
      data: {
        photoId,
        actorType: actor.type,
        actorName: actor.type === 'CLIENT' ? actor.name : null,
        userId: actor.type === 'PHOTOGRAPHER' ? actor.userId : null,
        actorKey,
        driveShortcutId,
      },
    })
    return NextResponse.json({ liked: true })
  } catch (error) {
    console.error('Failed to toggle like:', error)
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
  }
}
