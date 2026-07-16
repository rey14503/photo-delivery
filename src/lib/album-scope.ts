import type { Role } from '@prisma/client'

export function albumScopeFor(user: { id: string; role: Role }): { ownerId?: string } {
  return user.role === 'OWNER' || user.role === 'ADMIN' ? {} : { ownerId: user.id }
}
