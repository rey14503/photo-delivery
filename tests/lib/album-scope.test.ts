import { describe, it, expect } from 'vitest'
import { albumScopeFor } from '@/lib/album-scope'

describe('albumScopeFor', () => {
  it('returns an empty filter for an admin', () => {
    expect(albumScopeFor({ id: 'u1', role: 'ADMIN' })).toEqual({})
  })

  it('returns an ownerId filter for a photographer', () => {
    expect(albumScopeFor({ id: 'u1', role: 'PHOTOGRAPHER' })).toEqual({ ownerId: 'u1' })
  })
})
