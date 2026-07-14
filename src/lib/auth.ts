import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'
import { requireEnv } from './env'
import { upsertUserFromGoogleAccount } from './auth-callbacks'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false
      const { id, role } = await upsertUserFromGoogleAccount(user.email, user.name, account)
      ;(user as { id?: string; role?: string }).id = id
      ;(user as { id?: string; role?: string }).role = role
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id
        token.role = (user as { role?: 'ADMIN' | 'PHOTOGRAPHER' }).role
      }
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, avatarUrl: true, studioName: true },
          })
          if (dbUser) {
            token.name = dbUser.name ?? token.name
            token.avatarUrl = dbUser.avatarUrl
            token.studioName = dbUser.studioName
          }
        } catch {
          // Fallback if DB check fails during token generation
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'ADMIN' | 'PHOTOGRAPHER'
        session.user.name = token.name as string | null | undefined
        session.user.avatarUrl = token.avatarUrl as string | null | undefined
        session.user.studioName = token.studioName as string | null | undefined
      }
      return session
    },
  },
}
