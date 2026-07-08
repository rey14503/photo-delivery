import { createHmac } from 'crypto'
import { requireEnv } from './env'

export function unlockToken(albumId: string): string {
  return createHmac('sha256', requireEnv('NEXTAUTH_SECRET')).update(albumId).digest('hex')
}

export function isUnlocked(albumId: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) {
    return false
  }
  return cookieValue === unlockToken(albumId)
}
