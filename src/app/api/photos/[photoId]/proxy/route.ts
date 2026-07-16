import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser } from '@/lib/drive'

// ---------------------------------------------------------------------------
// In-memory TTL cache for Google Drive CDN URLs
// Google Drive thumbnailLink URLs are temporary — they expire after a few hours.
// This cache prevents flooding the Drive API when loading 20+ album cards or
// 900+ photos simultaneously (one API call per unique driveFileId, not per request).
// ---------------------------------------------------------------------------
const driveCdnCache = new Map<string, { thumbUrl: string; prevUrl: string; expiresAt: number }>()

// In-flight request deduplication: if multiple requests arrive for the same
// driveFileId before the first one completes, they all share the same promise.
const inFlightRequests = new Map<string, Promise<{ thumbUrl: string; prevUrl: string } | null>>()

// Maximum size of the CDN cache before we evict old entries
const MAX_CACHE_SIZE = 5000

/** Evict expired entries (and oldest if over capacity) */
function evictStaleCache() {
  const now = Date.now()
  for (const [key, entry] of driveCdnCache) {
    if (now >= entry.expiresAt) driveCdnCache.delete(key)
  }
  // If still over capacity, delete oldest entries
  if (driveCdnCache.size > MAX_CACHE_SIZE) {
    const entries = [...driveCdnCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    const toDelete = entries.slice(0, driveCdnCache.size - MAX_CACHE_SIZE)
    for (const [key] of toDelete) driveCdnCache.delete(key)
  }
}

// Standard response headers for served images
const IMAGE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
}

/**
 * Fetch an image from a CDN URL and stream it back as a response.
 * Returns null if the fetch fails (caller should try next fallback).
 */
async function streamFromCdn(cdnUrl: string): Promise<NextResponse | null> {
  try {
    const res = await fetch(cdnUrl, {
      headers: {
        // Some CDNs block non-browser User-Agents
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15_000), // 15s timeout
    })
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/jpeg',
          ...IMAGE_HEADERS,
        },
      })
    }
  } catch {
    // Fetch failed or timed out — return null to trigger next fallback
  }
  return null
}

/**
 * Resolve Google Drive CDN URLs for a given driveFileId.
 * Uses in-memory cache + in-flight deduplication to minimize API calls.
 * Returns { thumbUrl, prevUrl } or null if Drive API fails.
 */
async function resolveDriveCdnUrls(
  driveFileId: string,
  owner: { encryptedRefreshToken: string | null }
): Promise<{ thumbUrl: string; prevUrl: string } | null> {
  // 1. Check in-memory cache
  const cached = driveCdnCache.get(driveFileId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached
  }

  // 2. Deduplicate in-flight requests
  let fetchPromise = inFlightRequests.get(driveFileId)
  if (fetchPromise) return fetchPromise

  // 3. Fetch from Google Drive API
  fetchPromise = (async (): Promise<{ thumbUrl: string; prevUrl: string } | null> => {
    try {
      const drive = getDriveClientForUser(owner)
      const fileMeta = await drive.files.get({
        fileId: driveFileId,
        fields: 'thumbnailLink',
        supportsAllDrives: true,
      })

      if (!fileMeta.data.thumbnailLink) return null

      const thumbUrl = fileMeta.data.thumbnailLink.replace(/=s\d+.*$/, '=s600')
      const prevUrl = fileMeta.data.thumbnailLink.replace(/=s\d+.*$/, '=s1600')

      const entry = { thumbUrl, prevUrl, expiresAt: Date.now() + 2 * 60 * 60 * 1000 }
      driveCdnCache.set(driveFileId, entry)

      // Periodic eviction
      if (driveCdnCache.size > MAX_CACHE_SIZE) evictStaleCache()

      return entry
    } catch (error) {
      console.warn(`[proxy] Drive API error for ${driveFileId}:`, error instanceof Error ? error.message : error)
      return null
    } finally {
      inFlightRequests.delete(driveFileId)
    }
  })()

  inFlightRequests.set(driveFileId, fetchPromise)
  return fetchPromise
}

// ---------------------------------------------------------------------------
// GET /api/photos/[photoId]/proxy?type=thumb|preview&albumId=...
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { photoId } = await params
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'thumb'
  const albumId = searchParams.get('albumId') || undefined

  // 1. Find photo in database
  const photo = await prisma.photo.findFirst({
    where: albumId
      ? { OR: [{ id: photoId }, { driveFileId: photoId }], albumId }
      : { OR: [{ id: photoId }, { driveFileId: photoId }] },
    include: { album: { include: { owner: true } } },
  })

  if (!photo) {
    return new NextResponse('Photo not found', { status: 404 })
  }

  // 2. Try existing Blob/external URL (may work if store is reactivated)
  const currentUrl = type === 'preview' ? photo.previewUrl : photo.thumbnailUrl
  if (currentUrl && currentUrl.startsWith('http') && !currentUrl.includes('/proxy')) {
    const response = await streamFromCdn(currentUrl)
    if (response) return response
    // Blob failed (403/suspended) — fall through to Drive CDN
  }

  // 3. Resolve & stream from Google Drive CDN (primary path)
  const cdnUrls = await resolveDriveCdnUrls(photo.driveFileId, photo.album.owner)
  if (cdnUrls) {
    const targetUrl = type === 'preview' ? cdnUrls.prevUrl : cdnUrls.thumbUrl
    const response = await streamFromCdn(targetUrl)
    if (response) return response
  }

  // 4. Emergency fallback: use stale cache entry if available
  const staleEntry = driveCdnCache.get(photo.driveFileId)
  if (staleEntry) {
    const targetUrl = type === 'preview' ? staleEntry.prevUrl : staleEntry.thumbUrl
    const response = await streamFromCdn(targetUrl)
    if (response) return response
  }

  // 5. All paths failed
  console.error(`[proxy] All fallbacks failed for photo ${photo.id} (drive: ${photo.driveFileId})`)
  return new NextResponse('Unable to load image', { status: 502 })
}
