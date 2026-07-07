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
})
