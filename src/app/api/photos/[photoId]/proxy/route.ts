import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, downloadOriginal } from '@/lib/drive'
import { processImage } from '@/lib/image-processing'
import { uploadToBlob } from '@/lib/blob-storage'

// In-memory TTL cache for Drive CDN URLs (TTL: 2 hours)
// Prevents flooding Google Drive API (`drive.files.get`) when loading 20 album cards or 900 photos simultaneously
const driveCdnCache = new Map<string, { thumbUrl: string; prevUrl: string; expiresAt: number }>()

// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<{ thumbUrl: string; prevUrl: string } | null>>()

interface ProxyPhoto {
  id: string
  driveFileId: string
  thumbnailUrl: string
}

async function serveOrRedirectCdn(photo: ProxyPhoto, type: string, targetCdnUrl: string) {
  try {
    const imgRes = await fetch(targetCdnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (imgRes.ok) {
      const buffer = await imgRes.arrayBuffer()

      if (!photo.thumbnailUrl.startsWith('http') || photo.thumbnailUrl.includes('/proxy')) {
        uploadToBlob(`drive-files/${photo.driveFileId}/v1/${type}.jpg`, Buffer.from(buffer), 'image/jpeg')
          .then((blobUrl) => {
            if (type === 'preview') {
              prisma.photo.update({ where: { id: photo.id }, data: { previewUrl: blobUrl } }).catch(() => {})
            } else {
              prisma.photo.update({ where: { id: photo.id }, data: { thumbnailUrl: blobUrl } }).catch(() => {})
            }
          })
          .catch(() => {})
      }

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      })
    }
  } catch (cdnFetchErr) {
    console.warn('Failed to stream from CDN, falling back to redirect:', cdnFetchErr)
  }

  return NextResponse.redirect(targetCdnUrl, { status: 302 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'thumb'
  const albumId = searchParams.get('albumId') || undefined

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

  // If already uploaded to Blob storage, fetch server-side and stream back
  // (Blob URLs may return 403 on direct browser access due to Vercel access policies)
  if (currentUrl && currentUrl.startsWith('http') && !currentUrl.includes('/proxy')) {
    try {
      const blobRes = await fetch(currentUrl)
      if (blobRes.ok) {
        const buffer = await blobRes.arrayBuffer()
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': blobRes.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
          },
        })
      }
    } catch {
      // Fall through to Drive CDN fallback below
    }
  }

  // Check in-memory Drive CDN cache before calling Google Drive API
  const cached = driveCdnCache.get(photo.driveFileId)
  if (cached && Date.now() < cached.expiresAt) {
    return await serveOrRedirectCdn(photo, type, type === 'preview' ? cached.prevUrl : cached.thumbUrl)
  }

  try {
    let fetchPromise = inFlightRequests.get(photo.driveFileId)
    if (!fetchPromise) {
      fetchPromise = (async () => {
        try {
          const drive = getDriveClientForUser(photo.album.owner)
          const fileMeta = await drive.files.get({
            fileId: photo.driveFileId,
            fields: 'thumbnailLink',
            supportsAllDrives: true,
          })

          if (fileMeta.data.thumbnailLink) {
            const thumbUrl = fileMeta.data.thumbnailLink.replace(/=s\d+.*$/, '=s600')
            const prevUrl = fileMeta.data.thumbnailLink.replace(/=s\d+.*$/, '=s1600')

            // Cache for 2 hours
            driveCdnCache.set(photo.driveFileId, {
              thumbUrl,
              prevUrl,
              expiresAt: Date.now() + 2 * 60 * 60 * 1000,
            })

            return { thumbUrl, prevUrl }
          }
          return null
        } finally {
          inFlightRequests.delete(photo.driveFileId)
        }
      })()
      inFlightRequests.set(photo.driveFileId, fetchPromise)
    }

    const cdnResult = await fetchPromise
    if (cdnResult) {
      return await serveOrRedirectCdn(photo, type, type === 'preview' ? cdnResult.prevUrl : cdnResult.thumbUrl)
    }

    // Fallback: download original, process with sharp, and upload to blob storage
    const drive = getDriveClientForUser(photo.album.owner)
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

    return new NextResponse(type === 'preview' ? preview : thumbnail, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (error) {
    console.error('Failed to proxy/process photo:', error)
    // If rate limit or error occurs but we have a stale cache entry, serve it as emergency fallback
    if (cached) {
      return await serveOrRedirectCdn(photo, type, type === 'preview' ? cached.prevUrl : cached.thumbUrl)
    }
    return new NextResponse('Error generating photo proxy', { status: 500 })
  }
}
