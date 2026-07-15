import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { albumUnlockCookieName, isUnlocked } from '@/lib/album-unlock'
import { CLIENT_NAME_COOKIE } from '@/lib/client-identity'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { PasswordGate } from '@/components/PasswordGate'
import { NameGate } from '@/components/NameGate'
import { ClientGallery } from '@/components/ClientGallery'
import styles from '../../albums/[albumId]/page.module.css'

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params
  const album = await prisma.album.findUnique({
    where: { shareToken },
    include: {
      owner: { select: { name: true } },
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
  if (!album) {
    notFound()
  }

  const cookieStore = await cookies()

  if (album.passwordHash) {
    const unlockCookie = cookieStore.get(albumUnlockCookieName(album.id))?.value
    if (!isUnlocked(album.id, unlockCookie)) {
      return <PasswordGate shareToken={shareToken} />
    }
  }

  const nameCookie = cookieStore.get(CLIENT_NAME_COOKIE)?.value
  if (!nameCookie) {
    return <NameGate />
  }

  const actor = await resolveActor(album)
  const myActorKey = actor ? actorKeyFor(actor) : null
  const canDownload = actor
    ? actor.type === 'PHOTOGRAPHER' || album.downloadEnabled
    : false

  const photos = album.photos.map((photo) => ({
    id: photo.id,
    thumbnailUrl: photo.thumbnailUrl,
    previewUrl: photo.previewUrl,
    name: photo.originalName ?? undefined,
    version: photo.version,
    likedByMe: myActorKey ? photo.likes.some((like) => like.actorKey === myActorKey) : false,
    suggestedByPhotographer: photo.likes.some((like) => like.actorType === 'PHOTOGRAPHER'),
    comments: photo.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      authorLabel:
        comment.actorName ?? comment.user?.name ?? comment.user?.email ?? 'Photographer',
    })),
  }))

  const albumInfo = {
    title: album.name,
    clientActorName: nameCookie,
    photographerName: album.owner.name ?? undefined,
    location: 'Studio',
    date: new Date(album.createdAt).toLocaleDateString('vi-VN'),
  }

  return (
    <main className={styles.page}>
      <ClientGallery photos={photos} canDownload={canDownload} albumId={album.id} shareToken={shareToken} albumInfo={albumInfo} selectionLocked={album.selectionLocked} selectionLimit={album.selectionLimit ?? 0} />
    </main>
  )
}
