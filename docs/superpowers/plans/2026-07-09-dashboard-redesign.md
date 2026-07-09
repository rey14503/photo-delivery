# Dashboard & Album-List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the unstyled `src/app/albums/page.tsx` into a rich, responsive, ShotPik-inspired Dashboard featuring a dark/sleek global design system, top navigation bar, metrics toolbar, and an interactive card grid with an inline modal-powered "Create Album" affordance.

**Architecture:** We introduce a global CSS variables/design system in `globals.css` (`#121214` dark surface baseline with `#FF5722` coral accent corresponding to our branding). The dashboard is structured into modular, reusable components (`TopNav`, `DashboardToolbar`, `AlbumCard`, `CreateAlbumModal`, and `AlbumGrid`) following strictly our TDD discipline (`npx vitest run`).

**Tech Stack:** Next.js 15 App Router, React 19, Vanilla CSS Modules (`*.module.css`), Vitest + Testing Library, Prisma ORM.

## Global Constraints

- Must run all unit tests with `npx vitest run` after every step and ensure 100% pass rate.
- Must ensure production build passes with `npx next build` with zero type or compile errors.
- Preserve all existing functionality and access gates (`resolveActor`, `albumScopeFor`).
- Avoid TailwindCSS (use pure Vanilla CSS / CSS Modules).

---

### Task 1: Global Design System Baseline (`src/app/globals.css` + `src/app/layout.tsx`)

**Files:**
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Existing HTML structure across app.
- Produces: CSS custom properties (`--bg-base`, `--bg-surface`, `--bg-surface-hover`, `--border-color`, `--text-main`, `--text-muted`, `--accent`, `--accent-hover`, `--radius-sm`, `--radius-md`, `--radius-lg`) used across all components.

- [ ] **Step 1: Create `src/app/globals.css`**

```css
:root {
  --bg-base: #121214;
  --bg-surface: #1c1c1f;
  --bg-surface-hover: #26262b;
  --border-color: #2e2e33;
  --text-main: #f4f4f5;
  --text-muted: #a1a1aa;
  --accent: #ff5722;
  --accent-hover: #e64a19;
  --danger: #ef4444;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.6);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-base);
  color: var(--text-main);
  line-height: 1.5;
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input {
  font-family: inherit;
}
```

- [ ] **Step 2: Modify `src/app/layout.tsx` to import `globals.css`**

```tsx
import type { ReactNode } from 'react'
import './globals.css'

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

- [ ] **Step 3: Run existing unit tests and build to verify no breaking changes**

Run: `npx vitest run && npx next build`
Expected: All 187 tests pass, Next.js build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "Add sleek dark mode design system tokens in globals.css and import into root layout"
```

---

### Task 2: `TopNav` Component (`src/components/TopNav.tsx` + `TopNav.module.css` + `tests/components/TopNav.test.tsx`)

**Files:**
- Create: `tests/components/TopNav.test.tsx`
- Create: `src/components/TopNav.tsx`
- Create: `src/components/TopNav.module.css`

**Interfaces:**
- Consumes: `userName?: string | null`, `userEmail?: string | null`, `onCreateClick?: () => void`.
- Produces: Top navigation header with logo, title, primary CTA button ("+ Tạo album"), and signed-in user name + sign-out link.

- [ ] **Step 1: Write the failing test `tests/components/TopNav.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopNav } from '@/components/TopNav'

describe('TopNav', () => {
  it('renders logo, title, user name, and sign out link', () => {
    const onCreate = vi.fn()
    render(<TopNav userName="Khoa Nguyen" userEmail="khoa@example.com" onCreateClick={onCreate} />)

    expect(screen.getByAltText('Product Logo')).toHaveAttribute('src', '/logo.png')
    expect(screen.getByText('Photo Delivery')).toBeInTheDocument()
    expect(screen.getByText('Khoa Nguyen')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /đăng xuất/i })).toHaveAttribute('href', '/api/auth/signout')
  })

  it('calls onCreateClick when primary "+ Tạo album" CTA is clicked if handler provided', () => {
    const onCreate = vi.fn()
    render(<TopNav userName="Khoa" onCreateClick={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: /\+ tạo album/i }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('renders link to /albums/new if onCreateClick handler is not provided', () => {
    render(<TopNav userName="Khoa" />)

    expect(screen.getByRole('link', { name: /\+ tạo album/i })).toHaveAttribute('href', '/albums/new')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/TopNav.test.tsx`
Expected: FAIL due to missing component file `src/components/TopNav.tsx`.

- [ ] **Step 3: Write minimal implementation `src/components/TopNav.module.css` & `src/components/TopNav.tsx`**

Create `src/components/TopNav.module.css`:
```css
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
}

.left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-main);
}

.logo {
  height: 28px;
  width: auto;
}

.primaryBtn {
  background-color: var(--accent);
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s ease;
}

.primaryBtn:hover {
  background-color: var(--accent-hover);
}

.right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.user {
  color: var(--text-main);
  font-weight: 500;
}

.signOut {
  color: var(--text-muted);
  transition: color 0.15s ease;
}

.signOut:hover {
  color: var(--danger);
}
```

Create `src/components/TopNav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import styles from './TopNav.module.css'

export interface TopNavProps {
  userName?: string | null
  userEmail?: string | null
  onCreateClick?: () => void
}

export function TopNav({ userName, userEmail, onCreateClick }: TopNavProps) {
  const displayUser = userName || userEmail || 'Photographer'

  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        <Link href="/albums" className={styles.brand}>
          <img src="/logo.png" alt="Product Logo" className={styles.logo} />
          <span>Photo Delivery</span>
        </Link>
        {onCreateClick ? (
          <button type="button" onClick={onCreateClick} className={styles.primaryBtn}>
            + Tạo album
          </button>
        ) : (
          <Link href="/albums/new" className={styles.primaryBtn}>
            + Tạo album
          </Link>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.user}>{displayUser}</span>
        <Link href="/api/auth/signout" className={styles.signOut}>
          Đăng xuất
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/TopNav.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TopNav.tsx src/components/TopNav.module.css tests/components/TopNav.test.tsx
git commit -m "Add TopNav component with brand logo, create action, and user info"
```

---

### Task 3: `DashboardToolbar` Component (`src/components/DashboardToolbar.tsx` + `DashboardToolbar.module.css` + `tests/components/DashboardToolbar.test.tsx`)

**Files:**
- Create: `tests/components/DashboardToolbar.test.tsx`
- Create: `src/components/DashboardToolbar.tsx`
- Create: `src/components/DashboardToolbar.module.css`

**Interfaces:**
- Consumes: `albumCount: number`, `photoCount: number`.
- Produces: Sub-header bar displaying section title ("Bảng điều khiển") and summary metrics pills.

- [ ] **Step 1: Write the failing test `tests/components/DashboardToolbar.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardToolbar } from '@/components/DashboardToolbar'

describe('DashboardToolbar', () => {
  it('renders dashboard title and correct metric counters', () => {
    render(<DashboardToolbar albumCount={5} photoCount={128} />)

    expect(screen.getByText('Bảng điều khiển')).toBeInTheDocument()
    expect(screen.getByText('Tổng số album: 5')).toBeInTheDocument()
    expect(screen.getByText('Tổng số ảnh: 128')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/DashboardToolbar.test.tsx`
Expected: FAIL due to missing `DashboardToolbar.tsx`.

- [ ] **Step 3: Write minimal implementation `src/components/DashboardToolbar.module.css` & `src/components/DashboardToolbar.tsx`**

Create `src/components/DashboardToolbar.module.css`:
```css
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
  max-width: 1300px;
  margin: 0 auto;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
}

.metrics {
  display: flex;
  gap: 12px;
}

.pill {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}
```

Create `src/components/DashboardToolbar.tsx`:
```tsx
'use client'

import styles from './DashboardToolbar.module.css'

export interface DashboardToolbarProps {
  albumCount: number
  photoCount: number
}

export function DashboardToolbar({ albumCount, photoCount }: DashboardToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <h1 className={styles.title}>Bảng điều khiển</h1>
      <div className={styles.metrics}>
        <span className={styles.pill}>Tổng số album: {albumCount}</span>
        <span className={styles.pill}>Tổng số ảnh: {photoCount}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/DashboardToolbar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardToolbar.tsx src/components/DashboardToolbar.module.css tests/components/DashboardToolbar.test.tsx
git commit -m "Add DashboardToolbar component displaying title and album/photo statistics"
```

---

### Task 4: `AlbumCard` Component (`src/components/AlbumCard.tsx` + `AlbumCard.module.css` + `tests/components/AlbumCard.test.tsx`)

**Files:**
- Create: `tests/components/AlbumCard.test.tsx`
- Create: `src/components/AlbumCard.tsx`
- Create: `src/components/AlbumCard.module.css`

**Interfaces:**
- Consumes: `album: { id: string, name: string, clientName: string, shareToken: string, hasPassword: boolean, photoCount: number, createdAt: string | Date }`.
- Produces: Sleek card with details, badge, and navigation actions (`Xem album`, `Copy link`).

- [ ] **Step 1: Write the failing test `tests/components/AlbumCard.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlbumCard } from '@/components/AlbumCard'

describe('AlbumCard', () => {
  const sampleAlbum = {
    id: 'alb_1',
    name: 'Tiệc Cưới Jane & John',
    clientName: 'Jane Doe',
    shareToken: 'tok_abc123',
    hasPassword: true,
    photoCount: 45,
    createdAt: new Date('2026-07-01T10:00:00Z'),
  }

  it('renders album name, client, photo count, lock status, and formatted date', () => {
    render(<AlbumCard album={sampleAlbum} />)

    expect(screen.getByText('Tiệc Cưới Jane & John')).toBeInTheDocument()
    expect(screen.getByText('Khách hàng: Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('45 ảnh')).toBeInTheDocument()
    expect(screen.getByText('🔒 Có mật khẩu')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /xem album/i })).toHaveAttribute('href', '/albums/alb_1')
  })

  it('renders unlocked badge when hasPassword is false', () => {
    render(<AlbumCard album={{ ...sampleAlbum, hasPassword: false }} />)

    expect(screen.getByText('🔓 Mở')).toBeInTheDocument()
  })

  it('copies share link to clipboard when Copy link button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } })

    render(<AlbumCard album={sampleAlbum} />)
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/a/tok_abc123'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/AlbumCard.test.tsx`
Expected: FAIL due to missing `AlbumCard.tsx`.

- [ ] **Step 3: Write minimal implementation `src/components/AlbumCard.module.css` & `src/components/AlbumCard.tsx`**

Create `src/components/AlbumCard.module.css`:
```css
.card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
}

.header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.client {
  font-size: 0.88rem;
  color: var(--text-muted);
}

.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background-color: var(--bg-base);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  padding-top: 14px;
}

.date {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.actions {
  display: flex;
  gap: 8px;
}

.btnView {
  background-color: var(--accent);
  color: #fff;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  transition: background-color 0.15s ease;
}

.btnView:hover {
  background-color: var(--accent-hover);
}

.btnCopy {
  background-color: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.btnCopy:hover {
  color: var(--text-main);
  border-color: var(--text-main);
}
```

Create `src/components/AlbumCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './AlbumCard.module.css'

export interface AlbumCardProps {
  album: {
    id: string
    name: string
    clientName: string
    shareToken: string
    hasPassword: boolean
    photoCount: number
    createdAt: string | Date
  }
}

export function AlbumCard({ album }: AlbumCardProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    await navigator.clipboard?.writeText(`${origin}/a/${album.shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateStr = new Date(album.createdAt).toLocaleDateString('vi-VN')

  return (
    <article className={styles.card}>
      <div>
        <div className={styles.header}>
          <h2 className={styles.title} title={album.name}>
            {album.name}
          </h2>
          <p className={styles.client}>Khách hàng: {album.clientName}</p>
        </div>
        <div className={styles.meta} style={{ marginTop: 12 }}>
          <span className={styles.badge}>{album.photoCount} ảnh</span>
          <span className={styles.badge}>
            {album.hasPassword ? '🔒 Có mật khẩu' : '🔓 Mở'}
          </span>
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.date}>{dateStr}</span>
        <div className={styles.actions}>
          <button type="button" onClick={handleCopy} className={styles.btnCopy}>
            {copied ? 'Đã copy!' : 'Copy link'}
          </button>
          <Link href={`/albums/${album.id}`} className={styles.btnView}>
            Xem album
          </Link>
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/AlbumCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AlbumCard.tsx src/components/AlbumCard.module.css tests/components/AlbumCard.test.tsx
git commit -m "Add AlbumCard component displaying album info, metrics badge, and share copy link"
```

---

### Task 5: `CreateAlbumModal` Component (`src/components/CreateAlbumModal.tsx` + `CreateAlbumModal.module.css` + `tests/components/CreateAlbumModal.test.tsx`)

**Files:**
- Create: `tests/components/CreateAlbumModal.test.tsx`
- Create: `src/components/CreateAlbumModal.tsx`
- Create: `src/components/CreateAlbumModal.module.css`
- Modify: `src/components/CreateAlbumForm.tsx` (Add `onSuccess?: () => void` prop to trigger modal close on submission success).

**Interfaces:**
- Consumes: `isOpen: boolean`, `onClose: () => void`.
- Produces: Modal dialog popup (`role="dialog"`) rendering `CreateAlbumForm`.

- [ ] **Step 1: Modify `src/components/CreateAlbumForm.tsx` to support optional `onSuccess` callback**

Modify `src/components/CreateAlbumForm.tsx`:
```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export interface CreateAlbumFormProps {
  onSuccess?: () => void
}

export function CreateAlbumForm({ onSuccess }: CreateAlbumFormProps = {}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clientName }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/albums')
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
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

- [ ] **Step 2: Write the failing test `tests/components/CreateAlbumModal.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateAlbumModal } from '@/components/CreateAlbumModal'

describe('CreateAlbumModal', () => {
  it('does not render anything when isOpen is false', () => {
    render(<CreateAlbumModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders modal content and form when isOpen is true', () => {
    render(<CreateAlbumModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Tạo album mới')).toBeInTheDocument()
    expect(screen.getByLabelText('Album name')).toBeInTheDocument()
  })

  it('calls onClose when close button or backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<CreateAlbumModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /đóng/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/components/CreateAlbumModal.test.tsx`
Expected: FAIL due to missing `CreateAlbumModal.tsx`.

- [ ] **Step 4: Write minimal implementation `src/components/CreateAlbumModal.module.css` & `src/components/CreateAlbumModal.tsx`**

Create `src/components/CreateAlbumModal.module.css`:
```css
.backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
}

.modal {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-md);
  position: relative;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.closeBtn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
}

.closeBtn:hover {
  color: var(--text-main);
}
```

Create `src/components/CreateAlbumModal.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { CreateAlbumForm } from './CreateAlbumForm'
import styles from './CreateAlbumModal.module.css'

export interface CreateAlbumModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateAlbumModal({ isOpen, onClose }: CreateAlbumModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Tạo album mới" className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Tạo album mới</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className={styles.closeBtn}>
            ✕
          </button>
        </div>
        <CreateAlbumForm onSuccess={onClose} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/CreateAlbumModal.test.tsx`
Expected: PASS (3 tests). Also verify all `CreateAlbumForm` tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CreateAlbumForm.tsx src/components/CreateAlbumModal.tsx src/components/CreateAlbumModal.module.css tests/components/CreateAlbumModal.test.tsx
git commit -m "Add CreateAlbumModal dialog popup wrapping CreateAlbumForm"
```

---

### Task 6: `AlbumGrid` Component & Page Refactor (`src/components/AlbumGrid.tsx` + `AlbumGrid.module.css` + `tests/components/AlbumGrid.test.tsx` + `src/app/albums/page.tsx`)

**Files:**
- Create: `tests/components/AlbumGrid.test.tsx`
- Create: `src/components/AlbumGrid.tsx`
- Create: `src/components/AlbumGrid.module.css`
- Modify: `src/app/albums/page.tsx`

**Interfaces:**
- Consumes: `albums: Array<{ id: string, name: string, clientName: string, shareToken: string, hasPassword: boolean, photoCount: number, createdAt: string | Date }>`, `userName?: string | null`, `userEmail?: string | null`.
- Produces: Responsive grid with an inline **Create Album Card** as the very first tile (`+ Tạo album`), TopNav, Toolbar, and `CreateAlbumModal`.

- [ ] **Step 1: Write the failing test `tests/components/AlbumGrid.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlbumGrid } from '@/components/AlbumGrid'

describe('AlbumGrid', () => {
  const albums = [
    {
      id: 'alb_1',
      name: 'Album 1',
      clientName: 'Client 1',
      shareToken: 'tok_1',
      hasPassword: true,
      photoCount: 10,
      createdAt: new Date('2026-07-01'),
    },
  ]

  it('renders inline create album card as first item alongside album cards', () => {
    render(<AlbumGrid albums={albums} />)

    expect(screen.getByRole('button', { name: /\+ tạo album/i })).toBeInTheDocument()
    expect(screen.getByText('Album 1')).toBeInTheDocument()
  })

  it('opens modal when inline create card or TopNav create button is clicked', () => {
    render(<AlbumGrid albums={albums} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /\+ tạo album/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/AlbumGrid.test.tsx`
Expected: FAIL due to missing `AlbumGrid.tsx`.

- [ ] **Step 3: Write minimal implementation `src/components/AlbumGrid.module.css` & `src/components/AlbumGrid.tsx`**

Create `src/components/AlbumGrid.module.css`:
```css
.container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 12px 24px 48px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.createTile {
  background-color: transparent;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  cursor: pointer;
  min-height: 200px;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.createTile:hover {
  border-color: var(--accent);
  color: var(--text-main);
  background-color: rgba(255, 87, 34, 0.03);
}

.iconPlus {
  font-size: 2.2rem;
  font-weight: 300;
  line-height: 1;
}

.labelCreate {
  font-size: 1rem;
  font-weight: 600;
}
```

Create `src/components/AlbumGrid.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { TopNav } from './TopNav'
import { DashboardToolbar } from './DashboardToolbar'
import { AlbumCard, type AlbumCardProps } from './AlbumCard'
import { CreateAlbumModal } from './CreateAlbumModal'
import styles from './AlbumGrid.module.css'

export interface AlbumGridProps {
  albums: AlbumCardProps['album'][]
  userName?: string | null
  userEmail?: string | null
}

export function AlbumGrid({ albums, userName, userEmail }: AlbumGridProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const totalPhotos = albums.reduce((acc, alb) => acc + alb.photoCount, 0)

  return (
    <>
      <TopNav userName={userName} userEmail={userEmail} onCreateClick={() => setModalOpen(true)} />
      <DashboardToolbar albumCount={albums.length} photoCount={totalPhotos} />
      <main className={styles.container}>
        <div className={styles.grid}>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={styles.createTile}
            aria-label="+ Tạo album"
          >
            <span className={styles.iconPlus}>+</span>
            <span className={styles.labelCreate}>Tạo album mới</span>
          </button>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </main>
      <CreateAlbumModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Modify `src/app/albums/page.tsx` to query photo counts and render `AlbumGrid`**

Modify `src/app/albums/page.tsx`:
```tsx
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { albumScopeFor } from '@/lib/album-scope'
import { AlbumGrid } from '@/components/AlbumGrid'

export default async function AlbumsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { photos: true },
      },
    },
  })

  const formattedAlbums = albums.map((alb) => ({
    id: alb.id,
    name: alb.name,
    clientName: alb.clientName,
    shareToken: alb.shareToken,
    hasPassword: Boolean(alb.passwordHash),
    photoCount: alb._count.photos,
    createdAt: alb.createdAt,
  }))

  return (
    <AlbumGrid
      albums={formattedAlbums}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  )
}
```

- [ ] **Step 5: Run unit tests and Next.js build to verify 100% PASS**

Run: `npx vitest run && npx next build`
Expected: All tests pass (approx 195+ tests), `next build` completes with zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/AlbumGrid.tsx src/components/AlbumGrid.module.css tests/components/AlbumGrid.test.tsx src/app/albums/page.tsx
git commit -m "Refactor Albums dashboard page to use AlbumGrid with TopNav, Toolbar, and inline modal create"
```
