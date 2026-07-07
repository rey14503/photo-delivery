import { describe, it, expect, afterEach } from 'vitest'
import { requireEnv } from '@/lib/env'

describe('requireEnv', () => {
  const KEY = 'TEST_ONLY_ENV_VAR'

  afterEach(() => {
    delete process.env[KEY]
  })

  it('returns the value when the variable is set', () => {
    process.env[KEY] = 'hello'
    expect(requireEnv(KEY)).toBe('hello')
  })

  it('throws when the variable is missing', () => {
    expect(() => requireEnv(KEY)).toThrow(
      'Missing required environment variable: TEST_ONLY_ENV_VAR'
    )
  })
})
