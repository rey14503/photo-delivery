import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { albumId } = await params
    const album = await prisma.album.findUnique({ where: { id: albumId } })
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }
    if (!canManageAlbum(session.user, album)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.album.delete({ where: { id: albumId } })

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('[DELETE /api/albums/[albumId]] Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete album' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { albumId } = await params
    const album = await prisma.album.findUnique({ where: { id: albumId } })
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }
    if (!canManageAlbum(session.user, album)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, clientName, coverPhotoId } = body as {
      name?: string
      clientName?: string
      coverPhotoId?: string | null
    }

    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'name must not be empty' }, { status: 400 })
    }
    if (clientName !== undefined && !clientName) {
      return NextResponse.json({ error: 'clientName must not be empty' }, { status: 400 })
    }

    const data: { name?: string; clientName?: string; coverPhotoId?: string | null } = {}
    if (name !== undefined) data.name = name
    if (clientName !== undefined) data.clientName = clientName

    if (coverPhotoId !== undefined) {
      if (coverPhotoId === null) {
        data.coverPhotoId = null
      } else {
        const photo = await prisma.photo.findUnique({ where: { id: coverPhotoId } })
        if (!photo || photo.albumId !== albumId) {
          return NextResponse.json(
            { error: 'coverPhotoId must reference a photo in this album' },
            { status: 400 }
          )
        }
        data.coverPhotoId = coverPhotoId
      }
    }

    const updated = await prisma.album.update({ where: { id: albumId }, data })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[PATCH /api/albums/[albumId]] Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to update album info' }, { status: 500 })
  }
}
