import { prisma } from './prisma'
import { encrypt } from './crypto'
import type { Role } from '@prisma/client'

export interface GoogleAccountInfo {
  refresh_token?: string | null
}

export async function upsertUserFromGoogleAccount(
  email: string,
  name: string | null | undefined,
  account: GoogleAccountInfo
): Promise<{ id: string; role: Role }> {
  const isRootOwner = Boolean(
    email &&
      (email === process.env.ADMIN_EMAIL ||
        email === process.env.OWNER_EMAIL ||
        email === 'khoanguyenfotk5@gmail.com')
  )
  const existing = await prisma.user.findUnique({ where: { email } })

  const data: { name?: string | null; role?: Role; encryptedRefreshToken?: string } = {
    name,
  }
  if (account.refresh_token) {
    data.encryptedRefreshToken = encrypt(account.refresh_token)
  }

  if (existing) {
    if (isRootOwner && existing.role !== 'OWNER') {
      data.role = 'OWNER'
    }
    const updated = await prisma.user.update({ where: { email }, data })
    return { id: updated.id, role: updated.role }
  }

  const createdRole: Role = isRootOwner ? 'OWNER' : 'PHOTOGRAPHER'
  const created = await prisma.user.create({
    data: {
      email,
      role: createdRole,
      ...data,
    },
  })
  return { id: created.id, role: created.role }
}
