import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { getDriveClientForUser } from '@/lib/drive'
import { deleteAlbumIfDriveFolderGone } from '@/lib/album-lifecycle'
import { UploadPhotos } from '@/components/UploadPhotos'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'
import { DownloadToggle } from '@/components/DownloadToggle'
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
      owner: { select: { encryptedRefreshToken: true } },
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

  const drive = getDriveClientForUser(album.owner)
  const wasDeleted = await deleteAlbumIfDriveFolderGone(drive, {
    id: album.id,
    driveFolderId: album.driveFolderId,
  })
  if (wasDeleted) {
    return (
      <main className={styles.fallbackContainer}>
        <div className={styles.fallbackCard}>
          <h1 className={styles.fallbackTitle}>This album is no longer available</h1>
          <p className={styles.fallbackText}>
            Its Google Drive folder was deleted or is inaccessible, so the album has been removed.
          </p>
          <Link href="/albums" className={styles.fallbackLink}>
            ← Back to your albums
          </Link>
        </div>
      </main>
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
    shareToken: album.shareToken,
    location: 'Đà Lạt Studio',
    date: new Date(album.createdAt).toLocaleDateString('vi-VN'),
  }

  return (
    <main className={styles.page}>
      {/* 1. Photographer Gallery Header Banner, Search/Filter Toolbar, and Photo Cards */}
      <PhotographerGallery photos={photos} albumInfo={albumInfo} />

      {/* 2. Management Controls Section matching AI Studio Studio Settings */}
      <div>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>⚙️ Album Management & Security Settings</h3>
            <p className={styles.sectionSub}>
              Configure client portal permissions, password verification, and upload high-resolution delivery batches.
            </p>
          </div>
        </div>
        <div className={styles.controlsGrid} style={{ marginTop: 16 }}>
          <SetAlbumPassword albumId={album.id} hasPassword={Boolean(album.passwordHash)} />
          <DownloadToggle albumId={album.id} downloadEnabled={album.downloadEnabled} />
          <UploadPhotos albumId={album.id} />
        </div>
      </div>
    </main>
  )
}
