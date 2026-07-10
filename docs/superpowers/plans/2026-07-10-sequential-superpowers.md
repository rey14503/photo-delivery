# Sequential Superpowers Implementation Plan (Features 1-4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sequentially implement four open-source-inspired features (Client Proofing Lock, Copy Filenames for Lightroom, Grid Zoom & Lightbox Info Panel, and Batch Download Selected ZIP) without auto watermark or link expiration, maintaining 100% English UI and exact BK Media Box Glassmorphism and inline SVG icon styling.

**Architecture:** 
- Prisma schema additions (`selectionLocked`, `selectionSubmittedAt`) to lock proofing.
- Client/Photographer UI hooks into API endpoints (`/api/albums/[albumId]/lock-selection`, `/unlock-selection`, `/download-selected`).
- Pure frontend grid column state (`--grid-cols` custom property) and lightbox sidebar overlay (`showInfo`).
- Exact inline SVG icons (`LockIcon`, `UnlockIcon`, `ClipboardListIcon`, `TxtFileIcon`, `ZoomInIcon`, `ZoomOutIcon`, `InfoOutlineIcon`, `ZipBoxIcon`) in `PhotoIcons.tsx`.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Prisma (PostgreSQL), Vitest + React Testing Library, `archiver` / Node streams.

## Global Constraints
- Everything must be in **English** (`Submit Final Selection`, `Copy Selected Filenames`, `Export Lightroom List (.TXT)`, `Download Selected (X) ZIP`, `Unlock Client Selection`, etc.).
- Icons must strictly use inline SVGs matching `PhotoIcons.tsx` (`viewBox="0 0 24 24"`, `strokeWidth="2.2" | "1.8"`, `strokeLinecap="round"`, `strokeLinejoin="round"`).
- Glassmorphism UI tokens (`var(--card-bg)`, `var(--border-color)`, `var(--accent)`, `var(--text-main)`, `var(--text-muted)`).

---

### Task 1: Icon Components & Prisma Schema for Proofing Lock

**Files:**
- Modify: `prisma/schema.prisma:28-44`
- Modify: `src/components/PhotoIcons.tsx`
- Create: `tests/components/SuperpowerIcons.test.tsx`

**Interfaces:**
- Produces: `LockIcon`, `UnlockIcon`, `ClipboardListIcon`, `TxtFileIcon`, `ZoomInIcon`, `ZoomOutIcon`, `InfoOutlineIcon`, `ZipBoxIcon` in `src/components/PhotoIcons.tsx`.
- Produces: `selectionLocked: Boolean`, `selectionSubmittedAt: DateTime?` on `Album`.

- [ ] **Step 1: Write the failing test for the new superpower icons**

```tsx
// tests/components/SuperpowerIcons.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  LockIcon,
  UnlockIcon,
  ClipboardListIcon,
  TxtFileIcon,
  ZoomInIcon,
  ZoomOutIcon,
  InfoOutlineIcon,
  ZipBoxIcon,
} from '@/components/PhotoIcons'

describe('SuperpowerIcons', () => {
  it('renders all 8 superpower icons cleanly with viewBox 0 0 24 24', () => {
    const { container } = render(
      <div>
        <LockIcon />
        <UnlockIcon />
        <ClipboardListIcon />
        <TxtFileIcon />
        <ZoomInIcon />
        <ZoomOutIcon />
        <InfoOutlineIcon />
        <ZipBoxIcon />
      </div>
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(8)
    svgs.forEach((svg) => {
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg.getAttribute('stroke-linecap')).toBe('round')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/SuperpowerIcons.test.tsx`
Expected: FAIL due to missing exported icons.

- [ ] **Step 3: Update `prisma/schema.prisma` and run migration / db push**

Add `selectionLocked` and `selectionSubmittedAt` to `Album` model in `prisma/schema.prisma`:
```prisma
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
  coverPhotoId     String?
  coverPhoto       Photo?   @relation("AlbumCoverPhoto", fields: [coverPhotoId], references: [id])
  selectionLocked  Boolean  @default(false)
  selectionSubmittedAt DateTime?
  createdAt        DateTime @default(now())
  photos           Photo[]
}
```
Run command: `npx prisma db push --accept-data-loss` and `npx prisma generate`.

- [ ] **Step 4: Implement exact SVG components in `src/components/PhotoIcons.tsx`**

Append to `src/components/PhotoIcons.tsx`:
```tsx
export function LockIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function UnlockIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

export function ClipboardListIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  )
}

export function TxtFileIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

export function ZoomInIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

export function ZoomOutIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

export function InfoOutlineIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function ZipBoxIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/components/SuperpowerIcons.test.tsx`
Expected: PASS (`1 passed`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/components/PhotoIcons.tsx tests/components/SuperpowerIcons.test.tsx
git commit -m "feat: add superpower icons and selection lock fields to Album schema"
```

---

### Task 2: Proofing Lock & Unlock API Endpoints

**Files:**
- Create: `src/app/api/albums/[albumId]/lock-selection/route.ts`
- Create: `src/app/api/albums/[albumId]/unlock-selection/route.ts`
- Create: `tests/api/albums-selection-lock.test.ts`

**Interfaces:**
- Consumes: `album.selectionLocked`, `album.selectionSubmittedAt`
- Produces: `POST /api/albums/[albumId]/lock-selection` (`{ shareToken?: string }`), `PATCH /api/albums/[albumId]/unlock-selection`

- [ ] **Step 1: Write failing test for lock/unlock selection API**

```ts
// tests/api/albums-selection-lock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/albums/[albumId]/lock-selection/route'
import { PATCH } from '@/app/api/albums/[albumId]/unlock-selection/route'

const findUniqueMock = vi.fn()
const updateMock = vi.fn()
const getServerSessionMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: () => getServerSessionMock(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('Selection Lock & Unlock API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('locks selection when shareToken matches', async () => {
    findUniqueMock.mockResolvedValue({ id: 'alb_1', shareToken: 'tok_abc', ownerId: 'user_1' })
    updateMock.mockResolvedValue({ id: 'alb_1', selectionLocked: true })

    const req = new Request('http://localhost/api/albums/alb_1/lock-selection', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alb_1' },
        data: expect.objectContaining({ selectionLocked: true }),
      })
    )
  })

  it('unlocks selection when photographer is authenticated owner', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user_1' } })
    findUniqueMock.mockResolvedValue({ id: 'alb_1', ownerId: 'user_1' })
    updateMock.mockResolvedValue({ id: 'alb_1', selectionLocked: false })

    const req = new Request('http://localhost/api/albums/alb_1/unlock-selection', {
      method: 'PATCH',
    })
    const res = await PATCH(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alb_1' },
        data: { selectionLocked: false, selectionSubmittedAt: null },
      })
    )
  })

  it('rejects unlock if photographer is not owner', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'other_user' } })
    findUniqueMock.mockResolvedValue({ id: 'alb_1', ownerId: 'user_1' })

    const req = new Request('http://localhost/api/albums/alb_1/unlock-selection', {
      method: 'PATCH',
    })
    const res = await PATCH(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/albums-selection-lock.test.ts`
Expected: FAIL due to missing routes.

- [ ] **Step 3: Implement `lock-selection/route.ts` and `unlock-selection/route.ts`**

Create `src/app/api/albums/[albumId]/lock-selection/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params
    const body = await req.json().catch(() => ({}))
    const { shareToken } = body as { shareToken?: string }

    const album = await prisma.album.findUnique({ where: { id: albumId } })
    if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

    const session = await getServerSession(authOptions)
    const isOwner = session?.user?.id && session.user.id === album.ownerId
    const isClientWithToken = shareToken && shareToken === album.shareToken

    if (!isOwner && !isClientWithToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updated = await prisma.album.update({
      where: { id: albumId },
      data: {
        selectionLocked: true,
        selectionSubmittedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      selectionLocked: updated.selectionLocked,
      selectionSubmittedAt: updated.selectionSubmittedAt,
    })
  } catch (err) {
    console.error('Lock selection error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

Create `src/app/api/albums/[albumId]/unlock-selection/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const album = await prisma.album.findUnique({ where: { id: albumId } })
    if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

    if (album.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.album.update({
      where: { id: albumId },
      data: {
        selectionLocked: false,
        selectionSubmittedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      selectionLocked: updated.selectionLocked,
    })
  } catch (err) {
    console.error('Unlock selection error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/albums-selection-lock.test.ts`
Expected: PASS (`3 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/albums/[albumId]/lock-selection/route.ts src/app/api/albums/[albumId]/unlock-selection/route.ts tests/api/albums-selection-lock.test.ts
git commit -m "feat: implement lock-selection and unlock-selection API routes"
```

---

### Task 3: Floating Selection Bar & Client Proofing Lock UI

**Files:**
- Modify: `src/components/ClientGallery.tsx`
- Modify: `src/components/ClientGallery.module.css`
- Modify: `src/app/a/[shareToken]/page.tsx`
- Modify: `tests/components/ClientGallery.test.tsx`

**Interfaces:**
- Consumes: `albumId`, `selectionLocked` prop in `ClientGalleryProps`.
- Produces: Floating submission bar, confirmation modal, disabled heart buttons when `selectionLocked === true`.

- [ ] **Step 1: Write failing test in `tests/components/ClientGallery.test.tsx`**

Add to `tests/components/ClientGallery.test.tsx`:
```tsx
it('renders floating selection bar when photos are selected, triggers confirmation modal and lock selection', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  global.fetch = fetchMock

  render(
    <ClientGallery
      albumId="alb_123"
      shareToken="tok_123"
      initialPhotos={[{ ...basePhoto, id: 'photo_1', liked: true }]}
      selectionLocked={false}
    />
  )

  expect(screen.getByText('Selected: 1 photo(s)')).toBeInTheDocument()
  const submitBtn = screen.getByRole('button', { name: /submit final selection/i })
  fireEvent.click(submitBtn)

  expect(screen.getByText(/Are you sure you want to submit your selection of 1 photo/i)).toBeInTheDocument()
  const confirmBtn = screen.getByRole('button', { name: /confirm & submit/i })
  await act(async () => {
    fireEvent.click(confirmBtn)
  })

  expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb_123/lock-selection', expect.any(Object))
})

it('disables like button on ClientPhotoTile and shows submitted banner when selectionLocked is true', () => {
  render(
    <ClientGallery
      albumId="alb_123"
      shareToken="tok_123"
      initialPhotos={[{ ...basePhoto, id: 'photo_1', liked: true }]}
      selectionLocked={true}
    />
  )

  expect(screen.getByText(/Selection Submitted/i)).toBeInTheDocument()
  const likeBtn = screen.getByRole('button', { name: 'Select photo' })
  expect(likeBtn).toBeDisabled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: FAIL due to missing `Submit Final Selection` bar and disabled behavior.

- [ ] **Step 3: Implement `selectionLocked` logic and floating bar in `ClientGallery.tsx`**

Update `ClientGalleryProps` in `src/components/ClientGallery.tsx`:
```tsx
export interface ClientGalleryProps {
  albumId?: string
  shareToken?: string
  initialPhotos: ClientPhoto[]
  albumInfo?: {
    title: string
    actorName?: string
    location?: string
    date?: string
  }
  selectionLocked?: boolean
}
```
Inside `ClientGallery`:
```tsx
const [isSelectionLocked, setIsSelectionLocked] = useState(Boolean(props.selectionLocked))
const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
const [submittingLock, setSubmittingLock] = useState(false)

async function handleConfirmSubmit() {
  if (!props.albumId) return
  setSubmittingLock(true)
  try {
    const res = await fetch(`/api/albums/${props.albumId}/lock-selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareToken: props.shareToken }),
    })
    if (res.ok) {
      setIsSelectionLocked(true)
      setShowSubmitConfirm(false)
    }
  } finally {
    setSubmittingLock(false)
  }
}
```
Pass `toggling={toggling || isSelectionLocked}` to `ClientPhotoTile` and `PhotoLightbox`.
Add floating bar & confirmation modal at bottom of JSX inside `ClientGallery`:
```tsx
{/* Floating Selection Bar */}
{(selectedCount > 0 || isSelectionLocked) && (
  <div className={styles.floatingBar}>
    {isSelectionLocked ? (
      <div className={styles.floatingBarLocked}>
        <span>🔒 Selection Submitted — Thank you! Your photographer is reviewing your selected photos.</span>
      </div>
    ) : (
      <div className={styles.floatingBarActive}>
        <span className={styles.floatingBarText}>Selected: {selectedCount} photo(s)</span>
        <button
          type="button"
          onClick={() => setShowSubmitConfirm(true)}
          className={styles.submitSelectionBtn}
        >
          Submit Final Selection
        </button>
      </div>
    )}
  </div>
)}

{/* Confirm Submit Modal */}
{showSubmitConfirm && (
  <div className={styles.modalOverlay} onClick={() => setShowSubmitConfirm(false)}>
    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
      <h3 className={styles.modalTitle}>Confirm Final Selection</h3>
      <p className={styles.modalText}>
        Are you sure you want to submit your selection of <strong>{selectedCount} photo(s)</strong>? Once submitted, you won't be able to add or remove selections unless the photographer unlocks the album.
      </p>
      <div className={styles.modalActions}>
        <button
          type="button"
          onClick={() => setShowSubmitConfirm(false)}
          className={styles.modalCancelBtn}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirmSubmit}
          disabled={submittingLock}
          className={styles.modalConfirmBtn}
        >
          {submittingLock ? 'Submitting...' : 'Confirm & Submit'}
        </button>
      </div>
    </div>
  </div>
)}
```

Add CSS styles to `ClientGallery.module.css`:
```css
.floatingBar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  width: calc(100% - 48px);
  max-width: 680px;
}

.floatingBarActive, .floatingBarLocked {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-radius: var(--radius-lg, 16px);
  background: rgba(30, 30, 36, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
  box-shadow: var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.5));
  color: var(--text-main, #ffffff);
  gap: 16px;
}

.floatingBarLocked {
  justify-content: center;
  background: rgba(16, 185, 129, 0.18);
  border-color: rgba(16, 185, 129, 0.35);
  color: #34d399;
  font-weight: 600;
}

.floatingBarText {
  font-weight: 600;
  font-size: 0.95rem;
}

.submitSelectionBtn {
  background: var(--accent, #ff5722);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 8px 18px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.submitSelectionBtn:hover {
  background: var(--accent-hover, #e64a19);
  transform: translateY(-1px);
}
```

Update `src/app/a/[shareToken]/page.tsx` to pass `selectionLocked={album.selectionLocked}` to `<ClientGallery />`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: PASS (`12 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ClientGallery.tsx src/components/ClientGallery.module.css src/app/a/[shareToken]/page.tsx tests/components/ClientGallery.test.tsx
git commit -m "feat: add Client Proofing Lock UI and Floating Selection Bar to ClientGallery"
```

---

### Task 4: Photographer Proofing Badge & Unlock Control

**Files:**
- Modify: `src/components/PhotographerGallery.tsx`
- Modify: `src/components/PhotographerGallery.module.css`
- Modify: `src/app/albums/[albumId]/page.tsx`
- Modify: `tests/components/PhotographerGallery.test.tsx`

**Interfaces:**
- Consumes: `albumId`, `selectionLocked: boolean` prop on `PhotographerGalleryProps`.
- Produces: `✅ CLIENT SUBMITTED ({selectedCount} PHOTOS)` badge and `Unlock Client Selection` toolbar action.

- [ ] **Step 1: Write failing test in `tests/components/PhotographerGallery.test.tsx`**

Add to `tests/components/PhotographerGallery.test.tsx`:
```tsx
it('renders CLIENT SUBMITTED badge and Unlock Client Selection button when selectionLocked is true', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  global.fetch = fetchMock

  render(
    <PhotographerGallery
      albumId="alb_123"
      albumName="Wedding Album"
      clientName="John Doe"
      shareToken="tok_abc"
      initialPhotos={[{ ...basePhoto, id: 'p1', clientLikers: ['John Doe'] }]}
      selectionLocked={true}
    />
  )

  expect(screen.getByText(/CLIENT SUBMITTED/i)).toBeInTheDocument()
  const unlockBtn = screen.getByRole('button', { name: /unlock client selection/i })
  await act(async () => {
    fireEvent.click(unlockBtn)
  })

  expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb_123/unlock-selection', expect.any(Object))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/PhotographerGallery.test.tsx`
Expected: FAIL due to missing badge and `Unlock Client Selection` button.

- [ ] **Step 3: Update `PhotographerGallery.tsx` and styles**

In `PhotographerGalleryProps`, add `selectionLocked?: boolean`.
Inside `PhotographerGallery`:
```tsx
const [isLocked, setIsLocked] = useState(Boolean(props.selectionLocked))
const [unlocking, setUnlocking] = useState(false)

async function handleUnlockSelection() {
  if (!props.albumId) return
  setUnlocking(true)
  try {
    const res = await fetch(`/api/albums/${props.albumId}/unlock-selection`, { method: 'PATCH' })
    if (res.ok) setIsLocked(false)
  } finally {
    setUnlocking(false)
  }
}
```
In the banner header next to `modeBadge`:
```tsx
{isLocked ? (
  <span className={styles.submittedBadge}>
    ✅ CLIENT SUBMITTED ({clientLikedPhotosCount} PHOTOS)
  </span>
) : (
  <span className={styles.proofingBadge}>⏳ PROOFING IN PROGRESS</span>
)}
```
In the toolbar right control row (`bannerRight` / toolbar):
```tsx
{isLocked && (
  <button
    type="button"
    onClick={handleUnlockSelection}
    disabled={unlocking}
    className={styles.unlockBtn}
  >
    <UnlockIcon size={16} />
    {unlocking ? 'Unlocking...' : 'Unlock Client Selection'}
  </button>
)}
```
Pass `selectionLocked={album.selectionLocked}` inside `src/app/albums/[albumId]/page.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/PhotographerGallery.test.tsx`
Expected: PASS (`9 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/components/PhotographerGallery.tsx src/components/PhotographerGallery.module.css src/app/albums/[albumId]/page.tsx tests/components/PhotographerGallery.test.tsx
git commit -m "feat: add proofing status badge and Unlock Selection control to PhotographerGallery"
```

---

### Task 5: Copy Filenames for Lightroom / Capture One (`Pro-Workflow`)

**Files:**
- Modify: `src/components/PhotographerGallery.tsx`
- Modify: `src/components/PhotographerGallery.module.css`
- Modify: `tests/components/PhotographerGallery.test.tsx`

**Interfaces:**
- Produces: `Copy Selected Filenames` & `Export Lightroom List (.TXT)` action buttons in `PhotographerGallery` toolbar.

- [ ] **Step 1: Write failing test for Lightroom filenames copy & export**

Add to `tests/components/PhotographerGallery.test.tsx`:
```tsx
it('copies selected filenames to clipboard and triggers .TXT download for Lightroom workflow', async () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } })

  const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url')
  const revokeObjectURLMock = vi.fn()
  global.URL.createObjectURL = createObjectURLMock
  global.URL.revokeObjectURL = revokeObjectURLMock

  render(
    <PhotographerGallery
      albumId="alb_123"
      albumName="Wedding Album"
      clientName="John Doe"
      shareToken="tok_abc"
      initialPhotos={[
        { ...basePhoto, id: 'p1', name: 'IMG_0123.CR2', clientLikers: ['John Doe'] },
        { ...basePhoto, id: 'p2', name: 'IMG_0145.CR2', clientLikers: ['John Doe'] },
      ]}
    />
  )

  const copyBtn = screen.getByRole('button', { name: /copy selected filenames/i })
  await act(async () => {
    fireEvent.click(copyBtn)
  })
  expect(writeTextMock).toHaveBeenCalledWith('IMG_0123.CR2, IMG_0145.CR2')

  const exportBtn = screen.getByRole('button', { name: /export lightroom list \(.txt\)/i })
  fireEvent.click(exportBtn)
  expect(createObjectURLMock).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/PhotographerGallery.test.tsx`
Expected: FAIL due to missing copy/export buttons.

- [ ] **Step 3: Implement `Copy Filenames` & `Export .TXT` in `PhotographerGallery.tsx`**

Inside `PhotographerGallery`:
```tsx
const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

function getSelectedFilenamesList(): string[] {
  const clientSelected = photos.filter((p) => p.clientLikers.length > 0)
  const targetPhotos = clientSelected.length > 0 ? clientSelected : photos.filter((p) => p.suggestedByMe)
  return targetPhotos.map((p) => p.name && p.name.trim() ? p.name.trim() : p.id)
}

async function handleCopyFilenames() {
  const list = getSelectedFilenamesList()
  if (list.length === 0) {
    setCopyFeedback('No selected photos to copy')
    setTimeout(() => setCopyFeedback(null), 3000)
    return
  }
  const str = list.join(', ')
  await navigator.clipboard?.writeText(str)
  setCopyFeedback(`Copied ${list.length} filenames to clipboard!`)
  setTimeout(() => setCopyFeedback(null), 3000)
}

function handleExportTxt() {
  const list = getSelectedFilenamesList()
  if (list.length === 0) return
  const content = list.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.albumName.replace(/[^a-zA-Z0-9-_]/g, '_')}-selected-filenames.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```
Add action buttons in the toolbar / `bannerRight` row:
```tsx
<div className={styles.lightroomActionsGroup}>
  <button
    type="button"
    onClick={handleCopyFilenames}
    className={styles.toolbarActionBtn}
    title="Copy comma-separated filenames for Lightroom filter"
  >
    <ClipboardListIcon size={16} />
    Copy Selected Filenames
  </button>
  <button
    type="button"
    onClick={handleExportTxt}
    className={styles.toolbarActionBtn}
    title="Download .txt list of filenames for editing"
  >
    <TxtFileIcon size={16} />
    Export Lightroom List (.TXT)
  </button>
  {copyFeedback && <span className={styles.copyFeedbackBadge}>{copyFeedback}</span>}
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/PhotographerGallery.test.tsx`
Expected: PASS (`10 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/components/PhotographerGallery.tsx src/components/PhotographerGallery.module.css tests/components/PhotographerGallery.test.tsx
git commit -m "feat: add Copy Selected Filenames and Export .TXT controls for Lightroom workflow"
```

---

### Task 6: Dynamic Grid Zoom (`[ - ] / [ + ]`) & Photo Info Panel (`[ i ]`)

**Files:**
- Modify: `src/components/ClientGallery.tsx` & `ClientGallery.module.css`
- Modify: `src/components/PhotographerGallery.tsx` & `PhotographerGallery.module.css`
- Modify: `src/components/PhotoLightbox.tsx` & `PhotoLightbox.module.css`
- Modify: `tests/components/PhotoLightbox.test.tsx`

**Interfaces:**
- Produces: `gridLevel` state (`small`, `normal`, `large`) and controls on toolbar.
- Produces: `[ i ]` button and glass sidebar info overlay on `PhotoLightbox`.

- [ ] **Step 1: Write failing test in `tests/components/PhotoLightbox.test.tsx`**

Add to `tests/components/PhotoLightbox.test.tsx`:
```tsx
it('toggles Photo Info sidebar panel when [i] button is clicked, showing original filename and details', () => {
  render(
    <PhotoLightbox
      photo={{
        id: 'p1',
        thumbnailUrl: '/thumb.jpg',
        previewUrl: '/preview.jpg',
        name: 'IMG_0123.CR2',
        version: 2,
        liked: true,
        likeIcon: 'heart',
        likeLabel: 'Like',
        commentCount: 1,
        showDownload: true,
        downloadHref: '/dl',
        showReplace: false,
      }}
      hasPrevious={false}
      hasNext={false}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onToggleLike={vi.fn()}
      onReplace={vi.fn()}
      onClose={vi.fn()}
    />
  )

  expect(screen.queryByTestId('photo-info-panel')).not.toBeInTheDocument()
  const infoBtn = screen.getByRole('button', { name: /photo info/i })
  fireEvent.click(infoBtn)

  const panel = screen.getByTestId('photo-info-panel')
  expect(panel).toBeInTheDocument()
  expect(screen.getByText('IMG_0123.CR2')).toBeInTheDocument()
  expect(screen.getByText(/Version 2/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/PhotoLightbox.test.tsx`
Expected: FAIL due to missing `Photo Info` toggle button and panel.

- [ ] **Step 3: Implement Grid Zoom in `ClientGallery` and `PhotographerGallery`, plus Info Panel in `PhotoLightbox`**

In `PhotoLightbox.tsx`:
```tsx
const [showInfoPanel, setShowInfoPanel] = useState(false)
```
Add `<button type="button" onClick={() => setShowInfoPanel(!showInfoPanel)} aria-label="Photo Info" className={styles.iconBtn}><InfoOutlineIcon size={20} /></button>` in top controls bar.
When `showInfoPanel === true`, render:
```tsx
<div data-testid="photo-info-panel" className={styles.infoPanel}>
  <div className={styles.infoPanelHeader}>
    <h4>Photo Information</h4>
    <button type="button" onClick={() => setShowInfoPanel(false)} aria-label="Close info">✕</button>
  </div>
  <div className={styles.infoPanelBody}>
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>Original File:</span>
      <span className={styles.infoValue}>{photo.name || 'Untitled photo'}</span>
    </div>
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>Version:</span>
      <span className={styles.infoValue}>Version {photo.version}</span>
    </div>
    {photo.statusNote && (
      <div className={styles.infoRow}>
        <span className={styles.infoLabel}>Note:</span>
        <span className={styles.infoValue}>{photo.statusNote}</span>
      </div>
    )}
  </div>
</div>
```
In `ClientGallery.tsx` and `PhotographerGallery.tsx`:
```tsx
const [gridLevel, setGridLevel] = useState<'small' | 'normal' | 'large'>('normal')
```
Add zoom controls:
```tsx
<div className={styles.gridZoomGroup} role="group" aria-label="Grid Zoom">
  <button
    type="button"
    onClick={() => setGridLevel('small')}
    aria-label="Small grid (6 columns)"
    className={`${styles.gridZoomBtn} ${gridLevel === 'small' ? styles.gridZoomActive : ''}`}
  >
    <ZoomOutIcon size={16} />
  </button>
  <button
    type="button"
    onClick={() => setGridLevel('normal')}
    aria-label="Normal grid (4 columns)"
    className={`${styles.gridZoomBtn} ${gridLevel === 'normal' ? styles.gridZoomActive : ''}`}
  >
    4
  </button>
  <button
    type="button"
    onClick={() => setGridLevel('large')}
    aria-label="Large grid (2 columns)"
    className={`${styles.gridZoomBtn} ${gridLevel === 'large' ? styles.gridZoomActive : ''}`}
  >
    <ZoomInIcon size={16} />
  </button>
</div>
```
Apply `className={`${styles.grid} ${styles[`grid_${gridLevel}`]}`}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/PhotoLightbox.test.tsx tests/components/ClientGallery.test.tsx`
Expected: PASS (`22 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ClientGallery.tsx src/components/PhotographerGallery.tsx src/components/PhotoLightbox.tsx src/components/*.module.css tests/components/PhotoLightbox.test.tsx
git commit -m "feat: add Dynamic Grid Zoom and Lightbox Photo Info Panel"
```

---

### Task 7: Batch Download Selected ZIP (`Download Selected (X) ZIP`)

**Files:**
- Create: `src/app/api/albums/[albumId]/download-selected/route.ts`
- Modify: `src/components/ClientGallery.tsx` & `PhotographerGallery.tsx`
- Create: `tests/api/albums-download-selected.test.ts`

**Interfaces:**
- Consumes: `photoIds: string[]`, `shareToken?: string`
- Produces: `POST /api/albums/[albumId]/download-selected` (ZIP archive response), `Download Selected ({selectedCount}) ZIP` button on UI.

- [ ] **Step 1: Write failing test in `tests/api/albums-download-selected.test.ts`**

```ts
// tests/api/albums-download-selected.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/albums/[albumId]/download-selected/route'

const findUniqueMock = vi.fn()
const findManyMock = vi.fn()
const getDriveFileMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    album: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
    photo: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}))

vi.mock('@/lib/drive', () => ({
  getDriveFile: (...args: unknown[]) => getDriveFileMock(...args),
}))

vi.mock('archiver', () => ({
  default: () => ({
    append: vi.fn(),
    finalize: vi.fn(),
    on: vi.fn(),
    pipe: vi.fn(),
  }),
}))

describe('Download Selected ZIP API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams ZIP containing requested selected photo IDs when authorized via shareToken', async () => {
    findUniqueMock.mockResolvedValue({ id: 'alb_1', name: 'Test Album', shareToken: 'tok_abc', downloadEnabled: true })
    findManyMock.mockResolvedValue([
      { id: 'photo_1', driveFileId: 'drv_1', originalName: 'IMG_1.JPG' },
    ])

    const req = new Request('http://localhost/api/albums/alb_1/download-selected', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc', photoIds: ['photo_1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('zip')
  })

  it('rejects download if downloadEnabled is false and no photographer session', async () => {
    findUniqueMock.mockResolvedValue({ id: 'alb_1', shareToken: 'tok_abc', downloadEnabled: false })

    const req = new Request('http://localhost/api/albums/alb_1/download-selected', {
      method: 'POST',
      body: JSON.stringify({ shareToken: 'tok_abc', photoIds: ['photo_1'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ albumId: 'alb_1' }) })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/albums-download-selected.test.ts`
Expected: FAIL due to missing route.

- [ ] **Step 3: Implement `download-selected/route.ts` and UI CTA**

Create `src/app/api/albums/[albumId]/download-selected/route.ts` mirroring `download-all/route.ts`, but filtering `where: { id: { in: photoIds }, albumId }`.
Add UI button inside `ClientGallery` and `PhotographerGallery` right next to `Download All Photos`:
```tsx
{selectedCount > 0 && (
  <button
    type="button"
    onClick={async () => {
      const selectedIds = photos.filter((p) => p.liked).map((p) => p.id)
      const res = await fetch(`/api/albums/${props.albumId}/download-selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken: props.shareToken, photoIds: selectedIds }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'selected-photos.zip'
        a.click()
        URL.revokeObjectURL(url)
      }
    }}
    className={styles.downloadSelectedZipBtn}
  >
    <ZipBoxIcon size={16} />
    Download Selected ({selectedCount}) ZIP
  </button>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/albums-download-selected.test.ts tests/components/ClientGallery.test.tsx`
Expected: PASS across all suites.

- [ ] **Step 5: Run full verification across repo & commit**

Run: `npx vitest run`
Expected: PASS 100%.

```bash
git add src/app/api/albums/[albumId]/download-selected/route.ts src/components/ClientGallery.tsx src/components/PhotographerGallery.tsx tests/api/albums-download-selected.test.ts
git commit -m "feat: add Batch Download Selected ZIP endpoint and UI controls"
```

---

## Execution Handoff
Plan complete. Ready to execute using `superpowers:subagent-driven-development` or inline `executing-plans`.
