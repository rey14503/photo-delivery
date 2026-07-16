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

    const fileType = file.type || 'image/png'
    if (!fileType.startsWith('image/')) {
      return NextResponse.json({ error: 'Uploaded file must be an image' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = fileType.includes('png') ? 'png' : 'jpg'
    const blobPath = `qrcodes/${session.user.id}/qr-${Date.now()}.${ext}`

    let qrCodeUrl = await uploadToBlob(blobPath, buffer, fileType)
    if (!qrCodeUrl) {
      try {
        const fs = await import('fs/promises')
        const path = await import('path')
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'qrcodes')
        await fs.mkdir(uploadDir, { recursive: true })
        const filename = `qr-${session.user.id}-${Date.now()}.${ext}`
        await fs.writeFile(path.join(uploadDir, filename), buffer)
        qrCodeUrl = `/uploads/qrcodes/${filename}`
      } catch {
        qrCodeUrl = `data:${fileType};base64,${buffer.toString('base64')}`
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { qrCodeUrl },
      select: { qrCodeUrl: true },
    })

    return NextResponse.json({ qrCodeUrl: updated.qrCodeUrl })
  } catch (err) {
    console.error('POST /api/user/qrcode error:', err)
    return NextResponse.json({ error: 'Failed to upload QR code' }, { status: 500 })
  }
}
