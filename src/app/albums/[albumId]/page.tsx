import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'
import { DownloadToggle } from '@/components/DownloadToggle'
import { PhotographerGallery } from '@/components/PhotographerGallery'

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const { albumId } = await params
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: {
      photos: {
        orderBy: { displayOrder: 'asc' },
        include: {
          likes: true,
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  })
  if (!album || !canManageAlbum(session.user, album)) {
    notFound()
  }

  const photos = album.photos.map((photo) => {
    const suggestedByMe = photo.likes.some(
      (like) => like.actorType === 'PHOTOGRAPHER' && like.userId === session.user.id
    )
    const clientLikers = photo.likes
      .filter((like) => like.actorType === 'CLIENT')
      .map((like) => like.actorName)
      .filter((name): name is string => Boolean(name))
    const comments = photo.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      authorLabel:
        comment.actorName ?? comment.user?.name ?? comment.user?.email ?? 'Photographer',
    }))

    return {
      id: photo.id,
      thumbnailUrl: photo.thumbnailUrl,
      previewUrl: photo.previewUrl,
      version: photo.version,
      suggestedByMe,
      clientLikers,
      comments,
    }
  })

  return (
    <main>
      <h1>
        {album.name} — {album.clientName}
      </h1>
      <p>
        Share link: <code>/a/{album.shareToken}</code>
      </p>
      <SetAlbumPassword albumId={album.id} hasPassword={Boolean(album.passwordHash)} />
      <DownloadToggle albumId={album.id} downloadEnabled={album.downloadEnabled} />
      <UploadPhotos albumId={album.id} />
      <PhotographerGallery photos={photos} />
    </main>
  )
}
