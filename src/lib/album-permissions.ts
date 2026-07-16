import type { Role } from '@prisma/client'

export function canManageAlbum(
  user: { id: string; role: Role },
  album: { ownerId: string }
): boolean {
  return user.role === 'OWNER' || user.role === 'ADMIN' || album.ownerId === user.id
}
