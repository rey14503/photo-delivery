import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { albumScopeFor } from '@/lib/album-scope'
import { AlbumGrid } from '@/components/AlbumGrid'

export default async function AlbumsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { photos: true },
      },
    },
  })

  const formattedAlbums = albums.map((alb) => ({
    id: alb.id,
    name: alb.name,
    clientName: alb.clientName,
    shareToken: alb.shareToken,
    hasPassword: Boolean(alb.passwordHash),
    photoCount: alb._count.photos,
    createdAt: alb.createdAt,
  }))

  return (
    <AlbumGrid
      albums={formattedAlbums}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  )
}
