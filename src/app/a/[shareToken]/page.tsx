import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isUnlocked } from '@/lib/album-unlock'
import { CLIENT_NAME_COOKIE } from '@/lib/client-identity'
import { PasswordGate } from '@/components/PasswordGate'
import { NameGate } from '@/components/NameGate'
import { ClientGallery } from '@/components/ClientGallery'

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params
  const album = await prisma.album.findUnique({
    where: { shareToken },
    include: { photos: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!album) {
    notFound()
  }

  const cookieStore = await cookies()

  if (album.passwordHash) {
    const unlockCookie = cookieStore.get(`album_unlock_${album.id}`)?.value
    if (!isUnlocked(album.id, unlockCookie)) {
      return <PasswordGate shareToken={shareToken} />
    }
  }

  const nameCookie = cookieStore.get(CLIENT_NAME_COOKIE)?.value
  if (!nameCookie) {
    return <NameGate />
  }

  return (
    <main>
      <h1>{album.name}</h1>
      <ClientGallery photos={album.photos} />
    </main>
  )
}
