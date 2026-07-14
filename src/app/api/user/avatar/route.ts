import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadToBlob } from '@/lib/blob-storage'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file') as Blob | null
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Missing file upload' }, { status: 400 })
    }

    const fileType = file.type || 'image/jpeg'
    if (!fileType.startsWith('image/')) {
      return NextResponse.json({ error: 'Uploaded file must be an image' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const blobPath = `avatars/${session.user.id}/avatar-${Date.now()}.jpg`

    const avatarUrl = await uploadToBlob(blobPath, buffer, fileType)

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
      select: { avatarUrl: true },
    })

    return NextResponse.json({ avatarUrl: updated.avatarUrl })
  } catch (err) {
    console.error('POST /api/user/avatar error:', err)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}
