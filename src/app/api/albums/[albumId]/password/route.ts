import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { hashPassword } from '@/lib/password'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
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
  const { password } = body as { password?: string | null }
  const passwordHash = password && password.trim() ? await hashPassword(password.trim()) : null

  const updated = await prisma.album.update({
    where: { id: albumId },
    data: { passwordHash },
  })

  return NextResponse.json({ id: updated.id, hasPassword: Boolean(updated.passwordHash) })
}
