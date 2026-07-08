import { createHmac, timingSafeEqual } from 'crypto'
import { requireEnv } from './env'

export function albumUnlockCookieName(albumId: string): string {
  return `album_unlock_${albumId}`
}

export function unlockToken(albumId: string): string {
  return createHmac('sha256', requireEnv('NEXTAUTH_SECRET')).update(albumId).digest('hex')
}

export function isUnlocked(albumId: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) {
    return false
  }
  const expected = unlockToken(albumId)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(cookieValue)
  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }
  return timingSafeEqual(expectedBuffer, actualBuffer)
}
