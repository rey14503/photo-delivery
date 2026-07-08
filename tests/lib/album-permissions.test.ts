import { describe, it, expect } from 'vitest'
import { canManageAlbum } from '@/lib/album-permissions'

describe('canManageAlbum', () => {
  it('allows an ADMIN regardless of ownership', () => {
    const user = { id: 'admin_1', role: 'ADMIN' as const }
    const album = { ownerId: 'someone_else' }
    expect(canManageAlbum(user, album)).toBe(true)
  })

  it('allows a PHOTOGRAPHER who owns the album', () => {
    const user = { id: 'user_1', role: 'PHOTOGRAPHER' as const }
    const album = { ownerId: 'user_1' }
    expect(canManageAlbum(user, album)).toBe(true)
  })

  it('denies a PHOTOGRAPHER who does not own the album', () => {
    const user = { id: 'user_1', role: 'PHOTOGRAPHER' as const }
    const album = { ownerId: 'someone_else' }
    expect(canManageAlbum(user, album)).toBe(false)
  })
})
