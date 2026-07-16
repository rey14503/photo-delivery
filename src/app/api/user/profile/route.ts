import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).name !== 'string' ||
      typeof (body as Record<string, unknown>).studioName !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Name and studioName must be valid strings' },
        { status: 400 }
      )
    }

    const name = (body as Record<string, string>).name.trim()
    const studioName = (body as Record<string, string>).studioName.trim()

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name, studioName },
      select: { name: true, studioName: true, role: true, avatarUrl: true },
    })

    return NextResponse.json({
      name: updated.name,
      studioName: updated.studioName,
      role: updated.role,
      avatarUrl: updated.avatarUrl,
    })
  } catch (err) {
    console.error('PUT /api/user/profile error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
