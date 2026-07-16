import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER (tài khoản chủ) can grant or revoke ADMIN rights
    const isRootOwner =
      session.user.role === 'OWNER' ||
      session.user.email === process.env.ADMIN_EMAIL ||
      session.user.email === process.env.OWNER_EMAIL ||
      session.user.email === 'khoanguyenfotk5@gmail.com'

    if (!isRootOwner) {
      return NextResponse.json(
        { error: 'Only the root Owner account can grant or modify Admin permissions.' },
        { status: 403 }
      )
    }

    const { userId } = await params
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).role !== 'string') {
      return NextResponse.json({ error: 'Role must be a string (ADMIN or PHOTOGRAPHER)' }, { status: 400 })
    }

    const targetRoleValue = (body as Record<string, string>).role.trim().toUpperCase()
    if (targetRoleValue !== 'ADMIN' && targetRoleValue !== 'PHOTOGRAPHER') {
      return NextResponse.json({ error: 'Role must be ADMIN or PHOTOGRAPHER' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cannot demote or alter OWNER account
    if (targetUser.role === 'OWNER' || targetUser.email === process.env.ADMIN_EMAIL || targetUser.email === 'khoanguyenfotk5@gmail.com') {
      return NextResponse.json(
        { error: 'Cannot modify permissions of the root Owner account.' },
        { status: 403 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: targetRoleValue as 'ADMIN' | 'PHOTOGRAPHER' },
      select: { id: true, email: true, name: true, studioName: true, role: true, avatarUrl: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/team/users/[userId]/role error:', err)
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
  }
}
