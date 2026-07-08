import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { authOptions } from './auth'
import { canManageAlbum } from './album-permissions'
import { albumUnlockCookieName, isUnlocked } from './album-unlock'
import { CLIENT_NAME_COOKIE } from './client-identity'

export type Actor = { type: 'PHOTOGRAPHER'; userId: string } | { type: 'CLIENT'; name: string }

export async function resolveActor(album: {
  id: string
  ownerId: string
  passwordHash: string | null
}): Promise<Actor | null> {
  const session = await getServerSession(authOptions)
  if (session?.user && canManageAlbum(session.user, album)) {
    return { type: 'PHOTOGRAPHER', userId: session.user.id }
  }

  const cookieStore = await cookies()

  if (album.passwordHash) {
    const unlockCookie = cookieStore.get(albumUnlockCookieName(album.id))?.value
    if (!isUnlocked(album.id, unlockCookie)) {
      return null
    }
  }

  const name = cookieStore.get(CLIENT_NAME_COOKIE)?.value
  if (!name) {
    return null
  }
  return { type: 'CLIENT', name }
}

export function actorKeyFor(actor: Actor): string {
  return actor.type === 'PHOTOGRAPHER' ? `photographer:${actor.userId}` : `client:${actor.name}`
}
