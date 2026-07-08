import { describe, it, expect, beforeAll } from 'vitest'
import { unlockToken, isUnlocked, albumUnlockCookieName } from '@/lib/album-unlock'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

describe('albumUnlockCookieName', () => {
  it('builds the cookie name for an album id', () => {
    expect(albumUnlockCookieName('album_1')).toBe('album_unlock_album_1')
  })
})

describe('unlockToken', () => {
  it('is deterministic for the same album id', () => {
    expect(unlockToken('album_1')).toBe(unlockToken('album_1'))
  })

  it('differs between album ids', () => {
    expect(unlockToken('album_1')).not.toBe(unlockToken('album_2'))
  })
})

describe('isUnlocked', () => {
  it('returns true when the cookie value matches the token', () => {
    expect(isUnlocked('album_1', unlockToken('album_1'))).toBe(true)
  })

  it('returns false when the cookie value does not match', () => {
    expect(isUnlocked('album_1', 'wrong-value')).toBe(false)
  })

  it('returns false when there is no cookie value', () => {
    expect(isUnlocked('album_1', undefined)).toBe(false)
  })
})
