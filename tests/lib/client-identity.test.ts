import { describe, it, expect } from 'vitest'
import { CLIENT_NAME_COOKIE, isValidClientName } from '@/lib/client-identity'

describe('CLIENT_NAME_COOKIE', () => {
  it('is a non-empty cookie name', () => {
    expect(typeof CLIENT_NAME_COOKIE).toBe('string')
    expect(CLIENT_NAME_COOKIE.length).toBeGreaterThan(0)
  })
})

describe('isValidClientName', () => {
  it('accepts a short non-empty string', () => {
    expect(isValidClientName('Jane Doe')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidClientName('')).toBe(false)
  })

  it('rejects a whitespace-only string', () => {
    expect(isValidClientName('   ')).toBe(false)
  })

  it('rejects a string longer than 100 characters', () => {
    expect(isValidClientName('a'.repeat(101))).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidClientName(42)).toBe(false)
    expect(isValidClientName(null)).toBe(false)
    expect(isValidClientName(undefined)).toBe(false)
  })
})
