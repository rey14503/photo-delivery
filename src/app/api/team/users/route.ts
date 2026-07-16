import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        studioName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    return NextResponse.json(users)
  } catch (err) {
    console.error('GET /api/team/users error:', err)
    return NextResponse.json({ error: 'Failed to fetch team users' }, { status: 500 })
  }
}
