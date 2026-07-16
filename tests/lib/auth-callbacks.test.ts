import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { upsertUserFromGoogleAccount } from '@/lib/auth-callbacks'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

beforeAll(() => {
  process.env.ENCRYPTION_KEY = '0'.repeat(64)
  process.env.ADMIN_EMAIL = 'admin@example.com'
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('upsertUserFromGoogleAccount', () => {
  it('creates a new photographer user with an encrypted refresh token', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user_1',
      email: 'photog@example.com',
      role: 'PHOTOGRAPHER',
    } as never)

    const result = await upsertUserFromGoogleAccount('photog@example.com', 'Photog', {
      refresh_token: 'raw-refresh-token',
    })

    expect(result).toEqual({ id: 'user_1', role: 'PHOTOGRAPHER' })
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0] as {
      data: { email: string; role: string; encryptedRefreshToken?: string }
    }
    expect(createArgs.data.email).toBe('photog@example.com')
    expect(createArgs.data.role).toBe('PHOTOGRAPHER')
    expect(createArgs.data.encryptedRefreshToken).toBeDefined()
    expect(createArgs.data.encryptedRefreshToken).not.toBe('raw-refresh-token')
  })

  it('assigns OWNER role when the email matches ADMIN_EMAIL', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user_2',
      email: 'admin@example.com',
      role: 'OWNER',
    } as never)

    const result = await upsertUserFromGoogleAccount('admin@example.com', 'Admin', {
      refresh_token: 'raw-token',
    })

    expect(result.role).toBe('OWNER')
  })

  it('keeps the existing refresh token when the account has none (repeat login)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      email: 'photog@example.com',
      role: 'PHOTOGRAPHER',
    } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user_1',
      email: 'photog@example.com',
      role: 'PHOTOGRAPHER',
    } as never)

    await upsertUserFromGoogleAccount('photog@example.com', 'Photog', {})

    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0][0] as {
      data: { encryptedRefreshToken?: string }
    }
    expect(updateArgs.data.encryptedRefreshToken).toBeUndefined()
  })
})
