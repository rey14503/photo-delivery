import { describe, it, expect, beforeAll } from 'vitest'
import { unlockToken, isUnlocked } from '@/lib/album-unlock'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret'
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
