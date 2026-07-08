import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { albumUnlockCookieName, unlockToken } from '@/lib/album-unlock'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params
  const album = await prisma.album.findUnique({ where: { shareToken } })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }
  if (!album.passwordHash) {
    return NextResponse.json({ error: 'This album has no password' }, { status: 400 })
  }

  const body = await request.json()
  const { password } = body as { password?: string }
  if (!password || !(await verifyPassword(password, album.passwordHash))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(albumUnlockCookieName(album.id), unlockToken(album.id), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  return response
}
