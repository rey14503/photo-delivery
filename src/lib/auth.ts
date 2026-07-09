import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'
import { requireEnv } from './env'
import { upsertUserFromGoogleAccount } from './auth-callbacks'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: requireEnv('GOOGLE_CLIENT_ID'),
      clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
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
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'ADMIN' | 'PHOTOGRAPHER'
      }
      return session
    },
  },
}
