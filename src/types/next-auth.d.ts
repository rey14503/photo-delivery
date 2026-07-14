import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'ADMIN' | 'PHOTOGRAPHER'
      avatarUrl?: string | null
      studioName?: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'ADMIN' | 'PHOTOGRAPHER'
    avatarUrl?: string | null
    studioName?: string | null
  }
}
