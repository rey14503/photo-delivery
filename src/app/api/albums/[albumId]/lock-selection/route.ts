import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const session = await getServerSession(authOptions)
    const isOwner = session?.user?.id && session.user.id === album.ownerId
    const isClientWithToken = shareToken && shareToken === album.shareToken

    if (!isOwner && !isClientWithToken) {
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
