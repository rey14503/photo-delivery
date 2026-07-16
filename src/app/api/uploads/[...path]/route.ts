import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathParams } = await params
    const filePath = path.join(process.cwd(), 'public', 'uploads', ...pathParams)
    
    // Prevent directory traversal
    const normalizedPath = path.normalize(filePath)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    
    if (!normalizedPath.startsWith(uploadsDir)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const file = await fs.readFile(normalizedPath)
    const ext = path.extname(normalizedPath).toLowerCase()
    
    let contentType = 'application/octet-stream'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.svg') contentType = 'image/svg+xml'

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    return new NextResponse('File not found', { status: 404 })
  }
}
