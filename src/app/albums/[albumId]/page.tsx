import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'

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
    include: { photos: { orderBy: { displayOrder: 'asc' } } },
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
        {album.photos.map((photo) => (
          <li key={photo.id}>
            <img src={photo.thumbnailUrl} alt="" width={200} />
            {photo.version > 1 && <span> v{photo.version}</span>}
            <ReplacePhotoButton photoId={photo.id} />
          </li>
        ))}
      </ul>
    </main>
  )
}
