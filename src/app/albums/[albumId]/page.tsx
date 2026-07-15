import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { getDriveClientForUser } from '@/lib/drive'
import { deleteAlbumIfDriveFolderGone } from '@/lib/album-lifecycle'
import { TopNav } from '@/components/TopNav'
import { PhotographerGallery } from '@/components/PhotographerGallery'
import styles from './page.module.css'

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
      owner: { select: { name: true, email: true, encryptedRefreshToken: true } },
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

  let wasDeleted = false
  try {
    const drive = getDriveClientForUser(album.owner)
    wasDeleted = await deleteAlbumIfDriveFolderGone(drive, {
      id: album.id,
      driveFolderId: album.driveFolderId,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[page.tsx] Warning: Could not check Drive folder status for album:', album.id, {
      message: errMsg,
    })
  }
  if (wasDeleted) {
    return (
      <div className={styles.fallbackContainer}>
        <div className={styles.fallbackCard}>
          <h2 className={styles.fallbackTitle}>Album no longer available</h2>
          <p className={styles.fallbackText}>
            The linked Google Drive folder has been deleted or is no longer accessible.
          </p>
          <Link href="/albums" className={styles.fallbackLink}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
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
      name: photo.originalName ?? undefined,
      version: photo.version,
      suggestedByMe,
      clientLikers,
      comments,
    }
  })

  const albumInfo = {
    id: album.id,
    name: album.name,
    clientName: album.clientName,
    photographerName: album.owner?.name ?? album.owner?.email ?? 'Photographer',
    shareToken: album.shareToken,
    date: new Date(album.createdAt).toLocaleDateString('vi-VN'),
    downloadEnabled: album.downloadEnabled,
    hasPassword: Boolean(album.passwordHash),
    coverPhotoId: album.coverPhotoId ?? null,
    selectionLocked: album.selectionLocked,
    selectionLimit: album.selectionLimit ?? 0,
  }

  return (
    <>
      <TopNav
        userName={session.user.name}
        userEmail={session.user.email}
        avatarUrl={session.user.avatarUrl}
        studioName={session.user.studioName}
        role={session.user.role}
      />
      <main className={styles.page}>
        {/* Photographer Gallery with Integrated Top Management Controls & Share Modal */}
        <PhotographerGallery photos={photos} albumInfo={albumInfo} selectionLocked={album.selectionLocked} />
      </main>
    </>
  )
}
