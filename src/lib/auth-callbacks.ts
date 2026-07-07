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
  const role: Role = email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'PHOTOGRAPHER'
  const existing = await prisma.user.findUnique({ where: { email } })

  const data: { name?: string | null; role: Role; encryptedRefreshToken?: string } = {
    name,
    role,
  }
  if (account.refresh_token) {
    data.encryptedRefreshToken = encrypt(account.refresh_token)
  }

  if (existing) {
    const updated = await prisma.user.update({ where: { email }, data })
    return { id: updated.id, role: updated.role }
  }

  const created = await prisma.user.create({ data: { email, ...data } })
  return { id: created.id, role: created.role }
}
