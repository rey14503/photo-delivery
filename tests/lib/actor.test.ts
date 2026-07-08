import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
})

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { resolveActor, actorKeyFor } from '@/lib/actor'
import { unlockToken } from '@/lib/album-unlock'

function mockCookieStore(values: Record<string, string>) {
  return {
    get: (name: string) => (values[name] ? { value: values[name] } : undefined),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

describe('resolveActor', () => {
  it('returns a PHOTOGRAPHER actor when the session user can manage the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: null })

    expect(actor).toEqual({ type: 'PHOTOGRAPHER', userId: 'user_1' })
  })

  it('falls back to CLIENT when the session user cannot manage the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_2', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(cookies).mockResolvedValue(mockCookieStore({ client_name: 'Jane Doe' }) as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: null })

    expect(actor).toEqual({ type: 'CLIENT', name: 'Jane Doe' })
  })

  it('returns null for a visitor with no session and no name cookie', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(cookies).mockResolvedValue(mockCookieStore({}) as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: null })

    expect(actor).toBeNull()
  })

  it('returns null for a client with a name cookie but no valid unlock cookie on a password-protected album', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(cookies).mockResolvedValue(mockCookieStore({ client_name: 'Jane Doe' }) as never)

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: 'hashed' })

    expect(actor).toBeNull()
  })

  it('returns a CLIENT actor for a password-protected album with a valid unlock cookie', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(cookies).mockResolvedValue(
      mockCookieStore({
        client_name: 'Jane Doe',
        album_unlock_album_1: unlockToken('album_1'),
      }) as never
    )

    const actor = await resolveActor({ id: 'album_1', ownerId: 'user_1', passwordHash: 'hashed' })

    expect(actor).toEqual({ type: 'CLIENT', name: 'Jane Doe' })
  })
})

describe('actorKeyFor', () => {
  it('builds a key for a photographer actor', () => {
    expect(actorKeyFor({ type: 'PHOTOGRAPHER', userId: 'user_1' })).toBe('photographer:user_1')
  })

  it('builds a key for a client actor', () => {
    expect(actorKeyFor({ type: 'CLIENT', name: 'Jane Doe' })).toBe('client:Jane Doe')
  })
})
