import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const album = await prisma.album.findUnique({ where: { id: albumId } })
    if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

    if (album.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.album.update({
      where: { id: albumId },
      data: {
        selectionLocked: false,
        selectionSubmittedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      selectionLocked: updated.selectionLocked,
    })
  } catch (err) {
    console.error('Unlock selection error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
