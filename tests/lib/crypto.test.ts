import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt } from '@/lib/crypto'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = '0'.repeat(64)
})

describe('crypto', () => {
  it('decrypts what it encrypts', () => {
    const plain = 'my-refresh-token'
    const cipherText = encrypt(plain)
    expect(decrypt(cipherText)).toBe(plain)
  })

  it('produces different ciphertext for repeated calls on the same input', () => {
    const plain = 'same-input'
    const a = encrypt(plain)
    const b = encrypt(plain)
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(plain)
    expect(decrypt(b)).toBe(plain)
  })

  it('throws clear error for non-hex characters in ENCRYPTION_KEY', () => {
    const originalKey = process.env.ENCRYPTION_KEY
    try {
      process.env.ENCRYPTION_KEY = 'z' + '0'.repeat(63)
      expect(() => encrypt('anything')).toThrow('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    } finally {
      process.env.ENCRYPTION_KEY = originalKey
    }
  })
})
