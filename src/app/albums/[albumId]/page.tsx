import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'
import { LikeButton } from '@/components/LikeButton'
import { CommentThread } from '@/components/CommentThread'

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

  return (
    <main>
      <h1>
        {album.name} — {album.clientName}
      </h1>
      <p>
        Share link: <code>/a/{album.shareToken}</code>
      </p>
      <SetAlbumPassword albumId={album.id} hasPassword={Boolean(album.passwordHash)} />
      <UploadPhotos albumId={album.id} />
      <ul>
        {album.photos.map((photo) => {
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

          return (
            <li key={photo.id}>
              <img src={photo.thumbnailUrl} alt="" width={200} />
              {photo.version > 1 && <span> v{photo.version}</span>}
              <ReplacePhotoButton photoId={photo.id} />
              <LikeButton
                photoId={photo.id}
                liked={suggestedByMe}
                label="⭐ Suggest to client"
              />
              {clientLikers.length > 0 && <p>❤ Selected by: {clientLikers.join(', ')}</p>}
              <CommentThread photoId={photo.id} comments={comments} />
            </li>
          )
        })}
      </ul>
    </main>
  )
}
