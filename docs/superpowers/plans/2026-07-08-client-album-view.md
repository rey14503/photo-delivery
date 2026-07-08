# Client Album View (Plan 3 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a photographer set an optional password on an album and share its link; let a client open that link with no account, optionally enter the password, enter a display name once, and browse the album's photos (thumbnail grid + a larger preview lightbox) using the images already cached in Plan 2.

**Architecture:** Two small server-side utilities (`password.ts` for bcrypt hashing, `album-unlock.ts` for an HMAC-based "this browser entered the password" cookie token) back two new public API routes (`unlock`, `identify`) and a public page at `/a/[shareToken]`. The page is a server component that branches on three states — password-gated, name-not-captured, or ready — rendering a small client component for each. The gallery renders `Photo.thumbnailUrl`/`previewUrl`, both already public Vercel Blob URLs from Plan 2, so no new image-serving/proxy infrastructure is needed in this plan.

**Tech Stack:** Builds on Plans 1–2's stack (Next.js 15, Prisma 5, Vitest). Adds `bcryptjs` (password hashing).

## Global Constraints

- Single-tenant (unchanged).
- Client access has **no account and no NextAuth session** — the public route and its two API routes must never call `getServerSession`. Client identity is a cookie holding a freely-chosen display name; nothing more.
- The share link is `/a/[shareToken]` — the album's existing `shareToken` field (already unique, already generated at album creation in Plan 1). No new token scheme.
- Password protection is optional per album (`Album.passwordHash`, already in the schema, currently always `null` since Plan 1 never built a UI to set it — this plan adds that UI).
- Full-resolution/original image proxying from Drive and download-permission enforcement are **out of scope** — those belong to Plan 5. This plan only ever serves the Plan-2-cached `thumbnailUrl`/`previewUrl` Blob URLs.
- No `Like`/`Comment` functionality — that belongs to Plan 4. The name-capture cookie is built here because it's part of the client *access* flow, but nothing in this plan reads or displays it back — Plan 4 will consume it.
- No watermarking, no email sending, no real-time/WebSocket infra.
- No changes to `prisma/schema.prisma` — every field this plan needs (`shareToken`, `passwordHash`) already exists.

---

## File Structure

```
photo-delivery/
├── package.json                                          (modified: +bcryptjs)
├── src/
│   ├── app/
│   │   ├── a/
│   │   │   └── [shareToken]/
│   │   │       └── page.tsx                               (new — public)
│   │   ├── albums/
│   │   │   └── [albumId]/
│   │   │       └── page.tsx                               (modified: +share link, +SetAlbumPassword)
│   │   └── api/
│   │       ├── albums/
│   │       │   └── [albumId]/
│   │       │       └── password/route.ts                   (new)
│   │       └── share/
│   │           ├── [shareToken]/
│   │           │   └── unlock/route.ts                      (new — public)
│   │           └── identify/route.ts                        (new — public)
│   ├── components/
│   │   ├── SetAlbumPassword.tsx                            (new)
│   │   ├── PasswordGate.tsx                                (new)
│   │   ├── NameGate.tsx                                    (new)
│   │   └── ClientGallery.tsx                                (new)
│   └── lib/
│       ├── password.ts                                     (new)
│       ├── album-unlock.ts                                  (new)
│       └── client-identity.ts                               (new)
└── tests/
    ├── lib/
    │   ├── password.test.ts                                 (new)
    │   ├── album-unlock.test.ts                              (new)
    │   └── client-identity.test.ts                           (new)
    ├── api/
    │   ├── albums-password.test.ts                           (new)
    │   ├── share-unlock.test.ts                              (new)
    │   └── share-identify.test.ts                            (new)
    └── components/
        ├── SetAlbumPassword.test.tsx                         (new)
        ├── PasswordGate.test.tsx                             (new)
        ├── NameGate.test.tsx                                 (new)
        └── ClientGallery.test.tsx                            (new)
```

---

### Task 1: Password hashing + album password-set API

**Files:**
- Create: `src/lib/password.ts`
- Test: `tests/lib/password.test.ts`
- Create: `src/app/api/albums/[albumId]/password/route.ts`
- Test: `tests/api/albums-password.test.ts`
- Modify: `package.json` (add `bcryptjs`)

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`. Consumed by this task's route and Task 4's unlock route.
- Produces: `POST /api/albums/[albumId]/password` (session-authenticated, body `{ password: string | null }`) → `200` with `{ id: string; hasPassword: boolean }`, or `401`/`403`/`404`. Consumed by Task 2's `SetAlbumPassword` component.

- [ ] **Step 1: Add the `bcryptjs` dependency**

Edit `package.json`'s `dependencies` block to add:

```json
    "@vercel/blob": "2.6.0",
    "bcryptjs": "3.0.3"
```

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Write the failing tests for `password.ts`**

`tests/lib/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces a different hash each time (salted)', async () => {
    const a = await hashPassword('same-input')
    const b = await hashPassword('same-input')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/password.test.ts`
Expected: FAIL — cannot find module `@/lib/password`.

- [ ] **Step 4: Write `src/lib/password.ts`**

```ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing tests for the password-set route**

`tests/api/albums-password.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/albums/[albumId]/password/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(albumId: string) {
  return { params: Promise.resolve({ albumId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/albums/[albumId]/password', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the album does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))

    expect(res.status).toBe(404)
  })

  it('returns 403 when a PHOTOGRAPHER does not own the album', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'someone_else',
    } as never)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))

    expect(res.status).toBe(403)
  })

  it('hashes and stores a new password', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({
      id: 'album_1',
      passwordHash: 'some-bcrypt-hash',
    } as never)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ id: 'album_1', hasPassword: true })
    const updateArgs = vi.mocked(prisma.album.update).mock.calls[0][0] as {
      where: { id: string }
      data: { passwordHash: string | null }
    }
    expect(updateArgs.where.id).toBe('album_1')
    expect(updateArgs.data.passwordHash).not.toBeNull()
    expect(updateArgs.data.passwordHash).not.toBe('secret')
  })

  it('clears the password when given null', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user_1', role: 'PHOTOGRAPHER' },
    } as never)
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      ownerId: 'user_1',
    } as never)
    vi.mocked(prisma.album.update).mockResolvedValue({
      id: 'album_1',
      passwordHash: null,
    } as never)

    const res = await POST(jsonRequest({ password: null }), routeParams('album_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ id: 'album_1', hasPassword: false })
    const updateArgs = vi.mocked(prisma.album.update).mock.calls[0][0] as {
      data: { passwordHash: string | null }
    }
    expect(updateArgs.data.passwordHash).toBeNull()
  })
})
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx vitest run tests/api/albums-password.test.ts`
Expected: FAIL — cannot find module `@/app/api/albums/[albumId]/password/route`.

- [ ] **Step 8: Write `src/app/api/albums/[albumId]/password/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { hashPassword } from '@/lib/password'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { albumId } = await params
  const album = await prisma.album.findUnique({ where: { id: albumId } })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }
  if (!canManageAlbum(session.user, album)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { password } = body as { password?: string | null }
  const passwordHash = password && password.trim() ? await hashPassword(password.trim()) : null

  const updated = await prisma.album.update({
    where: { id: albumId },
    data: { passwordHash },
  })

  return NextResponse.json({ id: updated.id, hasPassword: Boolean(updated.passwordHash) })
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/api/albums-password.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/lib/password.ts tests/lib/password.test.ts src/app/api/albums/\[albumId\]/password/route.ts tests/api/albums-password.test.ts
git commit -m "Add password hashing and album password-set API"
```

---

### Task 2: Password-set UI on the album detail page

**Files:**
- Create: `src/components/SetAlbumPassword.tsx`
- Test: `tests/components/SetAlbumPassword.test.tsx`
- Modify: `src/app/albums/[albumId]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/albums/[albumId]/password` (Task 1, via `fetch`).
- Produces: rendered password-set control and a copyable share link on `/albums/[albumId]`. Nothing downstream in this plan consumes it — it's the photographer-facing half of Task 1's API.

- [ ] **Step 1: Write the failing tests**

`tests/components/SetAlbumPassword.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('SetAlbumPassword', () => {
  it('submits a new password and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', hasPassword: true }),
    } as never)

    render(<SetAlbumPassword albumId="album_1" hasPassword={false} />)
    fireEvent.change(screen.getByLabelText('Album password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret123' }),
      })
    )
  })

  it('shows a remove-password button and clears it when a password is already set', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', hasPassword: false }),
    } as never)

    render(<SetAlbumPassword albumId="album_1" hasPassword={true} />)
    fireEvent.click(screen.getByRole('button', { name: /remove password/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: null }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)

    render(<SetAlbumPassword albumId="album_1" hasPassword={false} />)
    fireEvent.change(screen.getByLabelText('Album password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/SetAlbumPassword.test.tsx`
Expected: FAIL — cannot find module `@/components/SetAlbumPassword`.

- [ ] **Step 3: Write `src/components/SetAlbumPassword.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

async function submitPassword(albumId: string, password: string | null) {
  return fetch(`/api/albums/${albumId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export function SetAlbumPassword({
  albumId,
  hasPassword,
}: {
  albumId: string
  hasPassword: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSetSubmit(e: FormEvent) {
    e.preventDefault()
    await run(password)
  }

  async function handleRemove() {
    await run(null)
  }

  async function run(value: string | null) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitPassword(albumId, value)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      setPassword('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSetSubmit}>
        <label>
          Album password
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {hasPassword ? 'Change password' : 'Set password'}
        </button>
      </form>
      {hasPassword && (
        <button type="button" onClick={handleRemove} disabled={submitting}>
          Remove password
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/SetAlbumPassword.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it into the album detail page and show the share link**

Modify `src/app/albums/[albumId]/page.tsx` — add the import and render `SetAlbumPassword` plus the share link. Full updated file:

```tsx
import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const { albumId } = await params
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { photos: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!album || !canManageAlbum(session.user, album)) {
    notFound()
  }

  return (
    <main>
      <h1>
        {album.name} — {album.clientName}
      </h1>
      <p>
        Share link: <code>/a/{album.shareToken}</code>
      </p>
      <SetAlbumPassword albumId={album.id} hasPassword={Boolean(album.passwordHash)} />
      <UploadPhotos albumId={album.id} />
      <ul>
        {album.photos.map((photo) => (
          <li key={photo.id}>
            <img src={photo.thumbnailUrl} alt="" width={200} />
            {photo.version > 1 && <span> v{photo.version}</span>}
            <ReplacePhotoButton photoId={photo.id} />
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 6: Verify the app builds**

Run: `npx next build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/SetAlbumPassword.tsx tests/components/SetAlbumPassword.test.tsx src/app/albums/\[albumId\]/page.tsx
git commit -m "Add password-set UI and share link to the album detail page"
```

---

### Task 3: Client-side utilities — unlock token and name-cookie validation

**Files:**
- Create: `src/lib/album-unlock.ts`
- Test: `tests/lib/album-unlock.test.ts`
- Create: `src/lib/client-identity.ts`
- Test: `tests/lib/client-identity.test.ts`

**Interfaces:**
- Produces: `unlockToken(albumId: string): string` and `isUnlocked(albumId: string, cookieValue: string | undefined): boolean`. Consumed by Task 4's unlock route and Task 5's share page.
- Produces: `CLIENT_NAME_COOKIE: string` (the cookie name constant) and `isValidClientName(name: unknown): name is string`. Consumed by Task 4's identify route and Task 5's share page.

- [ ] **Step 1: Write the failing tests for `album-unlock.ts`**

`tests/lib/album-unlock.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { unlockToken, isUnlocked } from '@/lib/album-unlock'

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

describe('unlockToken', () => {
  it('is deterministic for the same album id', () => {
    expect(unlockToken('album_1')).toBe(unlockToken('album_1'))
  })

  it('differs between album ids', () => {
    expect(unlockToken('album_1')).not.toBe(unlockToken('album_2'))
  })
})

describe('isUnlocked', () => {
  it('returns true when the cookie value matches the token', () => {
    expect(isUnlocked('album_1', unlockToken('album_1'))).toBe(true)
  })

  it('returns false when the cookie value does not match', () => {
    expect(isUnlocked('album_1', 'wrong-value')).toBe(false)
  })

  it('returns false when there is no cookie value', () => {
    expect(isUnlocked('album_1', undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/album-unlock.test.ts`
Expected: FAIL — cannot find module `@/lib/album-unlock`.

- [ ] **Step 3: Write `src/lib/album-unlock.ts`**

```ts
import { createHmac } from 'crypto'
import { requireEnv } from './env'

export function unlockToken(albumId: string): string {
  return createHmac('sha256', requireEnv('NEXTAUTH_SECRET')).update(albumId).digest('hex')
}

export function isUnlocked(albumId: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) {
    return false
  }
  return cookieValue === unlockToken(albumId)
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/lib/album-unlock.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing tests for `client-identity.ts`**

`tests/lib/client-identity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CLIENT_NAME_COOKIE, isValidClientName } from '@/lib/client-identity'

describe('CLIENT_NAME_COOKIE', () => {
  it('is a non-empty cookie name', () => {
    expect(typeof CLIENT_NAME_COOKIE).toBe('string')
    expect(CLIENT_NAME_COOKIE.length).toBeGreaterThan(0)
  })
})

describe('isValidClientName', () => {
  it('accepts a short non-empty string', () => {
    expect(isValidClientName('Jane Doe')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidClientName('')).toBe(false)
  })

  it('rejects a whitespace-only string', () => {
    expect(isValidClientName('   ')).toBe(false)
  })

  it('rejects a string longer than 100 characters', () => {
    expect(isValidClientName('a'.repeat(101))).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidClientName(42)).toBe(false)
    expect(isValidClientName(null)).toBe(false)
    expect(isValidClientName(undefined)).toBe(false)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/lib/client-identity.test.ts`
Expected: FAIL — cannot find module `@/lib/client-identity`.

- [ ] **Step 7: Write `src/lib/client-identity.ts`**

```ts
export const CLIENT_NAME_COOKIE = 'client_name'

export function isValidClientName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run tests/lib/client-identity.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/album-unlock.ts tests/lib/album-unlock.test.ts src/lib/client-identity.ts tests/lib/client-identity.test.ts
git commit -m "Add album-unlock token and client-name validation utilities"
```

---

### Task 4: Public share API routes — unlock and identify

**Files:**
- Create: `src/app/api/share/[shareToken]/unlock/route.ts`
- Test: `tests/api/share-unlock.test.ts`
- Create: `src/app/api/share/identify/route.ts`
- Test: `tests/api/share-identify.test.ts`

**Interfaces:**
- Consumes: `prisma` (album lookup by `shareToken`), `verifyPassword` (Task 1), `unlockToken` (Task 3).
- Produces: `POST /api/share/[shareToken]/unlock` (body `{ password: string }`) → `200` (sets an `album_unlock_<albumId>` cookie) or `400`/`401`/`404`. Consumed by Task 6's `PasswordGate`.
- Consumes: `CLIENT_NAME_COOKIE`, `isValidClientName` (Task 3).
- Produces: `POST /api/share/identify` (body `{ name: string }`) → `200` (sets the `client_name` cookie) or `400`. Consumed by Task 6's `NameGate`.

**Note:** neither route calls `getServerSession` — these are public, unauthenticated endpoints by design (see Global Constraints).

- [ ] **Step 1: Write the failing tests for the unlock route**

`tests/api/share-unlock.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { unlockToken } from '@/lib/album-unlock'
import { POST } from '@/app/api/share/[shareToken]/unlock/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

function routeParams(shareToken: string) {
  return { params: Promise.resolve({ shareToken }) }
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/share/[shareToken]/unlock', () => {
  it('returns 404 when the album does not exist', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue(null)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('bad-token'))

    expect(res.status).toBe(404)
  })

  it('returns 400 when the album has no password set', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      passwordHash: null,
    } as never)

    const res = await POST(jsonRequest({ password: 'secret' }), routeParams('token_1'))

    expect(res.status).toBe(400)
  })

  it('returns 401 when the password is incorrect', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      passwordHash: 'hashed',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const res = await POST(jsonRequest({ password: 'wrong' }), routeParams('token_1'))

    expect(res.status).toBe(401)
  })

  it('sets the unlock cookie and returns success on a correct password', async () => {
    vi.mocked(prisma.album.findUnique).mockResolvedValue({
      id: 'album_1',
      passwordHash: 'hashed',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const res = await POST(jsonRequest({ password: 'correct' }), routeParams('token_1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    const cookie = res.cookies.get('album_unlock_album_1')
    expect(cookie?.value).toBe(unlockToken('album_1'))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/api/share-unlock.test.ts`
Expected: FAIL — cannot find module `@/app/api/share/[shareToken]/unlock/route`.

- [ ] **Step 3: Write `src/app/api/share/[shareToken]/unlock/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { unlockToken } from '@/lib/album-unlock'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params
  const album = await prisma.album.findUnique({ where: { shareToken } })
  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }
  if (!album.passwordHash) {
    return NextResponse.json({ error: 'This album has no password' }, { status: 400 })
  }

  const body = await request.json()
  const { password } = body as { password?: string }
  if (!password || !(await verifyPassword(password, album.passwordHash))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(`album_unlock_${album.id}`, unlockToken(album.id), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/api/share-unlock.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing tests for the identify route**

`tests/api/share-identify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/share/identify/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

describe('POST /api/share/identify', () => {
  it('returns 400 for an empty name', async () => {
    const res = await POST(jsonRequest({ name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a missing name field', async () => {
    const res = await POST(jsonRequest({}))
    expect(res.status).toBe(400)
  })

  it('sets the client_name cookie and returns success for a valid name', async () => {
    const res = await POST(jsonRequest({ name: 'Jane Doe' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(res.cookies.get('client_name')?.value).toBe('Jane Doe')
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/api/share-identify.test.ts`
Expected: FAIL — cannot find module `@/app/api/share/identify/route`.

- [ ] **Step 7: Write `src/app/api/share/identify/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { CLIENT_NAME_COOKIE, isValidClientName } from '@/lib/client-identity'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name } = body as { name?: unknown }
  if (!isValidClientName(name)) {
    return NextResponse.json({ error: 'A valid name is required' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(CLIENT_NAME_COOKIE, name.trim(), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/api/share-identify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/share tests/api/share-unlock.test.ts tests/api/share-identify.test.ts
git commit -m "Add public unlock and identify API routes for client album access"
```

---

### Task 5: Public share page

**Files:**
- Create: `src/app/a/[shareToken]/page.tsx`

**Interfaces:**
- Consumes: `prisma` (album + photos lookup by `shareToken`), `isUnlocked` (Task 3), `CLIENT_NAME_COOKIE` (Task 3). Renders `PasswordGate`, `NameGate`, `ClientGallery` (all from Task 6/7 — this task's page won't compile/build until those exist, so this task's own build-verification step comes after Task 7 in practice; see the note in Task 7).
- Produces: rendered page at `/a/[shareToken]`. Terminal page for this plan — nothing downstream in this plan consumes it, but Plan 4 (likes/comments) will extend it.

This task has no dedicated unit test — the branching logic (password gate / name gate / gallery) is thin routing glue around already-tested utilities (`isUnlocked`) and already-tested/to-be-tested components; it's verified by `next build` and the manual walkthrough in Task 8, consistent with the plan's established pattern for server-page-only tasks (see Plan 1 Task 7, Plan 2 Task 7).

- [ ] **Step 1: Write `src/app/a/[shareToken]/page.tsx`**

```tsx
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isUnlocked } from '@/lib/album-unlock'
import { CLIENT_NAME_COOKIE } from '@/lib/client-identity'
import { PasswordGate } from '@/components/PasswordGate'
import { NameGate } from '@/components/NameGate'
import { ClientGallery } from '@/components/ClientGallery'

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params
  const album = await prisma.album.findUnique({
    where: { shareToken },
    include: { photos: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!album) {
    notFound()
  }

  const cookieStore = await cookies()

  if (album.passwordHash) {
    const unlockCookie = cookieStore.get(`album_unlock_${album.id}`)?.value
    if (!isUnlocked(album.id, unlockCookie)) {
      return <PasswordGate shareToken={shareToken} />
    }
  }

  const nameCookie = cookieStore.get(CLIENT_NAME_COOKIE)?.value
  if (!nameCookie) {
    return <NameGate />
  }

  return (
    <main>
      <h1>{album.name}</h1>
      <ClientGallery photos={album.photos} />
    </main>
  )
}
```

- [ ] **Step 2: Commit** (build verification happens after Task 7, once the imported components exist)

```bash
git add src/app/a/\[shareToken\]/page.tsx
git commit -m "Add public share page with password/name gate branching"
```

---

### Task 6: Gate components — password entry and name entry

**Files:**
- Create: `src/components/PasswordGate.tsx`
- Test: `tests/components/PasswordGate.test.tsx`
- Create: `src/components/NameGate.tsx`
- Test: `tests/components/NameGate.test.tsx`

**Interfaces:**
- Consumes: `POST /api/share/[shareToken]/unlock` (Task 4, via `fetch`).
- Consumes: `POST /api/share/identify` (Task 4, via `fetch`).
- Produces: `PasswordGate({ shareToken }: { shareToken: string })` and `NameGate()` React components, both consumed by Task 5's page (already written, so this task makes that page's imports resolve).

- [ ] **Step 1: Write the failing tests for `PasswordGate`**

`tests/components/PasswordGate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PasswordGate } from '@/components/PasswordGate'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('PasswordGate', () => {
  it('submits the password and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as never)

    render(<PasswordGate shareToken="token_1" />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/share/token_1/unlock',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret' }),
      })
    )
  })

  it('shows an error message on an incorrect password', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Incorrect password' }),
    } as never)

    render(<PasswordGate shareToken="token_1" />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/PasswordGate.test.tsx`
Expected: FAIL — cannot find module `@/components/PasswordGate`.

- [ ] **Step 3: Write `src/components/PasswordGate.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function PasswordGate({ shareToken }: { shareToken: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/share/${shareToken}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Enter password</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/components/PasswordGate.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing tests for `NameGate`**

`tests/components/NameGate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NameGate } from '@/components/NameGate'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('NameGate', () => {
  it('submits the name and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as never)

    render(<NameGate />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Jane Doe' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/share/identify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Jane Doe' }),
      })
    )
  })

  it('shows an error message when the name is rejected', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A valid name is required' }),
    } as never)

    render(<NameGate />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A valid name is required')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/components/NameGate.test.tsx`
Expected: FAIL — cannot find module `@/components/NameGate`.

- [ ] **Step 7: Write `src/components/NameGate.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function NameGate() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/share/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>What&apos;s your name?</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Your name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Continuing…' : 'Continue'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run tests/components/NameGate.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/PasswordGate.tsx tests/components/PasswordGate.test.tsx src/components/NameGate.tsx tests/components/NameGate.test.tsx
git commit -m "Add password and name gate components for client album access"
```

---

### Task 7: Gallery and lightbox

**Files:**
- Create: `src/components/ClientGallery.tsx`
- Test: `tests/components/ClientGallery.test.tsx`

**Interfaces:**
- Consumes: nothing new — takes a `photos` array (shape matching Prisma's `Photo` rows) as a prop from Task 5's page.
- Produces: `ClientGallery({ photos }: { photos: { id: string; thumbnailUrl: string; previewUrl: string; version: number }[] })`, consumed by Task 5's already-written page (this is the last piece that page needs to actually build).

- [ ] **Step 1: Write the failing tests**

`tests/components/ClientGallery.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientGallery } from '@/components/ClientGallery'

const photos = [
  { id: 'p1', thumbnailUrl: 'https://blob/p1-thumb.jpg', previewUrl: 'https://blob/p1-preview.jpg', version: 1 },
  { id: 'p2', thumbnailUrl: 'https://blob/p2-thumb.jpg', previewUrl: 'https://blob/p2-preview.jpg', version: 2 },
  { id: 'p3', thumbnailUrl: 'https://blob/p3-thumb.jpg', previewUrl: 'https://blob/p3-preview.jpg', version: 1 },
]

describe('ClientGallery', () => {
  it('renders a thumbnail for every photo and no lightbox initially', () => {
    render(<ClientGallery photos={photos} />)

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the lightbox showing the preview image when a thumbnail is clicked', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    const dialog = screen.getByRole('dialog')
    const dialogImage = dialog.querySelector('img')
    expect(dialogImage?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('navigates to the next photo and closes the lightbox', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    let dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: FAIL — cannot find module `@/components/ClientGallery`.

- [ ] **Step 3: Write `src/components/ClientGallery.tsx`**

```tsx
'use client'

import { useState } from 'react'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
}

export function ClientGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button type="button" onClick={() => setOpenIndex(index)}>
              <img src={photo.thumbnailUrl} alt="" width={200} />
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <div role="dialog" aria-label="Photo preview">
          <button type="button" onClick={() => setOpenIndex(null)}>
            Close
          </button>
          {openIndex > 0 && (
            <button type="button" onClick={() => setOpenIndex(openIndex - 1)}>
              Previous
            </button>
          )}
          <img src={photos[openIndex].previewUrl} alt="" />
          {openIndex < photos.length - 1 && (
            <button type="button" onClick={() => setOpenIndex(openIndex + 1)}>
              Next
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the whole app builds**

Now that `PasswordGate`, `NameGate`, and `ClientGallery` all exist, Task 5's `src/app/a/[shareToken]/page.tsx` can resolve its imports.

Run: `npx next build`
Expected: build succeeds with no type errors, including the new `/a/[shareToken]` route.

- [ ] **Step 6: Commit**

```bash
git add src/components/ClientGallery.tsx tests/components/ClientGallery.test.tsx
git commit -m "Add client gallery grid with lightbox preview"
```

---

### Task 8: Manual end-to-end verification

This exercises the one thing that can't be meaningfully unit-tested: browsing the real public share page as an anonymous visitor, in a browser session with no NextAuth cookie. Do this after Tasks 1–7 are complete and committed.

**Prerequisites:**
- Plans 1 and 2's manual verification already done (at least one album exists with a few uploaded photos).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Set a password on the album**

Sign in as the photographer, open the album's detail page (`/albums/<id>`), note the displayed share link (`/a/<shareToken>`), and use the password field to set a password (e.g. `test1234`).

- [ ] **Step 3: Open the share link in a private/incognito window**

Visit `http://localhost:3000/a/<shareToken>` in a private browsing window (so no existing cookies/session leak in). Expected: the password gate appears (not the gallery, not the sign-in page — this route must never redirect to `/api/auth/signin`).

- [ ] **Step 4: Try an incorrect password**

Enter a wrong password. Expected: an error message appears, still on the password gate.

- [ ] **Step 5: Enter the correct password**

Expected: the page refreshes and now shows the name-entry gate (not the gallery yet).

- [ ] **Step 6: Enter a name**

Expected: the page refreshes and now shows the photo grid — thumbnails for every uploaded photo.

- [ ] **Step 7: Open the lightbox**

Click a thumbnail. Expected: a larger preview image opens, with Next/Previous navigation between photos and a Close control.

- [ ] **Step 8: Confirm the cookies persisted**

Reload `http://localhost:3000/a/<shareToken>` (same private window, same tab). Expected: the gallery loads directly — no password prompt, no name prompt (both cookies are remembered for that browser).

- [ ] **Step 9: Confirm an album with no password skips the password gate**

Create or use an album with no password set (or use "Remove password" on the one from Step 2), visit its share link in a *fresh* private window with no cookies at all. Expected: the password gate never appears; only the name gate, then the gallery.
