import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'

const MAX_COMMENT_LENGTH = 2000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { album: true },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  const actor = await resolveActor(photo.album)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { text } = body as { text?: unknown }
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: 'A comment between 1 and 2000 characters is required' },
      { status: 400 }
    )
  }

  const comment = await prisma.comment.create({
    data: {
      photoId,
      actorType: actor.type,
      actorName: actor.type === 'CLIENT' ? actor.name : null,
      userId: actor.type === 'PHOTOGRAPHER' ? actor.userId : null,
      text: trimmed,
    },
  })

  return NextResponse.json(comment, { status: 201 })
}
