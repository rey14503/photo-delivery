# Email/Password Auth + Drive Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an email/password sign-in path alongside the existing Google-only login, plus registration, forgot/reset-password (via Resend), and a standalone "connect Google Drive" flow so an email/password account can still create albums once it explicitly grants Drive access.

**Architecture:** A `CredentialsProvider` sits next to the existing `GoogleProvider` in NextAuth, backed by new, independently-testable helpers in `src/lib/auth-callbacks.ts`. Password reset uses a hashed, single-use, time-limited token table and a thin Resend wrapper. Drive connection is deliberately *not* part of NextAuth's OAuth flow — it's two plain routes that exchange a Google auth code for a refresh token and attach it to whichever user is already signed in, so it can never accidentally create a second `User` row the way NextAuth's own account-linking would risk.

**Tech Stack:** Same as every prior plan (Next.js 15, Prisma 5, NextAuth 4, Vitest). Adds `resend` (email sending) as a new dependency.

## Global Constraints

- **This plan is backend-only.** No UI files (`CreateAlbumForm.tsx`, login/register/forgot-password screens) are touched — a separate, concurrently-active effort owns all UI. Every route this plan adds is meant to be called by that UI once it's wired up.
- Before touching anything, run `git status --short` and confirm the files this plan touches aren't already modified/staged by someone else. If they are, stop and report back rather than overwriting.
- Reuse existing utilities exactly: `hashPassword`/`verifyPassword` (`src/lib/password.ts`, Plan 3), `encrypt`/`decrypt` (`src/lib/crypto.ts`, Plan 1), `requireEnv` (`src/lib/env.ts`), `getDriveClientForUser` (`src/lib/drive.ts`, Plan 1). Never reimplement any of these.
- No email verification at registration — an account works immediately after registering. No reCAPTCHA anywhere in this plan.
- **Cross-plan note:** `docs/superpowers/plans/2026-07-09-drive-link-album-creation.md` also modifies `POST /api/albums` (a separate, independent plan, not yet executed as of this writing). Task 7 of *this* plan adds a Drive-connection check to the *current* version of that route. If the Drive-link plan has already landed by the time Task 7 runs, apply the same check (a small guard before any `getDriveClientForUser` call) to that route's rewritten version instead — the check's logic is unchanged, only which file/line it's inserted into differs. Check `git log --oneline -- src/app/api/albums/route.ts` first to see which state the file is actually in.

---

## File Structure

```
photo-delivery/
├── package.json                                    (modified: +resend)
├── prisma/
│   ├── schema.prisma                               (modified: +User.passwordHash, +PasswordResetToken)
│   └── migrations/YYYYMMDDHHMMSS_add_password_auth/ (new)
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts                (new)
│   │       │   ├── forgot-password/route.ts          (new)
│   │       │   └── reset-password/route.ts            (new)
│   │       ├── albums/route.ts                       (modified: +Drive-connection gate)
│   │       └── drive/
│   │           └── connect/
│   │               ├── route.ts                      (new)
│   │               └── callback/route.ts               (new)
│   └── lib/
│       ├── auth.ts                                  (modified: +CredentialsProvider, signIn callback branches by provider)
│       ├── auth-callbacks.ts                        (modified: +verifyCredentials, +registerUser)
│       └── email.ts                                 (new: Resend wrapper)
└── tests/
    ├── api/
    │   ├── auth-register.test.ts                     (new)
    │   ├── auth-forgot-password.test.ts               (new)
    │   ├── auth-reset-password.test.ts                 (new)
    │   ├── albums.test.ts                             (modified: +Drive-connection-gate tests)
    │   ├── drive-connect.test.ts                       (new)
    │   └── drive-connect-callback.test.ts               (new)
    └── lib/
        ├── auth-callbacks.test.ts                    (modified: +verifyCredentials, +registerUser tests)
        └── auth.test.ts                              (new: signIn callback provider-branching)
```

---

### Task 1: Schema — password auth

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_password_auth/` (generated)

**Interfaces:**
- Produces: `User.passwordHash: string | null`, `PasswordResetToken` model (`id`, `userId`, `tokenHash` unique, `expiresAt`, `usedAt`, `createdAt`). Consumed by every later task in this plan.

- [ ] **Step 1: Add the fields to `prisma/schema.prisma`**

In the `User` model, add `passwordHash` and the reset-token relation:

```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  role                  Role     @default(PHOTOGRAPHER)
  passwordHash          String?
  encryptedRefreshToken String?
  driveRootFolderId     String?
  createdAt             DateTime @default(now())
  albums                Album[]
  likes                 Like[]
  comments              Comment[]
  resetTokens           PasswordResetToken[]
}
```

Add the new model anywhere below it:

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add_password_auth`
Expected: a new folder under `prisma/migrations/` is created, the local database is updated, and the Prisma Client is regenerated with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add User.passwordHash and PasswordResetToken for email/password auth"
```

---

### Task 2: `verifyCredentials` and `registerUser`

**Files:**
- Modify: `src/lib/auth-callbacks.ts`
- Modify: `tests/lib/auth-callbacks.test.ts`

**Interfaces:**
- Produces: `verifyCredentials(email: string, password: string): Promise<CredentialsUser | null>`, `registerUser(email: string, password: string, name: string | null): Promise<CredentialsUser>` where `interface CredentialsUser { id: string; email: string; name: string | null; role: Role }`. Consumed by Task 3 (`auth.ts`'s `CredentialsProvider`) and Task 4 (`POST /api/auth/register`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `tests/lib/auth-callbacks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { upsertUserFromGoogleAccount, verifyCredentials, registerUser } from '@/lib/auth-callbacks'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

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

describe('verifyCredentials', () => {
  it('returns the user when the password matches', async () => {
    const passwordHash = await hashPassword('correct-horse-battery-staple')
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'PHOTOGRAPHER',
      passwordHash,
    } as never)

    const result = await verifyCredentials('jane@example.com', 'correct-horse-battery-staple')

    expect(result).toEqual({ id: 'user_1', email: 'jane@example.com', name: 'Jane', role: 'PHOTOGRAPHER' })
  })

  it('returns null when the password is wrong', async () => {
    const passwordHash = await hashPassword('correct-horse-battery-staple')
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'PHOTOGRAPHER',
      passwordHash,
    } as never)

    expect(await verifyCredentials('jane@example.com', 'wrong-password')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    expect(await verifyCredentials('nobody@example.com', 'whatever')).toBeNull()
  })

  it('returns null for a Google-only account with no password set', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'PHOTOGRAPHER',
      passwordHash: null,
    } as never)

    expect(await verifyCredentials('jane@example.com', 'anything')).toBeNull()
  })
})

describe('registerUser', () => {
  it('creates a PHOTOGRAPHER with a hashed password', async () => {
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'PHOTOGRAPHER',
    } as never)

    const result = await registerUser('jane@example.com', 'a-strong-password', 'Jane')

    expect(result).toEqual({ id: 'user_1', email: 'jane@example.com', name: 'Jane', role: 'PHOTOGRAPHER' })
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0] as {
      data: { email: string; name: string | null; role: string; passwordHash: string }
    }
    expect(createArgs.data.email).toBe('jane@example.com')
    expect(createArgs.data.name).toBe('Jane')
    expect(createArgs.data.role).toBe('PHOTOGRAPHER')
    expect(createArgs.data.passwordHash).not.toBe('a-strong-password')
  })

  it('assigns ADMIN role when the email matches ADMIN_EMAIL', async () => {
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user_2',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    } as never)

    const result = await registerUser('admin@example.com', 'a-strong-password', null)

    expect(result.role).toBe('ADMIN')
  })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/lib/auth-callbacks.test.ts`
Expected: FAIL — `verifyCredentials`/`registerUser` are not exported from `@/lib/auth-callbacks` (the 3 pre-existing tests still pass).

- [ ] **Step 3: Add the functions to `src/lib/auth-callbacks.ts`**

Add these imports to the top of the file (alongside the existing ones):

```ts
import { hashPassword, verifyPassword } from './password'
```

Append at the end of the file:

```ts
export interface CredentialsUser {
  id: string
  email: string
  name: string | null
  role: Role
}

export async function verifyCredentials(email: string, password: string): Promise<CredentialsUser | null> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
    return null
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return null
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

export async function registerUser(
  email: string,
  password: string,
  name: string | null
): Promise<CredentialsUser> {
  const role: Role = email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'PHOTOGRAPHER'
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, name, role, passwordHash },
  })
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/auth-callbacks.test.ts`
Expected: PASS (9 tests: 3 pre-existing plus 4 for `verifyCredentials` plus 2 for `registerUser`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-callbacks.ts tests/lib/auth-callbacks.test.ts
git commit -m "Add verifyCredentials and registerUser for email/password auth"
```

---

### Task 3: Wire `CredentialsProvider` into NextAuth

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `tests/lib/auth.test.ts`

**Interfaces:**
- Consumes: `verifyCredentials` (Task 2).
- Produces: `authOptions.providers` now includes a `CredentialsProvider`; `authOptions.callbacks.signIn` now branches on `account.provider`, only calling `upsertUserFromGoogleAccount` for the `'google'` provider. No change to `authOptions.callbacks.jwt`/`session` — both already copy `id`/`role` off of whatever `user` object either provider produces.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
})

vi.mock('@/lib/auth-callbacks', () => ({
  upsertUserFromGoogleAccount: vi.fn(),
  verifyCredentials: vi.fn(),
}))

import { authOptions } from '@/lib/auth'
import { upsertUserFromGoogleAccount } from '@/lib/auth-callbacks'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authOptions.providers', () => {
  it('includes both a Google and a Credentials provider', () => {
    const providerIds = authOptions.providers.map((p) => p.id)
    expect(providerIds).toContain('google')
    expect(providerIds).toContain('credentials')
  })
})

describe('authOptions.callbacks.signIn', () => {
  it('calls upsertUserFromGoogleAccount for a Google sign-in', async () => {
    vi.mocked(upsertUserFromGoogleAccount).mockResolvedValue({ id: 'user_1', role: 'PHOTOGRAPHER' })

    const result = await authOptions.callbacks!.signIn!({
      user: { email: 'jane@example.com', name: 'Jane' } as never,
      account: { provider: 'google', refresh_token: 'raw-token' } as never,
    } as never)

    expect(result).toBe(true)
    expect(upsertUserFromGoogleAccount).toHaveBeenCalledWith('jane@example.com', 'Jane', {
      provider: 'google',
      refresh_token: 'raw-token',
    })
  })

  it('does not call upsertUserFromGoogleAccount for a credentials sign-in', async () => {
    const result = await authOptions.callbacks!.signIn!({
      user: { id: 'user_1', email: 'jane@example.com', name: 'Jane', role: 'PHOTOGRAPHER' } as never,
      account: { provider: 'credentials' } as never,
    } as never)

    expect(result).toBe(true)
    expect(upsertUserFromGoogleAccount).not.toHaveBeenCalled()
  })

  it('rejects when there is no email or no account', async () => {
    const noEmail = await authOptions.callbacks!.signIn!({
      user: {} as never,
      account: { provider: 'google' } as never,
    } as never)
    expect(noEmail).toBe(false)

    const noAccount = await authOptions.callbacks!.signIn!({
      user: { email: 'jane@example.com' } as never,
      account: null,
    } as never)
    expect(noAccount).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: FAIL — `authOptions.providers` has no `'credentials'` entry yet, and the `signIn` callback unconditionally calls `upsertUserFromGoogleAccount` regardless of provider.

- [ ] **Step 3: Update `src/lib/auth.ts`**

Full updated file:

```ts
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'
import { requireEnv } from './env'
import { upsertUserFromGoogleAccount, verifyCredentials } from './auth-callbacks'

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
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        const user = await verifyCredentials(credentials.email, credentials.password)
        return user
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false
      if (account.provider === 'credentials') {
        return true
      }
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` — expect no regressions elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts
git commit -m "Add CredentialsProvider alongside Google sign-in"
```

---

### Task 4: `POST /api/auth/register`

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `tests/api/auth-register.test.ts`

**Interfaces:**
- Consumes: `registerUser` (Task 2).
- Produces: `POST /api/auth/register` (body `{ email, password, name? }`) → `201` with `{ id, email, name }` (never the hash), or `400`/`409`.

- [ ] **Step 1: Write the failing tests**

`tests/api/auth-register.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth-callbacks', () => ({
  registerUser: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { registerUser } from '@/lib/auth-callbacks'
import { POST } from '@/app/api/auth/register/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/register', () => {
  it('returns 400 when email or password is missing', async () => {
    const res = await POST(jsonRequest({ email: 'jane@example.com' }))

    expect(res.status).toBe(400)
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('returns 400 when the password is shorter than 8 characters', async () => {
    const res = await POST(jsonRequest({ email: 'jane@example.com', password: 'short' }))

    expect(res.status).toBe(400)
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('returns 409 when the email is already registered', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing_user' } as never)

    const res = await POST(
      jsonRequest({ email: 'jane@example.com', password: 'a-strong-password' })
    )

    expect(res.status).toBe(409)
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('creates the user and returns 201 without the password hash', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(registerUser).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'PHOTOGRAPHER',
    })

    const res = await POST(
      jsonRequest({ email: 'jane@example.com', password: 'a-strong-password', name: 'Jane' })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({ id: 'user_1', email: 'jane@example.com', name: 'Jane' })
    expect(JSON.stringify(data)).not.toContain('passwordHash')
    expect(registerUser).toHaveBeenCalledWith('jane@example.com', 'a-strong-password', 'Jane')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/auth-register.test.ts`
Expected: FAIL — cannot find module `@/app/api/auth/register/route`.

- [ ] **Step 3: Write `src/app/api/auth/register/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerUser } from '@/lib/auth-callbacks'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password, name } = body as { email?: string; password?: string; name?: string }

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const user = await registerUser(email, password, name ?? null)

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/auth-register.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/register/route.ts tests/api/auth-register.test.ts
git commit -m "Add POST /api/auth/register for email/password sign-up"
```

---

### Task 5: Resend wrapper and `POST /api/auth/forgot-password`

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `tests/api/auth-forgot-password.test.ts`
- Modify: `package.json` (add `resend`)

**Interfaces:**
- Produces: `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>` (`src/lib/email.ts`). Consumed by `POST /api/auth/forgot-password`.
- Produces: `POST /api/auth/forgot-password` (body `{ email }`) → always `200`.

- [ ] **Step 1: Add the `resend` dependency**

Edit `package.json`'s `dependencies` block to add:

```json
    "resend": "6.17.2",
```

Run: `npm install`

- [ ] **Step 2: Write `src/lib/email.ts`**

No test file for this — it's a thin wrapper around a third-party SDK with nothing to unit-test beyond "does it call the SDK correctly," which is exercised through the route test in Step 3 (which mocks this module entirely).

```ts
import { Resend } from 'resend'
import { requireEnv } from './env'

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = new Resend(requireEnv('RESEND_API_KEY'))
  await resend.emails.send({
    from: 'no-reply@photo-delivery.app',
    to,
    subject: 'Reset your password',
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  })
}
```

- [ ] **Step 3: Write the failing tests**

`tests/api/auth-forgot-password.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passwordResetToken: { create: vi.fn() },
  },
}))
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { POST } from '@/app/api/auth/forgot-password/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
})

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 and sends an email for an existing password account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      passwordHash: 'some-hash',
    } as never)
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({} as never)

    const res = await POST(jsonRequest({ email: 'jane@example.com' }))

    expect(res.status).toBe(200)
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1)
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1)
    const [to, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0]
    expect(to).toBe('jane@example.com')
    expect(resetUrl).toContain('http://localhost:3000')
  })

  it('returns 200 without sending an email for an unknown address', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ email: 'nobody@example.com' }))

    expect(res.status).toBe(200)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('returns 200 without sending an email for a Google-only account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      email: 'jane@example.com',
      passwordHash: null,
    } as never)

    const res = await POST(jsonRequest({ email: 'jane@example.com' }))

    expect(res.status).toBe(200)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('returns 200 even when the body has no email', async () => {
    const res = await POST(jsonRequest({}))

    expect(res.status).toBe(200)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run tests/api/auth-forgot-password.test.ts`
Expected: FAIL — cannot find module `@/app/api/auth/forgot-password/route`.

- [ ] **Step 5: Write `src/app/api/auth/forgot-password/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

const TOKEN_TTL_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email } = body as { email?: string }

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user?.passwordHash) {
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        },
      })

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`
      await sendPasswordResetEmail(user.email, resetUrl)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/api/auth-forgot-password.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/email.ts src/app/api/auth/forgot-password/route.ts tests/api/auth-forgot-password.test.ts
git commit -m "Add forgot-password flow: token generation and Resend email"
```

---

### Task 6: `POST /api/auth/reset-password`

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `tests/api/auth-reset-password.test.ts`

**Interfaces:**
- Produces: `POST /api/auth/reset-password` (body `{ token, newPassword }`) → `200` on success, `400` for a missing/expired/used/unknown token.

- [ ] **Step 1: Write the failing tests**

`tests/api/auth-reset-password.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    passwordResetToken: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
  },
}))
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('new-hashed-password'),
}))

import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { POST } from '@/app/api/auth/reset-password/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function tokenHashFor(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when token or newPassword is missing', async () => {
    const res = await POST(jsonRequest({ token: 'abc' }))

    expect(res.status).toBe(400)
  })

  it('returns 400 for an unknown token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ token: 'unknown-token', newPassword: 'a-new-password' }))

    expect(res.status).toBe(400)
  })

  it('returns 400 for an expired token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'reset_1',
      userId: 'user_1',
      tokenHash: tokenHashFor('valid-token'),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    } as never)

    const res = await POST(jsonRequest({ token: 'valid-token', newPassword: 'a-new-password' }))

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 for an already-used token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'reset_1',
      userId: 'user_1',
      tokenHash: tokenHashFor('valid-token'),
      expiresAt: new Date(Date.now() + 1000 * 60),
      usedAt: new Date(),
    } as never)

    const res = await POST(jsonRequest({ token: 'valid-token', newPassword: 'a-new-password' }))

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the password and marks the token used for a valid token', async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: 'reset_1',
      userId: 'user_1',
      tokenHash: tokenHashFor('valid-token'),
      expiresAt: new Date(Date.now() + 1000 * 60),
      usedAt: null,
    } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(prisma.passwordResetToken.update).mockResolvedValue({} as never)

    const res = await POST(jsonRequest({ token: 'valid-token', newPassword: 'a-new-password' }))

    expect(res.status).toBe(200)
    expect(hashPassword).toHaveBeenCalledWith('a-new-password')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { passwordHash: 'new-hashed-password' },
    })
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'reset_1' },
      data: { usedAt: expect.any(Date) },
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/auth-reset-password.test.ts`
Expected: FAIL — cannot find module `@/app/api/auth/reset-password/route`.

- [ ] **Step 3: Write `src/app/api/auth/reset-password/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, newPassword } = body as { token?: string; newPassword?: string }

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'token and newPassword are required' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired' }, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash },
  })
  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/auth-reset-password.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts tests/api/auth-reset-password.test.ts
git commit -m "Add POST /api/auth/reset-password"
```

---

### Task 7: Drive-connection gate on album creation

**Files:**
- Modify: `src/app/api/albums/route.ts`
- Modify: `tests/api/albums.test.ts`

**Interfaces:**
- Produces: `POST /api/albums` now returns a `400` with a clear message when `user.encryptedRefreshToken` is missing, instead of letting `getDriveClientForUser`'s throw surface as a `500`.

**Before you begin:** run `git log --oneline -- src/app/api/albums/route.ts` and read the current file. If `docs/superpowers/plans/2026-07-09-drive-link-album-creation.md` has already been executed (the route now parses a `driveLink` instead of calling `createAlbumFolders`), apply this same check there instead — insert it right after the `user` lookup and before the first `getDriveClientForUser`/`canEditFolder` call, adjust the test file accordingly, and note in your final report that you adapted this task to the Drive-link version of the route.

- [ ] **Step 1: Write the failing test**

Add this test into the existing `describe('POST /api/albums', ...)` block in `tests/api/albums.test.ts` (adjust field names/mocks to match whichever version of the route is currently on disk, per the note above — the assertion below assumes the pre-Drive-link version still calling `createAlbumFolders`; if that plan has landed, assert against its `driveLink` flow instead, but keep the same intent: no Drive call happens, and a clear 400 is returned):

```ts
  it('returns 400 with a clear message when the user has no connected Drive', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_1',
      encryptedRefreshToken: null,
    } as never)

    const res = await POST(jsonRequest({ name: 'Wedding', clientName: 'Jane' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/connect your google drive/i)
    expect(createAlbumFolders).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `npx vitest run tests/api/albums.test.ts`
Expected: FAIL — the route currently calls `getDriveClientForUser` unconditionally, which throws for a null `encryptedRefreshToken`, producing a `500` (caught by the route's generic error handler) instead of the intended `400`.

- [ ] **Step 3: Add the gate to `src/app/api/albums/route.ts`**

Insert this check immediately after the `user` lookup (`if (!user) { ... }`) and before the first Drive call:

```ts
  if (!user.encryptedRefreshToken) {
    return NextResponse.json(
      { error: 'Connect your Google Drive before creating an album' },
      { status: 400 }
    )
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/albums.test.ts`
Expected: PASS, with one additional test over the pre-existing count.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/albums/route.ts tests/api/albums.test.ts
git commit -m "Return a clear 400 when creating an album without a connected Drive"
```

---

### Task 8: Drive-connect OAuth routes

**Files:**
- Create: `src/app/api/drive/connect/route.ts`
- Create: `src/app/api/drive/connect/callback/route.ts`
- Create: `tests/api/drive-connect.test.ts`
- Create: `tests/api/drive-connect-callback.test.ts`

**Interfaces:**
- Consumes: `requireEnv` (`src/lib/env.ts`), `encrypt` (`src/lib/crypto.ts`).
- Produces: `GET /api/drive/connect` → `302` redirect to Google's consent screen (or `401` with no session). `GET /api/drive/connect/callback` → exchanges `code` for tokens, encrypts and stores the refresh token on the *currently signed-in* user, `302` redirect back into the app (or `401` with no session).

- [ ] **Step 1: Write the failing tests for `GET /api/drive/connect`**

`tests/api/drive-connect.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
})

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

const generateAuthUrlMock = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/mock-consent')
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: generateAuthUrlMock,
      })),
    },
  },
}))

import { getServerSession } from 'next-auth/next'
import { GET } from '@/app/api/drive/connect/route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/drive/connect', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('redirects to a Google consent URL requesting only drive.file scope', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user_1' } } as never)

    const res = await GET()

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/mock-consent')
    expect(generateAuthUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/drive.file'],
      })
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/drive-connect.test.ts`
Expected: FAIL — cannot find module `@/app/api/drive/connect/route`.

- [ ] **Step 3: Write `src/app/api/drive/connect/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { google } from 'googleapis'
import { authOptions } from '@/lib/auth'
import { requireEnv } from '@/lib/env'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauth2Client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    `${requireEnv('NEXTAUTH_URL')}/api/drive/connect/callback`
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  })

  return NextResponse.redirect(url)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/drive-connect.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing tests for `GET /api/drive/connect/callback`**

`tests/api/drive-connect-callback.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.ENCRYPTION_KEY = '0'.repeat(64)
})

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: vi.fn() },
  },
}))

const getTokenMock = vi.fn()
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        getToken: getTokenMock,
      })),
    },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/drive/connect/callback/route'

function requestWithCode(code: string | null) {
  const url = new URL('http://localhost:3000/api/drive/connect/callback')
  if (code) url.searchParams.set('code', code)
  return { url: url.toString() } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/drive/connect/callback', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await GET(requestWithCode('auth-code'))

    expect(res.status).toBe(401)
  })

  it('returns 400 when no code is present', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user_1' } } as never)

    const res = await GET(requestWithCode(null))

    expect(res.status).toBe(400)
  })

  it('exchanges the code, encrypts the refresh token, and attaches it to the current session user', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
    getTokenMock.mockResolvedValue({ tokens: { refresh_token: 'raw-refresh-token' } })
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    const res = await GET(requestWithCode('auth-code'))

    expect(res.status).toBe(307)
    expect(getTokenMock).toHaveBeenCalledWith('auth-code')
    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0][0] as {
      where: { id: string }
      data: { encryptedRefreshToken: string }
    }
    expect(updateArgs.where.id).toBe('user_1')
    expect(updateArgs.data.encryptedRefreshToken).not.toBe('raw-refresh-token')
  })

  it('returns 400 when Google does not return a refresh token', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
    getTokenMock.mockResolvedValue({ tokens: {} })

    const res = await GET(requestWithCode('auth-code'))

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/api/drive-connect-callback.test.ts`
Expected: FAIL — cannot find module `@/app/api/drive/connect/callback/route`.

- [ ] **Step 7: Write `src/app/api/drive/connect/callback/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { google } from 'googleapis'
import { authOptions } from '@/lib/auth'
import { requireEnv } from '@/lib/env'
import { encrypt } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const code = new URL(request.url).searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
  }

  const oauth2Client = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    `${requireEnv('NEXTAUTH_URL')}/api/drive/connect/callback`
  )

  const { tokens } = await oauth2Client.getToken(code)
  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: 'Google did not return a refresh token. Try connecting again.' },
      { status: 400 }
    )
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { encryptedRefreshToken: encrypt(tokens.refresh_token) },
  })

  return NextResponse.redirect(`${requireEnv('NEXTAUTH_URL')}/albums`)
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/api/drive-connect-callback.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Run the full suite and verify the build**

Run: `npx vitest run` — expect no regressions.
Run: `npx tsc --noEmit` — expect no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/drive/connect tests/api/drive-connect.test.ts tests/api/drive-connect-callback.test.ts
git commit -m "Add GET /api/drive/connect and its callback to attach Drive to an existing session"
```

---

### Task 9: Manual end-to-end verification

Requires `RESEND_API_KEY` in `.env`/`.env.local` (sign up at resend.com and create an API key first — this plan cannot proceed past Step 3 without it) and real Google OAuth credentials (already present from Plan 1).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Register and sign in with email/password**

`curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test-email-auth@example.com","password":"a-strong-password","name":"Test User"}'`. Expected: `201` with the new user's id/email/name. Then use NextAuth's credentials sign-in (via the UI once it exists, or `POST /api/auth/callback/credentials` with the right CSRF token if testing manually) to confirm a session is established.

- [ ] **Step 3: Forgot / reset password**

`curl -X POST http://localhost:3000/api/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"test-email-auth@example.com"}'`. Expected: `200`, and a real email arrives (check the inbox used). Copy the token from the emailed link, then `curl -X POST http://localhost:3000/api/auth/reset-password -H "Content-Type: application/json" -d '{"token":"<token from email>","newPassword":"a-different-password"}'`. Expected: `200`; the old password no longer works for sign-in, the new one does.

- [ ] **Step 4: Connect Drive and create an album**

While signed in as the email/password test user, attempt to create an album via `POST /api/albums` — expect the `400` "Connect your Google Drive" message. Then visit `http://localhost:3000/api/drive/connect` in the browser (while signed in), complete Google's consent screen, confirm you land back on `/albums`. Retry album creation — it should now succeed, and Prisma Studio should show `encryptedRefreshToken` populated on that same user row (not a new one).
