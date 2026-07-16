import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const profileSelect = {
  name: true,
  studioName: true,
  role: true,
  avatarUrl: true,
  email: true,
  phone: true,
  facebookUrl: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountName: true,
  qrCodeUrl: true,
} as const

const optionalStringFields = [
  'phone',
  'facebookUrl',
  'bankName',
  'bankAccountNumber',
  'bankAccountName',
  'qrCodeUrl',
] as const

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: profileSelect,
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isRootOwner =
      user.role === 'OWNER' ||
      user.email === process.env.ADMIN_EMAIL ||
      user.email === process.env.OWNER_EMAIL ||
      user.email === 'khoanguyenfotk5@gmail.com'

    return NextResponse.json({
      name: user.name,
      studioName: user.studioName,
      role: isRootOwner ? 'OWNER' : user.role,
      avatarUrl: user.avatarUrl,
      email: user.email,
      phone: user.phone,
      facebookUrl: user.facebookUrl,
      bankName: user.bankName,
      bankAccountNumber: user.bankAccountNumber,
      bankAccountName: user.bankAccountName,
      qrCodeUrl: user.qrCodeUrl,
    })
  } catch (err) {
    console.error('GET /api/user/profile error:', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

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

    const b = body as Record<string, unknown>
    const name = (b.name as string).trim()
    const studioName = (b.studioName as string).trim()

    const data: Record<string, string> = { name, studioName }
    for (const field of optionalStringFields) {
      if (typeof b[field] === 'string') {
        data[field] = (b[field] as string).trim()
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: profileSelect,
    })

    const isRootOwner =
      updated.role === 'OWNER' ||
      updated.email === process.env.ADMIN_EMAIL ||
      updated.email === process.env.OWNER_EMAIL ||
      updated.email === 'khoanguyenfotk5@gmail.com'

    return NextResponse.json({
      name: updated.name,
      studioName: updated.studioName,
      role: isRootOwner ? 'OWNER' : updated.role,
      avatarUrl: updated.avatarUrl,
      phone: updated.phone,
      facebookUrl: updated.facebookUrl,
      bankName: updated.bankName,
      bankAccountNumber: updated.bankAccountNumber,
      bankAccountName: updated.bankAccountName,
      qrCodeUrl: updated.qrCodeUrl,
    })
  } catch (err) {
    console.error('PUT /api/user/profile error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
