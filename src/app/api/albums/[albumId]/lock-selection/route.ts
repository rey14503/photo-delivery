import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { resolveActor } from '@/lib/actor'
import { albumUnlockCookieName, isUnlocked } from '@/lib/album-unlock'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params
    const body = await req.json().catch(() => ({}))
    const { shareToken } = body as { shareToken?: string }

    const album = await prisma.album.findUnique({ where: { id: albumId } })
    if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

    const actor = await resolveActor(album)
    const isPhotographer = actor?.type === 'PHOTOGRAPHER'
    const isClientActor = actor?.type === 'CLIENT'
    let isClientWithToken = Boolean(shareToken && shareToken === album.shareToken)

    if (isClientWithToken && album.passwordHash && !isPhotographer && !isClientActor) {
      const cookieStore = await cookies()
      const unlockCookie = cookieStore.get(albumUnlockCookieName(album.id))?.value
      if (!isUnlocked(album.id, unlockCookie)) {
        isClientWithToken = false
      }
    }

    if (!isPhotographer && !isClientActor && !isClientWithToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updated = await prisma.album.update({
      where: { id: albumId },
      data: {
        selectionLocked: true,
        selectionSubmittedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      selectionLocked: updated.selectionLocked,
      selectionSubmittedAt: updated.selectionSubmittedAt,
    })
  } catch (err) {
    console.error('Lock selection error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
