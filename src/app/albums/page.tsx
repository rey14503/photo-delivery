import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { albumScopeFor } from '@/lib/album-scope'
import { AlbumGrid } from '@/components/AlbumGrid'

export default async function AlbumsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
    include: {
      photos: {
        take: 20,
        orderBy: { displayOrder: 'asc' },
        select: { id: true, thumbnailUrl: true, previewUrl: true, originalName: true },
      },
      coverPhoto: {
        select: { id: true, thumbnailUrl: true, previewUrl: true, originalName: true },
      },
      _count: {
        select: { photos: true },
      },
      owner: {
        select: { name: true },
      },
    },
  })

  const formattedAlbums = albums.map((alb) => {
    const coverPhotoObj = alb.coverPhoto || alb.photos.find((p) => p.id === alb.coverPhotoId) || alb.photos[0]
    return {
      id: alb.id,
      name: alb.name,
      clientName: alb.clientName,
      photographerName: alb.owner?.name || session.user.name || 'Photographer',
      shareToken: alb.shareToken,
      hasPassword: Boolean(alb.passwordHash),
      photoCount: alb._count.photos,
      createdAt: alb.createdAt,
      downloadEnabled: alb.downloadEnabled,
      coverUrl: coverPhotoObj?.thumbnailUrl || coverPhotoObj?.previewUrl || null,
      coverPhotoId: alb.coverPhotoId || null,
      samplePhotos: alb.photos.map((p) => ({
        id: p.id,
        name: p.originalName || p.id,
        url: p.thumbnailUrl || p.previewUrl || '',
      })),
    }
  })

  return (
    <AlbumGrid
      albums={formattedAlbums}
      userName={session.user.name}
      userEmail={session.user.email}
      avatarUrl={session.user.avatarUrl}
      studioName={session.user.studioName}
    />
  )
}
