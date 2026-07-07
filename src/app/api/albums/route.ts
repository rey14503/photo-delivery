import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, createAlbumFolders } from '@/lib/drive'
import { albumScopeFor } from '@/lib/album-scope'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, clientName } = body as { name?: string; clientName?: string }
  if (!name || !clientName) {
    return NextResponse.json({ error: 'name and clientName are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const drive = getDriveClientForUser(user)
  const { albumFolderId, selectedFolderId } = await createAlbumFolders(drive, name)
  const shareToken = randomBytes(16).toString('hex')

  const album = await prisma.album.create({
    data: {
      name,
      clientName,
      ownerId: user.id,
      driveFolderId: albumFolderId,
      selectedFolderId,
      shareToken,
    },
  })

  return NextResponse.json(album, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(albums)
}
