import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { requireEnv } from './env'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = requireEnv('ENCRYPTION_KEY')
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, 12)
  const authTag = raw.subarray(12, 28)
  const ciphertext = raw.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
