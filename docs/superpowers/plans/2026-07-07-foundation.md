# Foundation (Plan 1 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js app, database, and Google login so a photographer can sign in with Google and creating an album produces a real folder (with a nested `Selected` subfolder) in that photographer's own Google Drive.

**Architecture:** Next.js App Router + TypeScript on Vercel; Postgres via Prisma; NextAuth.js (Google provider, `drive.file` scope) doubles as both login and Drive connection; a small Drive service wraps the `googleapis` SDK for folder creation; refresh tokens are AES-256-GCM encrypted at rest.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, next-auth 4, Prisma 5 + PostgreSQL, googleapis, Vitest + Testing Library.

## Global Constraints

- Single-tenant: one shared `User` table for Admin/Photographer roles, no per-studio scoping.
- Google OAuth scope is `drive.file` only — never request broader Drive access.
- Refresh tokens must be stored encrypted (AES-256-GCM), never in plaintext.
- No watermarking, no email sending, no real-time/WebSocket infra — none of that appears anywhere in this plan.
- This plan produces no `Photo`, `Like`, or `Comment` tables — those belong to later plans (2 and 4).

---

## File Structure

```
photo-delivery/
├── .env.example
├── .eslintrc.json
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.mjs
├── vitest.config.ts
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── albums/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── albums/route.ts
│   ├── components/
│   │   └── CreateAlbumForm.tsx
│   ├── lib/
│   │   ├── env.ts
│   │   ├── prisma.ts
│   │   ├── crypto.ts
│   │   ├── auth-callbacks.ts
│   │   ├── auth.ts
│   │   └── drive.ts
│   └── types/
│       └── next-auth.d.ts
└── tests/
    ├── setup.ts
    ├── lib/
    │   ├── env.test.ts
    │   ├── crypto.test.ts
    │   ├── auth-callbacks.test.ts
    │   └── drive.test.ts
    ├── api/
    │   └── albums.test.ts
    └── components/
        └── CreateAlbumForm.test.tsx
```

---

### Task 1: Project scaffold + test runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `.gitignore`, `.env.example`
- Create: `vitest.config.ts`, `tests/setup.ts`
- Create: `src/lib/env.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (temporary placeholder, replaced in Task 7)
- Test: `tests/lib/env.test.ts`

**Interfaces:**
- Produces: `requireEnv(name: string): string` — reads `process.env[name]`, throws `Error("Missing required environment variable: <name>")` if unset. Used by every later task that needs an env var (crypto, auth, drive).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "photo-delivery",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "next-auth": "4.24.10",
    "@prisma/client": "5.22.0",
    "googleapis": "144.0.0"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "@types/node": "22.9.0",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.2",
    "prisma": "5.22.0",
    "vitest": "2.1.4",
    "@vitejs/plugin-react": "4.3.3",
    "jsdom": "25.0.1",
    "@testing-library/react": "16.0.1",
    "@testing-library/jest-dom": "6.6.3",
    "eslint": "8.57.1",
    "eslint-config-next": "15.1.0"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules
.next
.env
.env.local
*.log
```

- [ ] **Step 3: Write `.env.example`**

```
DATABASE_URL="postgresql://user:password@host:5432/photo_delivery"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
ENCRYPTION_KEY="generate-64-hex-chars-with-openssl-rand-hex-32"
ADMIN_EMAIL="you@example.com"
```

- [ ] **Step 4: Write `.eslintrc.json`**

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}

export default nextConfig
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `package-lock.json`.

- [ ] **Step 8: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 9: Write `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 10: Write the failing test for `requireEnv`**

`tests/lib/env.test.ts`:

```ts
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
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: FAIL — cannot find module `@/lib/env`.

- [ ] **Step 12: Write `src/lib/env.ts`**

```ts
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 14: Write placeholder app shell**

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Photo Delivery',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`src/app/page.tsx` (temporary — replaced in Task 7 with the real sign-in redirect):

```tsx
export default function HomePage() {
  return <p>Photo Delivery — scaffold OK</p>
}
```

- [ ] **Step 15: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors.

- [ ] **Step 16: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs .eslintrc.json .gitignore .env.example vitest.config.ts tests/setup.ts tests/lib/env.test.ts src/lib/env.ts src/app/layout.tsx src/app/page.tsx
git commit -m "Scaffold Next.js app with Vitest and requireEnv helper"
```

---

### Task 2: Database schema (User, Album) + Prisma client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly (independent of `requireEnv`; Prisma reads `DATABASE_URL` itself via `env()` in the schema).
- Produces: `prisma: PrismaClient` singleton, plus generated Prisma types `User`, `Album`, `Role` (`'ADMIN' | 'PHOTOGRAPHER'`) consumed by Tasks 4, 5, 6.

This task has no unit test — a schema/migration is verified by successfully running `prisma migrate dev` against a real database, not by a Vitest assertion.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  PHOTOGRAPHER
}

model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  role                  Role     @default(PHOTOGRAPHER)
  encryptedRefreshToken String?
  driveRootFolderId     String?
  createdAt             DateTime @default(now())
  albums                Album[]
}

model Album {
  id               String   @id @default(cuid())
  name             String
  clientName       String
  ownerId          String
  owner            User     @relation(fields: [ownerId], references: [id])
  driveFolderId    String
  selectedFolderId String
  shareToken       String   @unique
  passwordHash     String?
  downloadEnabled  Boolean  @default(false)
  createdAt        DateTime @default(now())
}
```

- [ ] **Step 2: Fill in real environment values**

Copy `.env.example` to `.env.local`, then `.env` (Prisma CLI reads `.env`, Next.js reads `.env.local` — keep both in sync for local dev). Set a real `DATABASE_URL` from your Supabase or Neon project (found in their dashboard's "Connection string" section).

- [ ] **Step 3: Generate the Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 4: Run the initial migration**

Run: `npx prisma migrate dev --name init`
Expected: `Your database is now in sync with your schema.` — creates `prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 5: Write `src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 6: Verify the app still builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/prisma.ts
git commit -m "Add Prisma schema for User and Album, and Prisma client singleton"
```

(`.env` and `.env.local` are gitignored — do not add them.)

---

### Task 3: Refresh-token encryption

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `tests/lib/crypto.test.ts`

**Interfaces:**
- Consumes: `requireEnv` from `src/lib/env.ts` (Task 1).
- Produces: `encrypt(plainText: string): string`, `decrypt(payload: string): string`. Consumed by Task 4 (`auth-callbacks.ts`, encrypting) and Task 5 (`drive.ts`, decrypting).

- [ ] **Step 1: Write the failing test**

`tests/lib/crypto.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/crypto.test.ts`
Expected: FAIL — cannot find module `@/lib/crypto`.

- [ ] **Step 3: Write `src/lib/crypto.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/crypto.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts tests/lib/crypto.test.ts
git commit -m "Add AES-256-GCM encrypt/decrypt for Drive refresh tokens"
```

---

### Task 4: Google sign-in with `drive.file` scope

**Files:**
- Create: `src/lib/auth-callbacks.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/types/next-auth.d.ts`
- Test: `tests/lib/auth-callbacks.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `encrypt` (Task 3), `requireEnv` (Task 1).
- Produces: `upsertUserFromGoogleAccount(email: string, name: string | null | undefined, account: { refresh_token?: string | null }): Promise<{ id: string; role: Role }>` — consumed only internally by `auth.ts`'s `signIn` callback. `authOptions: NextAuthOptions`, consumed by Task 6 (`getServerSession(authOptions)`) and Task 7 (album pages).
- `Session.user` gains `id: string` and `role: 'ADMIN' | 'PHOTOGRAPHER'` (via module augmentation), consumed by every later task that reads `session.user.id` / `session.user.role`.

- [ ] **Step 1: Write the failing tests**

`tests/lib/auth-callbacks.test.ts`:

```ts
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

  it('assigns ADMIN role when the email matches ADMIN_EMAIL', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user_2',
      email: 'admin@example.com',
      role: 'ADMIN',
    } as never)

    const result = await upsertUserFromGoogleAccount('admin@example.com', 'Admin', {
      refresh_token: 'raw-token',
    })

    expect(result.role).toBe('ADMIN')
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/auth-callbacks.test.ts`
Expected: FAIL — cannot find module `@/lib/auth-callbacks`.

- [ ] **Step 3: Write `src/lib/auth-callbacks.ts`**

```ts
import { prisma } from './prisma'
import { encrypt } from './crypto'
import type { Role } from '@prisma/client'

export interface GoogleAccountInfo {
  refresh_token?: string | null
}

export async function upsertUserFromGoogleAccount(
  email: string,
  name: string | null | undefined,
  account: GoogleAccountInfo
): Promise<{ id: string; role: Role }> {
  const role: Role = email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'PHOTOGRAPHER'
  const existing = await prisma.user.findUnique({ where: { email } })

  const data: { name?: string | null; role: Role; encryptedRefreshToken?: string } = {
    name,
    role,
  }
  if (account.refresh_token) {
    data.encryptedRefreshToken = encrypt(account.refresh_token)
  }

  if (existing) {
    const updated = await prisma.user.update({ where: { email }, data })
    return { id: updated.id, role: updated.role }
  }

  const created = await prisma.user.create({ data: { email, ...data } })
  return { id: created.id, role: created.role }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/auth-callbacks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/types/next-auth.d.ts`**

```ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'ADMIN' | 'PHOTOGRAPHER'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'ADMIN' | 'PHOTOGRAPHER'
  }
}
```

- [ ] **Step 6: Write `src/lib/auth.ts`**

```ts
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
```

- [ ] **Step 7: Write `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

- [ ] **Step 8: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors (this exercises the `next-auth.d.ts` augmentation).

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth-callbacks.ts src/lib/auth.ts src/types/next-auth.d.ts src/app/api/auth tests/lib/auth-callbacks.test.ts
git commit -m "Add Google OAuth sign-in with drive.file scope and encrypted token storage"
```

**Note:** `authOptions` itself (the NextAuth config object) is not unit-tested directly — the callback logic it wires together is already covered via `upsertUserFromGoogleAccount`. The end-to-end sign-in flow is verified manually in Task 8.

---

### Task 5: Drive folder service

**Files:**
- Create: `src/lib/drive.ts`
- Test: `tests/lib/drive.test.ts`

**Interfaces:**
- Consumes: `requireEnv` (Task 1), `decrypt` (Task 3).
- Produces: `getDriveClientForUser(user: { encryptedRefreshToken: string | null }): drive_v3.Drive`, `createFolder(drive, name, parentId?): Promise<string>`, `createAlbumFolders(drive, albumName): Promise<{ albumFolderId: string; selectedFolderId: string }>` — all consumed by Task 6's album-creation API route.

- [ ] **Step 1: Write the failing tests**

`tests/lib/drive.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'

const filesCreate = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    drive: vi.fn().mockImplementation(() => ({
      files: { create: filesCreate },
    })),
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-refresh-token'),
}))

import { getDriveClientForUser, createFolder, createAlbumFolders } from '@/lib/drive'
import { google } from 'googleapis'

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
})

describe('getDriveClientForUser', () => {
  it('throws when the user has no refresh token', () => {
    expect(() => getDriveClientForUser({ encryptedRefreshToken: null })).toThrow(
      'User has no stored Drive refresh token'
    )
  })

  it('builds a Drive client from the decrypted refresh token', () => {
    getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })
    expect(google.drive).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3' }))
  })
})

describe('createFolder', () => {
  it('creates a folder with no parent', async () => {
    filesCreate.mockResolvedValue({ data: { id: 'folder_1' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await createFolder(drive, 'My Album')

    expect(id).toBe('folder_1')
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: { name: 'My Album', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    })
  })

  it('creates a folder nested under a parent', async () => {
    filesCreate.mockResolvedValue({ data: { id: 'folder_2' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const id = await createFolder(drive, 'Selected', 'folder_1')

    expect(id).toBe('folder_2')
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: {
        name: 'Selected',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['folder_1'],
      },
      fields: 'id',
    })
  })
})

describe('createAlbumFolders', () => {
  it('creates an album folder and a nested Selected folder', async () => {
    filesCreate
      .mockResolvedValueOnce({ data: { id: 'album_folder' } })
      .mockResolvedValueOnce({ data: { id: 'selected_folder' } })
    const drive = getDriveClientForUser({ encryptedRefreshToken: 'cipher-text' })

    const result = await createAlbumFolders(drive, 'Wedding Album')

    expect(result).toEqual({ albumFolderId: 'album_folder', selectedFolderId: 'selected_folder' })
    expect(filesCreate).toHaveBeenNthCalledWith(2, {
      requestBody: {
        name: 'Selected',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['album_folder'],
      },
      fields: 'id',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: FAIL — cannot find module `@/lib/drive`.

- [ ] **Step 3: Write `src/lib/drive.ts`**

```ts
import { google, drive_v3 } from 'googleapis'
import { decrypt } from './crypto'
import { requireEnv } from './env'

export interface DriveUser {
  encryptedRefreshToken: string | null
}

export function getDriveClientForUser(user: DriveUser): drive_v3.Drive {
  if (!user.encryptedRefreshToken) {
    throw new Error('User has no stored Drive refresh token')
  }
  const oauth2Client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET')
  )
  oauth2Client.setCredentials({ refresh_token: decrypt(user.encryptedRefreshToken) })
  return google.drive({ version: 'v3', auth: oauth2Client })
}

export async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  })
  if (!res.data.id) {
    throw new Error('Drive did not return a folder id')
  }
  return res.data.id
}

export interface AlbumFolders {
  albumFolderId: string
  selectedFolderId: string
}

export async function createAlbumFolders(
  drive: drive_v3.Drive,
  albumName: string
): Promise<AlbumFolders> {
  const albumFolderId = await createFolder(drive, albumName)
  const selectedFolderId = await createFolder(drive, 'Selected', albumFolderId)
  return { albumFolderId, selectedFolderId }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/drive.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.ts tests/lib/drive.test.ts
git commit -m "Add Drive folder service (album folder + nested Selected folder)"
```

---

### Task 6: Album creation & listing API

**Files:**
- Create: `src/app/api/albums/route.ts`
- Test: `tests/api/albums.test.ts`

**Interfaces:**
- Consumes: `authOptions` (Task 4), `prisma` (Task 2), `getDriveClientForUser` + `createAlbumFolders` (Task 5).
- Produces: `POST /api/albums` (body `{ name: string; clientName: string }` → `201` with the created `Album` row, or `401`/`400`/`404`), `GET /api/albums` (→ `200` with `Album[]`, filtered by owner unless role is `ADMIN`). Consumed by Task 7's UI.

- [ ] **Step 1: Write the failing tests**

`tests/api/albums.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    album: { create: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('@/lib/drive', () => ({
  getDriveClientForUser: vi.fn().mockReturnValue({ mockDrive: true }),
  createAlbumFolders: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { createAlbumFolders } from '@/lib/drive'
import { POST, GET } from '@/app/api/albums/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(jsonRequest({ name: 'Album', clientName: 'Client' }))

    expect(res.status).toBe(401)
  })

  it('returns 400 when name or clientName is missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)

    const res = await POST(jsonRequest({ name: 'Album' }))

    expect(res.status).toBe(400)
  })

  it('creates Drive folders and an Album row for a signed-in user', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      encryptedRefreshToken: 'cipher',
    } as never)
    vi.mocked(createAlbumFolders).mockResolvedValue({
      albumFolderId: 'folder_1',
      selectedFolderId: 'folder_2',
    })
    vi.mocked(prisma.album.create).mockResolvedValue({
      id: 'album_1',
      name: 'Wedding',
      clientName: 'Jane',
      driveFolderId: 'folder_1',
      selectedFolderId: 'folder_2',
    } as never)

    const res = await POST(jsonRequest({ name: 'Wedding', clientName: 'Jane' }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('album_1')
    expect(createAlbumFolders).toHaveBeenCalledWith({ mockDrive: true }, 'Wedding')
    const createArgs = vi.mocked(prisma.album.create).mock.calls[0][0] as {
      data: { driveFolderId: string; selectedFolderId: string; ownerId: string; shareToken: string }
    }
    expect(createArgs.data.driveFolderId).toBe('folder_1')
    expect(createArgs.data.selectedFolderId).toBe('folder_2')
    expect(createArgs.data.ownerId).toBe('user_1')
    expect(typeof createArgs.data.shareToken).toBe('string')
  })
})

describe('GET /api/albums', () => {
  it('filters by owner for a photographer', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findMany).mockResolvedValue([])

    await GET()

    expect(prisma.album.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user_1' } })
    )
  })

  it('returns all albums for an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin_1', role: 'ADMIN' },
    } as never)
    vi.mocked(prisma.album.findMany).mockResolvedValue([])

    await GET()

    expect(prisma.album.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/albums.test.ts`
Expected: FAIL — cannot find module `@/app/api/albums/route`.

- [ ] **Step 3: Write `src/app/api/albums/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDriveClientForUser, createAlbumFolders } from '@/lib/drive'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, clientName } = body as { name?: string; clientName?: string }
  if (!name || !clientName) {
    return NextResponse.json({ error: 'name and clientName are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const drive = getDriveClientForUser(user)
  const { albumFolderId, selectedFolderId } = await createAlbumFolders(drive, name)
  const shareToken = randomBytes(16).toString('hex')

  const album = await prisma.album.create({
    data: {
      name,
      clientName,
      ownerId: user.id,
      driveFolderId: albumFolderId,
      selectedFolderId,
      shareToken,
    },
  })

  return NextResponse.json(album, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const albums = await prisma.album.findMany({
    where: session.user.role === 'ADMIN' ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(albums)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/albums.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/albums/route.ts tests/api/albums.test.ts
git commit -m "Add album creation and listing API backed by Drive folder creation"
```

---

### Task 7: Minimal album UI

**Files:**
- Create: `src/components/CreateAlbumForm.tsx`
- Modify: `src/app/page.tsx` (replace scaffold placeholder with real redirect)
- Create: `src/app/albums/page.tsx`
- Create: `src/app/albums/new/page.tsx`
- Test: `tests/components/CreateAlbumForm.test.tsx`

**Interfaces:**
- Consumes: `POST /api/albums` (Task 6, via `fetch`), `authOptions` + `prisma` (Tasks 2, 4) directly in the server components.
- Produces: rendered pages at `/`, `/albums`, `/albums/new`. Nothing downstream in this plan consumes these; Plan 3 will link into `/albums/:id` for the client-facing view.

- [ ] **Step 1: Write the failing tests**

`tests/components/CreateAlbumForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateAlbumForm } from '@/components/CreateAlbumForm'

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('CreateAlbumForm', () => {
  it('submits name and clientName and redirects on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1' }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.change(screen.getByLabelText('Album name'), { target: { value: 'Wedding' } })
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/albums'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Wedding', clientName: 'Jane' }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'name and clientName are required' }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'name and clientName are required'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/CreateAlbumForm.test.tsx`
Expected: FAIL — cannot find module `@/components/CreateAlbumForm`.

- [ ] **Step 3: Write `src/components/CreateAlbumForm.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function CreateAlbumForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, clientName }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      return
    }
    router.push('/albums')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Album name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Client name
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create album'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/CreateAlbumForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the server-rendered pages (no automated test — see Task 8 for manual verification)**

`src/app/page.tsx` (replaces the Task 1 placeholder):

```tsx
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  redirect(session?.user ? '/albums' : '/api/auth/signin')
}
```

`src/app/albums/page.tsx`:

```tsx
import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AlbumsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const albums = await prisma.album.findMany({
    where: session.user.role === 'ADMIN' ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main>
      <h1>Albums</h1>
      <Link href="/albums/new">Create album</Link>
      <ul>
        {albums.map((album) => (
          <li key={album.id}>
            {album.name} — {album.clientName}
          </li>
        ))}
      </ul>
    </main>
  )
}
```

`src/app/albums/new/page.tsx`:

```tsx
import { CreateAlbumForm } from '@/components/CreateAlbumForm'

export default function NewAlbumPage() {
  return (
    <main>
      <h1>Create album</h1>
      <CreateAlbumForm />
    </main>
  )
}
```

- [ ] **Step 6: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/CreateAlbumForm.tsx src/app/page.tsx src/app/albums tests/components/CreateAlbumForm.test.tsx
git commit -m "Add album list, create-album form, and sign-in redirect pages"
```

---

### Task 8: Manual end-to-end verification

This exercises the one part of the plan that cannot be meaningfully unit-tested: real Google OAuth consent plus a real Drive API call. Do this after Tasks 1–7 are complete and committed.

**Prerequisites:**
- A Google Cloud project with the Drive API enabled, and an OAuth 2.0 Client ID (Web application) with authorized redirect URI `http://localhost:3000/api/auth/callback/google`.
- A Supabase or Neon Postgres database already migrated (Task 2, Step 4).

- [ ] **Step 1: Fill in real secrets**

In `.env.local` (and `.env`, for Prisma), set: `DATABASE_URL`, `NEXTAUTH_URL=http://localhost:3000`, `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY` (generate with `openssl rand -hex 32`), `ADMIN_EMAIL` (your own Google email, to grant yourself the ADMIN role on first login).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`.

- [ ] **Step 3: Sign in**

Visit `http://localhost:3000`. Expected: redirected to `/api/auth/signin`. Click "Sign in with Google", complete the consent screen (it must show a Drive permission — confirming the `drive.file` scope was requested), and land on `/albums` with an empty list.

- [ ] **Step 4: Confirm the User row**

Run: `npx prisma studio`, open the `User` table. Expected: one row with your email, `role = ADMIN`, and a non-null `encryptedRefreshToken` that is not readable plaintext.

- [ ] **Step 5: Create an album**

Click "Create album", fill in a name and client name, submit. Expected: redirected back to `/albums`, and the new album appears in the list.

- [ ] **Step 6: Confirm the Drive folders**

Open Google Drive in your browser (the account you signed in with). Expected: a new folder matching the album name, containing a nested `Selected` subfolder — both created by the app, not manually.

- [ ] **Step 7: Confirm the Album row**

In `npx prisma studio`, open the `Album` table. Expected: one row with `driveFolderId` and `selectedFolderId` matching the two folder IDs visible in Drive's URL bar when you open each folder.
