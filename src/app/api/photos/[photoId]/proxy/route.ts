import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, downloadOriginal } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const type = request.nextUrl.searchParams.get('type') || 'thumb'
  const albumId = request.nextUrl.searchParams.get('albumId')

  // Find photo by id or by driveFileId
  const photo = await prisma.photo.findFirst({
    where: albumId
      ? { OR: [{ id: photoId }, { driveFileId: photoId }], albumId }
      : { OR: [{ id: photoId }, { driveFileId: photoId }] },
    include: { album: { include: { owner: true } } },
  })

  if (!photo) {
    return new NextResponse('Photo not found', { status: 404 })
  }

  const currentUrl = type === 'preview' ? photo.previewUrl : photo.thumbnailUrl

  // If already a valid absolute URL (e.g. Vercel Blob / S3) that is NOT temporary Google Drive CDN, redirect directly
  const isPermanentBlob =
    currentUrl &&
    currentUrl.startsWith('http') &&
    !currentUrl.includes('googleusercontent.com') &&
    !currentUrl.includes('drive.google.com') &&
    !currentUrl.includes('/proxy')

  if (isPermanentBlob) {
    return NextResponse.redirect(currentUrl, { status: 302 })
  }

  try {
    const drive = getDriveClientForUser(photo.album.owner)

    // Try checking drive file thumbnailLink first
    const fileMeta = await drive.files.get({
      fileId: photo.driveFileId,
      fields: 'thumbnailLink',
      supportsAllDrives: true,
    })

    if (fileMeta.data.thumbnailLink) {
      const thumbUrl = fileMeta.data.thumbnailLink.replace(/=s\d+.*$/, '=s600')
      const prevUrl = fileMeta.data.thumbnailLink.replace(/=s\d+.*$/, '=s1600')

      // Return a 302 redirect to the fresh, non-expired Drive CDN URL
      // Note: We intentionally do NOT save googleusercontent URLs into the database because Drive CDN tokens expire after several hours.
      return NextResponse.redirect(type === 'preview' ? prevUrl : thumbUrl, { status: 302 })
    }

    // Fallback: download original, process with sharp, and upload to blob storage
    const { buffer } = await downloadOriginal(drive, photo.driveFileId)
    const { thumbnail, preview } = await processImage(buffer)

    const [thumbnailUrl, previewUrl] = await Promise.all([
      uploadToBlob(`drive-files/${photo.driveFileId}/v1/thumb.jpg`, thumbnail, 'image/jpeg'),
      uploadToBlob(`drive-files/${photo.driveFileId}/v1/preview.jpg`, preview, 'image/jpeg'),
    ])

    await prisma.photo.update({
      where: { id: photo.id },
      data: { thumbnailUrl, previewUrl },
    })

    return NextResponse.redirect(type === 'preview' ? previewUrl : thumbnailUrl, { status: 302 })
  } catch (error) {
    console.error('Failed to proxy/process photo:', error)
    return new NextResponse('Error generating photo proxy', { status: 500 })
  }
}
