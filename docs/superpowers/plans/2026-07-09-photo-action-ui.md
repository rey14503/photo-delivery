# Photo Action UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw, always-visible per-photo action buttons/links on both the client gallery and the photographer's album page with a Google Photos/Drive-style interaction model: two quick icons on hover (select/suggest toggle + a "..." menu), a lightbox with three quick icons (toggle, download, comment) plus the same "..." menu, and a slide-in comment panel — while keeping status badges (version, "selected by") always visible.

**Architecture:** Pure frontend redesign. Five new presentational/orchestration components (`PhotoActionMenu`, `PhotoTile`, `PhotoLightbox`, plus a new `PhotographerGallery` and a refactored `ClientGallery`) and two new hooks (`useLikeToggle`, `useReplacePhoto`) that extract the existing fetch/error-handling logic out of `LikeButton` and `ReplacePhotoButton` so it can be triggered from both a quick icon and a menu item without duplicating code. No new API routes, no schema changes, no changes to access control.

**Tech Stack:** Same as Plans 1-5 (Next.js 15, React, Vitest + Testing Library). Adds CSS Modules (built into Next.js/Vite, no new dependency) for the hover-reveal effect on grid thumbnails.

## Global Constraints

- **This is a frontend-only redesign.** No new API routes, no Prisma schema changes, no changes to `resolveActor`, `canManageAlbum`, or `Album.downloadEnabled` — every action already has a working, tested backend endpoint from Plans 1-5.
- **Preserve every existing fetch/error-handling convention exactly**: `role="alert"` on failure, the literal error message `'Network error — please try again.'` on a thrown/rejected fetch, `data.error ?? 'Something went wrong'` on a non-ok response, `router.refresh()` on success.
- **Status indicators (version badge, "selected by" client names, "suggested by photographer" note) are always visible** — never gated behind hover or the "..." menu.
- **Download visibility is unchanged**: a CLIENT actor only sees download affordances when `canDownload` is true (computed exactly as today); a PHOTOGRAPHER actor always sees them, regardless of `Album.downloadEnabled`.
- **One code path per action** — the quick icon and the "..." menu item for the same action must both call the same shared hook/callback, never duplicate fetch logic.
- No new CSS framework or dependency — hover-reveal uses a CSS Module (Vite/Next.js support this natively, already proven to work in this project's Vitest config with zero extra setup).

---

## File Structure

```
photo-delivery/
├── src/
│   ├── app/
│   │   └── albums/[albumId]/page.tsx        (modified: renders PhotographerGallery instead of an inline <ul>)
│   ├── components/
│   │   ├── ClientGallery.tsx                (modified: renders PhotoTile/PhotoLightbox instead of its own grid+dialog)
│   │   ├── PhotoActionMenu.tsx              (new: the "..." dropdown, role-agnostic, presentational)
│   │   ├── PhotoTile.tsx                    (new: one grid thumbnail — badges + hover quick icons + "...")
│   │   ├── PhotoTile.module.css             (new: hover-reveal CSS for the quick-action overlay)
│   │   ├── PhotoLightbox.tsx                (new: full-photo view — quick icons + "..." + comment panel)
│   │   ├── PhotographerGallery.tsx          (new: grid + lightbox orchestration for the photographer's page)
│   │   ├── LikeButton.tsx                   (deleted in Task 8 — superseded by useLikeToggle)
│   │   └── ReplacePhotoButton.tsx           (deleted in Task 8 — superseded by useReplacePhoto)
│   └── lib/
│       └── hooks/
│           ├── useLikeToggle.ts             (new: shared select/suggest toggle logic)
│           └── useReplacePhoto.ts           (new: shared replace/version-bump upload logic)
└── tests/
    ├── components/
    │   ├── ClientGallery.test.tsx           (modified)
    │   ├── PhotoActionMenu.test.tsx         (new)
    │   ├── PhotoTile.test.tsx               (new)
    │   ├── PhotoLightbox.test.tsx           (new)
    │   ├── PhotographerGallery.test.tsx     (new)
    │   ├── LikeButton.test.tsx              (deleted in Task 8)
    │   └── ReplacePhotoButton.test.tsx      (deleted in Task 8)
    └── lib/hooks/
        ├── useLikeToggle.test.ts            (new)
        └── useReplacePhoto.test.ts          (new)
```

---

### Task 1: `useLikeToggle` hook

**Files:**
- Create: `src/lib/hooks/useLikeToggle.ts`
- Test: `tests/lib/hooks/useLikeToggle.test.ts`

**Interfaces:**
- Produces: `useLikeToggle(photoId: string): { submitting: boolean; error: string | null; toggle: () => Promise<void> }`. Consumed by Task 6 (`ClientGallery`) and Task 7 (`PhotographerGallery`).

- [ ] **Step 1: Write the failing tests**

`tests/lib/hooks/useLikeToggle.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('useLikeToggle', () => {
  it('posts to the like endpoint and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ liked: true }),
    } as never)

    const { result } = renderHook(() => useLikeToggle('photo_1'))

    await act(async () => {
      await result.current.toggle()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/photo_1/like', { method: 'POST' })
    expect(refreshMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('sets an error message and does not refresh when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)

    const { result } = renderHook(() => useLikeToggle('photo_1'))

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.error).toBe('Forbidden')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('sets a generic network error message when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useLikeToggle('photo_1'))

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.error).toBe('Network error — please try again.')
  })

  it('tracks submitting state across the toggle call', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }) as never
    )

    const { result } = renderHook(() => useLikeToggle('photo_1'))
    expect(result.current.submitting).toBe(false)

    let togglePromise!: Promise<void>
    act(() => {
      togglePromise = result.current.toggle()
    })
    expect(result.current.submitting).toBe(true)

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({}) })
      await togglePromise
    })
    expect(result.current.submitting).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/hooks/useLikeToggle.test.ts`
Expected: FAIL — cannot find module `@/lib/hooks/useLikeToggle`.

- [ ] **Step 3: Write `src/lib/hooks/useLikeToggle.ts`**

```ts
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function useLikeToggle(photoId: string) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' })
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

  return { submitting, error, toggle }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/hooks/useLikeToggle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/useLikeToggle.ts tests/lib/hooks/useLikeToggle.test.ts
git commit -m "Add useLikeToggle hook for shared select/suggest toggle logic"
```

---

### Task 2: `useReplacePhoto` hook

**Files:**
- Create: `src/lib/hooks/useReplacePhoto.ts`
- Test: `tests/lib/hooks/useReplacePhoto.test.ts`

**Interfaces:**
- Produces: `useReplacePhoto(photoId: string): { uploading: boolean; error: string | null; inputRef: RefObject<HTMLInputElement>; triggerFileSelect: () => void; handleFileChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void> }`. Consumed by Task 7 (`PhotographerGallery`).

- [ ] **Step 1: Write the failing tests**

`tests/lib/hooks/useReplacePhoto.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { useReplacePhoto } from '@/lib/hooks/useReplacePhoto'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

function fakeChangeEvent(files: File[]) {
  return { target: { files } } as unknown as ChangeEvent<HTMLInputElement>
}

describe('useReplacePhoto', () => {
  it('uploads the selected file and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as never)
    const { result } = renderHook(() => useReplacePhoto('photo_1'))
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    await act(async () => {
      await result.current.handleFileChange(fakeChangeEvent([file]))
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/photos/photo_1/replace',
      expect.objectContaining({ method: 'POST' })
    )
    expect(refreshMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('does nothing when no file is selected', async () => {
    const { result } = renderHook(() => useReplacePhoto('photo_1'))

    await act(async () => {
      await result.current.handleFileChange(fakeChangeEvent([]))
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sets an error message and does not refresh when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File too large' }),
    } as never)
    const { result } = renderHook(() => useReplacePhoto('photo_1'))
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    await act(async () => {
      await result.current.handleFileChange(fakeChangeEvent([file]))
    })

    expect(result.current.error).toBe('File too large')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('does not throw when triggerFileSelect is called before the input is mounted', () => {
    const { result } = renderHook(() => useReplacePhoto('photo_1'))

    expect(() => result.current.triggerFileSelect()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/hooks/useReplacePhoto.test.ts`
Expected: FAIL — cannot find module `@/lib/hooks/useReplacePhoto`.

- [ ] **Step 3: Write `src/lib/hooks/useReplacePhoto.ts`**

```ts
'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

export function useReplacePhoto(photoId: string) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function triggerFileSelect() {
    inputRef.current?.click()
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const res = await fetch(`/api/photos/${photoId}/replace`, {
        method: 'POST',
        body: formData,
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
      setUploading(false)
    }
  }

  return { uploading, error, inputRef, triggerFileSelect, handleFileChange }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/hooks/useReplacePhoto.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/useReplacePhoto.ts tests/lib/hooks/useReplacePhoto.test.ts
git commit -m "Add useReplacePhoto hook for shared replace/version-bump upload logic"
```

---

### Task 3: `PhotoActionMenu` component

**Files:**
- Create: `src/components/PhotoActionMenu.tsx`
- Test: `tests/components/PhotoActionMenu.test.tsx`

**Interfaces:**
- Produces: `PhotoActionMenu(props: PhotoActionMenuProps)` where
  ```ts
  export interface PhotoActionMenuProps {
    likeLabel: string
    onToggleLike: () => void
    toggling: boolean
    showDownload: boolean
    downloadHref: string
    commentCount: number
    onViewComments: () => void
    showReplace: boolean
    onReplace: () => void
  }
  ```
  Consumed by Task 4 (`PhotoTile`) and Task 5 (`PhotoLightbox`).

- [ ] **Step 1: Write the failing tests**

`tests/components/PhotoActionMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoActionMenu, type PhotoActionMenuProps } from '@/components/PhotoActionMenu'

function baseProps(overrides: Partial<PhotoActionMenuProps> = {}): PhotoActionMenuProps {
  return {
    likeLabel: 'Select this photo',
    onToggleLike: vi.fn(),
    toggling: false,
    showDownload: true,
    downloadHref: '/api/photos/photo_1/download',
    commentCount: 2,
    onViewComments: vi.fn(),
    showReplace: false,
    onReplace: vi.fn(),
    ...overrides,
  }
}

describe('PhotoActionMenu', () => {
  it('is closed by default and opens the menu when the trigger is clicked', () => {
    render(<PhotoActionMenu {...baseProps()} />)

    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('shows the like label and view-comments count, hiding download/replace by default', () => {
    render(<PhotoActionMenu {...baseProps({ showDownload: false, showReplace: false })} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: 'Select this photo' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /view comments \(2\)/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /replace/i })).toBeNull()
  })

  it('shows Download when showDownload is true, with the given href', () => {
    render(
      <PhotoActionMenu
        {...baseProps({ showDownload: true, downloadHref: '/api/photos/photo_9/download' })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: /download/i })).toHaveAttribute(
      'href',
      '/api/photos/photo_9/download'
    )
  })

  it('shows Replace / update version only when showReplace is true', () => {
    render(<PhotoActionMenu {...baseProps({ showReplace: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: /replace \/ update version/i })).toBeTruthy()
  })

  it('calls onToggleLike and closes the menu when the like item is clicked', () => {
    const props = baseProps()
    render(<PhotoActionMenu {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Select this photo' }))

    expect(props.onToggleLike).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('calls onViewComments and closes the menu when the comments item is clicked', () => {
    const props = baseProps()
    render(<PhotoActionMenu {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view comments/i }))

    expect(props.onViewComments).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('calls onReplace and closes the menu when the replace item is clicked', () => {
    const props = baseProps({ showReplace: true })
    render(<PhotoActionMenu {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /replace \/ update version/i }))

    expect(props.onReplace).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes the menu when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <PhotoActionMenu {...baseProps()} />
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('disables the like menu item while toggling', () => {
    render(<PhotoActionMenu {...baseProps({ toggling: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: 'Select this photo' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/PhotoActionMenu.test.tsx`
Expected: FAIL — cannot find module `@/components/PhotoActionMenu`.

- [ ] **Step 3: Write `src/components/PhotoActionMenu.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

export interface PhotoActionMenuProps {
  likeLabel: string
  onToggleLike: () => void
  toggling: boolean
  showDownload: boolean
  downloadHref: string
  commentCount: number
  onViewComments: () => void
  showReplace: boolean
  onReplace: () => void
}

export function PhotoActionMenu({
  likeLabel,
  onToggleLike,
  toggling,
  showDownload,
  downloadHref,
  commentCount,
  onViewComments,
  showReplace,
  onReplace,
}: PhotoActionMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ⋮
      </button>
      {open && (
        <ul role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={toggling}
              onClick={() => {
                onToggleLike()
                setOpen(false)
              }}
            >
              {likeLabel}
            </button>
          </li>
          {showDownload && (
            <li role="none">
              <a role="menuitem" href={downloadHref} onClick={() => setOpen(false)}>
                Download
              </a>
            </li>
          )}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onViewComments()
                setOpen(false)
              }}
            >
              View comments ({commentCount})
            </button>
          </li>
          {showReplace && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onReplace()
                  setOpen(false)
                }}
              >
                Replace / update version
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/PhotoActionMenu.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PhotoActionMenu.tsx tests/components/PhotoActionMenu.test.tsx
git commit -m "Add PhotoActionMenu — role-agnostic \"...\" dropdown for per-photo actions"
```

---

### Task 4: `PhotoTile` component

**Files:**
- Create: `src/components/PhotoTile.tsx`
- Create: `src/components/PhotoTile.module.css`
- Test: `tests/components/PhotoTile.test.tsx`

**Interfaces:**
- Consumes: `PhotoActionMenu` (Task 3).
- Produces: `PhotoTile(props: PhotoTileProps)` where
  ```ts
  export interface PhotoTileProps {
    thumbnailUrl: string
    version: number
    statusNote?: string
    liked: boolean
    likeIcon: 'heart' | 'star'
    likeLabel: string
    onToggleLike: () => void
    toggling: boolean
    showDownload: boolean
    downloadHref: string
    commentCount: number
    showReplace: boolean
    onReplace: () => void
    onOpen: () => void
  }
  ```
  Consumed by Task 6 (`ClientGallery`) and Task 7 (`PhotographerGallery`).

**Note on testing hover:** jsdom cannot evaluate CSS `:hover`/`@media (hover: none)`, so this task's tests verify the quick-action elements are present in the DOM and behave correctly when interacted with — not their CSS-driven visibility, which is a presentation detail no other component test in this codebase asserts on either.

- [ ] **Step 1: Write the failing tests**

`tests/components/PhotoTile.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoTile, type PhotoTileProps } from '@/components/PhotoTile'

function baseProps(overrides: Partial<PhotoTileProps> = {}): PhotoTileProps {
  return {
    thumbnailUrl: 'https://blob/thumb.jpg',
    version: 1,
    statusNote: undefined,
    liked: false,
    likeIcon: 'heart',
    likeLabel: 'Select this photo',
    onToggleLike: vi.fn(),
    toggling: false,
    showDownload: true,
    downloadHref: '/api/photos/photo_1/download',
    commentCount: 0,
    showReplace: false,
    onReplace: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  }
}

describe('PhotoTile', () => {
  it('renders the thumbnail and calls onOpen when clicked', () => {
    const props = baseProps()
    render(<PhotoTile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /open photo/i }))

    expect(props.onOpen).toHaveBeenCalledTimes(1)
  })

  it('shows the version badge only when version is greater than 1', () => {
    const { rerender } = render(<PhotoTile {...baseProps({ version: 1 })} />)
    expect(screen.queryByText('v1')).toBeNull()

    rerender(<PhotoTile {...baseProps({ version: 3 })} />)
    expect(screen.getByText('v3')).toBeTruthy()
  })

  it('renders the status note when provided, and nothing when omitted', () => {
    const { rerender } = render(<PhotoTile {...baseProps({ statusNote: undefined })} />)
    expect(screen.queryByText(/selected by/i)).toBeNull()

    rerender(<PhotoTile {...baseProps({ statusNote: '❤ Selected by: Jane Doe' })} />)
    expect(screen.getByText('❤ Selected by: Jane Doe')).toBeTruthy()
  })

  it('renders a heart glyph when likeIcon is "heart" and liked is true', () => {
    render(
      <PhotoTile {...baseProps({ likeIcon: 'heart', liked: true, likeLabel: 'Unselect this photo' })} />
    )

    expect(screen.getByRole('button', { name: 'Unselect this photo' }).textContent).toBe('♥')
  })

  it('renders a star glyph when likeIcon is "star" and liked is true', () => {
    render(
      <PhotoTile {...baseProps({ likeIcon: 'star', liked: true, likeLabel: 'Unsuggest to client' })} />
    )

    expect(screen.getByRole('button', { name: 'Unsuggest to client' }).textContent).toBe('⭐')
  })

  it('calls onToggleLike when the quick like icon is clicked', () => {
    const props = baseProps()
    render(<PhotoTile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select this photo' }))

    expect(props.onToggleLike).toHaveBeenCalledTimes(1)
  })

  it('opens the action menu and passes through showDownload/showReplace/commentCount', () => {
    render(
      <PhotoTile
        {...baseProps({
          showDownload: true,
          showReplace: true,
          commentCount: 5,
          downloadHref: '/api/photos/photo_7/download',
        })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: /view comments \(5\)/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /download/i })).toHaveAttribute(
      'href',
      '/api/photos/photo_7/download'
    )
    expect(screen.getByRole('menuitem', { name: /replace \/ update version/i })).toBeTruthy()
  })

  it('calls onOpen when "View comments" is chosen from the action menu', () => {
    const props = baseProps()
    render(<PhotoTile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view comments/i }))

    expect(props.onOpen).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/PhotoTile.test.tsx`
Expected: FAIL — cannot find module `@/components/PhotoTile`.

- [ ] **Step 3: Write `src/components/PhotoTile.module.css`**

```css
.tile {
  position: relative;
  display: inline-block;
}

.quickActions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tile:hover .quickActions,
.tile:focus-within .quickActions {
  opacity: 1;
}

@media (hover: none) {
  .quickActions {
    opacity: 1;
  }
}
```

- [ ] **Step 4: Write `src/components/PhotoTile.tsx`**

```tsx
'use client'

import { PhotoActionMenu } from './PhotoActionMenu'
import styles from './PhotoTile.module.css'

export interface PhotoTileProps {
  thumbnailUrl: string
  version: number
  statusNote?: string
  liked: boolean
  likeIcon: 'heart' | 'star'
  likeLabel: string
  onToggleLike: () => void
  toggling: boolean
  showDownload: boolean
  downloadHref: string
  commentCount: number
  showReplace: boolean
  onReplace: () => void
  onOpen: () => void
}

function likeGlyph(liked: boolean, icon: 'heart' | 'star') {
  if (icon === 'heart') return liked ? '♥' : '♡'
  return liked ? '⭐' : '☆'
}

export function PhotoTile({
  thumbnailUrl,
  version,
  statusNote,
  liked,
  likeIcon,
  likeLabel,
  onToggleLike,
  toggling,
  showDownload,
  downloadHref,
  commentCount,
  showReplace,
  onReplace,
  onOpen,
}: PhotoTileProps) {
  return (
    <div className={styles.tile}>
      <button type="button" aria-label="Open photo" onClick={onOpen}>
        <img src={thumbnailUrl} alt="Photo thumbnail" width={200} />
      </button>
      <div>
        {version > 1 && <span>v{version}</span>}
        {statusNote && <p>{statusNote}</p>}
      </div>
      <div className={styles.quickActions}>
        <button
          type="button"
          aria-label={likeLabel}
          aria-pressed={liked}
          disabled={toggling}
          onClick={onToggleLike}
        >
          {likeGlyph(liked, likeIcon)}
        </button>
        <PhotoActionMenu
          likeLabel={likeLabel}
          onToggleLike={onToggleLike}
          toggling={toggling}
          showDownload={showDownload}
          downloadHref={downloadHref}
          commentCount={commentCount}
          onViewComments={onOpen}
          showReplace={showReplace}
          onReplace={onReplace}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/PhotoTile.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/PhotoTile.tsx src/components/PhotoTile.module.css tests/components/PhotoTile.test.tsx
git commit -m "Add PhotoTile — grid thumbnail with always-visible badges and hover quick actions"
```

---

### Task 5: `PhotoLightbox` component

**Files:**
- Create: `src/components/PhotoLightbox.tsx`
- Test: `tests/components/PhotoLightbox.test.tsx`

**Interfaces:**
- Consumes: `PhotoActionMenu` (Task 3), `CommentThread`/`ThreadComment` (existing, unchanged).
- Produces: `PhotoLightbox(props: PhotoLightboxProps)` where
  ```ts
  export interface PhotoLightboxProps {
    photoId: string
    previewUrl: string
    statusNote?: string
    liked: boolean
    likeIcon: 'heart' | 'star'
    likeLabel: string
    onToggleLike: () => void
    toggling: boolean
    showDownload: boolean
    downloadHref: string
    comments: ThreadComment[]
    showReplace: boolean
    onReplace: () => void
    hasPrevious: boolean
    hasNext: boolean
    onPrevious: () => void
    onNext: () => void
    onClose: () => void
  }
  ```
  Consumed by Task 6 (`ClientGallery`) and Task 7 (`PhotographerGallery`).

- [ ] **Step 1: Write the failing tests**

`tests/components/PhotoLightbox.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoLightbox, type PhotoLightboxProps } from '@/components/PhotoLightbox'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

function baseProps(overrides: Partial<PhotoLightboxProps> = {}): PhotoLightboxProps {
  return {
    photoId: 'photo_1',
    previewUrl: 'https://blob/preview.jpg',
    statusNote: undefined,
    liked: false,
    likeIcon: 'heart',
    likeLabel: 'Select this photo',
    onToggleLike: vi.fn(),
    toggling: false,
    showDownload: true,
    downloadHref: '/api/photos/photo_1/download',
    comments: [],
    showReplace: false,
    onReplace: vi.fn(),
    hasPrevious: false,
    hasNext: false,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('PhotoLightbox', () => {
  it('renders the preview image inside a dialog and calls onClose', () => {
    const props = baseProps()
    render(<PhotoLightbox {...props} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows Previous/Next only when hasPrevious/hasNext are true', () => {
    const { rerender } = render(
      <PhotoLightbox {...baseProps({ hasPrevious: false, hasNext: false })} />
    )
    expect(screen.queryByRole('button', { name: /previous/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull()

    rerender(<PhotoLightbox {...baseProps({ hasPrevious: true, hasNext: true })} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /next/i })).toBeTruthy()
  })

  it('calls onPrevious and onNext when clicked', () => {
    const props = baseProps({ hasPrevious: true, hasNext: true })
    render(<PhotoLightbox {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(props.onPrevious).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('renders the status note when provided', () => {
    render(<PhotoLightbox {...baseProps({ statusNote: '⭐ Suggested by photographer' })} />)

    expect(screen.getByText('⭐ Suggested by photographer')).toBeTruthy()
  })

  it('calls onToggleLike when the quick like icon is clicked', () => {
    const props = baseProps()
    render(<PhotoLightbox {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select this photo' }))

    expect(props.onToggleLike).toHaveBeenCalledTimes(1)
  })

  it('renders the download link only when showDownload is true', () => {
    const { rerender } = render(<PhotoLightbox {...baseProps({ showDownload: false })} />)
    expect(screen.queryByRole('link', { name: /^download$/i })).toBeNull()

    rerender(
      <PhotoLightbox
        {...baseProps({ showDownload: true, downloadHref: '/api/photos/photo_5/download' })}
      />
    )
    expect(screen.getByRole('link', { name: /^download$/i })).toHaveAttribute(
      'href',
      '/api/photos/photo_5/download'
    )
  })

  it('toggles the comment panel open and closed via the comment icon, showing existing comments', () => {
    render(
      <PhotoLightbox
        {...baseProps({ comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }] })}
      />
    )

    expect(screen.queryByRole('complementary', { name: /comments/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /comments \(1\)/i }))
    expect(screen.getByRole('complementary', { name: /comments/i })).toBeTruthy()
    expect(screen.getByText(/Lovely/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /comments \(1\)/i }))
    expect(screen.queryByRole('complementary', { name: /comments/i })).toBeNull()
  })

  it('opens the comment panel when "View comments" is chosen from the action menu', () => {
    render(<PhotoLightbox {...baseProps({ comments: [] })} />)

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view comments/i }))

    expect(screen.getByRole('complementary', { name: /comments/i })).toBeTruthy()
  })

  it('shows Replace / update version in the action menu only when showReplace is true, and calls onReplace', () => {
    const props = baseProps({ showReplace: true })
    render(<PhotoLightbox {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /replace \/ update version/i }))

    expect(props.onReplace).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/PhotoLightbox.test.tsx`
Expected: FAIL — cannot find module `@/components/PhotoLightbox`.

- [ ] **Step 3: Write `src/components/PhotoLightbox.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { CommentThread, type ThreadComment } from './CommentThread'
import { PhotoActionMenu } from './PhotoActionMenu'

export interface PhotoLightboxProps {
  photoId: string
  previewUrl: string
  statusNote?: string
  liked: boolean
  likeIcon: 'heart' | 'star'
  likeLabel: string
  onToggleLike: () => void
  toggling: boolean
  showDownload: boolean
  downloadHref: string
  comments: ThreadComment[]
  showReplace: boolean
  onReplace: () => void
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}

function likeGlyph(liked: boolean, icon: 'heart' | 'star') {
  if (icon === 'heart') return liked ? '♥' : '♡'
  return liked ? '⭐' : '☆'
}

export function PhotoLightbox({
  photoId,
  previewUrl,
  statusNote,
  liked,
  likeIcon,
  likeLabel,
  onToggleLike,
  toggling,
  showDownload,
  downloadHref,
  comments,
  showReplace,
  onReplace,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: PhotoLightboxProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)

  return (
    <div role="dialog" aria-label="Photo preview">
      <button type="button" onClick={onClose}>
        Close
      </button>
      {hasPrevious && (
        <button type="button" onClick={onPrevious}>
          Previous
        </button>
      )}
      <img src={previewUrl} alt="Photo preview" />
      {hasNext && (
        <button type="button" onClick={onNext}>
          Next
        </button>
      )}
      {statusNote && <p>{statusNote}</p>}

      <div>
        <button
          type="button"
          aria-label={likeLabel}
          aria-pressed={liked}
          disabled={toggling}
          onClick={onToggleLike}
        >
          {likeGlyph(liked, likeIcon)}
        </button>
        {showDownload && <a href={downloadHref}>Download</a>}
        <button
          type="button"
          aria-pressed={commentsOpen}
          onClick={() => setCommentsOpen((prev) => !prev)}
        >
          💬 Comments ({comments.length})
        </button>
        <PhotoActionMenu
          likeLabel={likeLabel}
          onToggleLike={onToggleLike}
          toggling={toggling}
          showDownload={showDownload}
          downloadHref={downloadHref}
          commentCount={comments.length}
          onViewComments={() => setCommentsOpen(true)}
          showReplace={showReplace}
          onReplace={onReplace}
        />
      </div>

      {commentsOpen && (
        <aside aria-label="Comments">
          <CommentThread photoId={photoId} comments={comments} />
        </aside>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/PhotoLightbox.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PhotoLightbox.tsx tests/components/PhotoLightbox.test.tsx
git commit -m "Add PhotoLightbox — full-photo view with quick icons and a slide-in comment panel"
```

---

### Task 6: Refactor `ClientGallery`

**Files:**
- Modify: `src/components/ClientGallery.tsx`
- Modify: `tests/components/ClientGallery.test.tsx`

**Interfaces:**
- Consumes: `PhotoTile` (Task 4), `PhotoLightbox` (Task 5), `useLikeToggle` (Task 1).
- No new exports beyond the existing `ClientGallery({ photos, canDownload, albumId })` signature — unchanged from Plan 5, so the share page (`src/app/a/[shareToken]/page.tsx`) needs no changes.

- [ ] **Step 1: Replace the full contents of `tests/components/ClientGallery.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ClientGallery } from '@/components/ClientGallery'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const photos = [
  {
    id: 'p1',
    thumbnailUrl: 'https://blob/p1-thumb.jpg',
    previewUrl: 'https://blob/p1-preview.jpg',
    version: 1,
    likedByMe: false,
    suggestedByPhotographer: false,
    comments: [],
  },
  {
    id: 'p2',
    thumbnailUrl: 'https://blob/p2-thumb.jpg',
    previewUrl: 'https://blob/p2-preview.jpg',
    version: 2,
    likedByMe: true,
    suggestedByPhotographer: true,
    comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }],
  },
  {
    id: 'p3',
    thumbnailUrl: 'https://blob/p3-thumb.jpg',
    previewUrl: 'https://blob/p3-preview.jpg',
    version: 1,
    likedByMe: false,
    suggestedByPhotographer: false,
    comments: [],
  },
]

describe('ClientGallery', () => {
  it('renders a tile for every photo and no lightbox initially', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.getAllByRole('button', { name: /open photo/i })).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the lightbox showing the preview image when a tile is clicked', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('navigates to the next photo and closes the lightbox', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the suggested-by-photographer note on the tile and in the lightbox for a suggested photo', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.getByText('⭐ Suggested by photographer')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    expect(screen.getAllByText('⭐ Suggested by photographer')).toHaveLength(2)
  })

  it('does not show the suggested note for a photo with no photographer like', () => {
    render(<ClientGallery photos={[photos[0]]} canDownload={false} />)

    expect(screen.queryByText(/suggested by photographer/i)).toBeNull()
  })

  it('shows no download links when downloads are disabled', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.queryByRole('link', { name: /download all/i })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[0])

    expect(screen.queryByRole('link', { name: /^download$/i })).toBeNull()
  })

  it('shows a per-photo download link and a download-all link when downloads are enabled', () => {
    render(<ClientGallery photos={photos} canDownload={true} albumId="album_1" />)

    const downloadAll = screen.getByRole('link', { name: /download all/i })
    expect(downloadAll).toHaveAttribute('href', '/api/albums/album_1/download-all')

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    const downloadPhoto = screen.getByRole('link', { name: /^download$/i })
    expect(downloadPhoto).toHaveAttribute('href', '/api/photos/p2/download')
  })

  it('toggles like via the quick icon on the tile, posting to the like endpoint', () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as never)
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Select this photo' })[0])

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/p1/like', { method: 'POST' })
  })

  it('shows an error message when the like toggle fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Select this photo' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })

  it('shows the correct action menu items for a client actor', () => {
    render(<ClientGallery photos={photos} canDownload={true} albumId="album_1" />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /more actions/i }))

    expect(within(dialog).getByRole('menuitem', { name: 'Unselect this photo' })).toBeTruthy()
    expect(within(dialog).getByRole('menuitem', { name: /download/i })).toBeTruthy()
    expect(within(dialog).getByRole('menuitem', { name: /view comments \(1\)/i })).toBeTruthy()
    expect(within(dialog).queryByRole('menuitem', { name: /replace/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: FAIL — the current `ClientGallery` renders a raw grid/dialog with a text-label `LikeButton`, not `PhotoTile`/`PhotoLightbox`, so `getByRole('button', {name: /open photo/i})` etc. won't match.

- [ ] **Step 3: Replace the full contents of `src/components/ClientGallery.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import type { ThreadComment } from './CommentThread'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  likedByMe: boolean
  suggestedByPhotographer: boolean
  comments: ThreadComment[]
}

export function ClientGallery({
  photos,
  canDownload,
  albumId,
}: {
  photos: GalleryPhoto[]
  canDownload: boolean
  albumId?: string
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      {canDownload && albumId && (
        <a href={`/api/albums/${albumId}/download-all`}>Download all</a>
      )}
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <ClientPhotoTile photo={photo} canDownload={canDownload} onOpen={() => setOpenIndex(index)} />
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <ClientPhotoLightbox
          photo={photos[openIndex]}
          canDownload={canDownload}
          hasPrevious={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          onPrevious={() => setOpenIndex(openIndex - 1)}
          onNext={() => setOpenIndex(openIndex + 1)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}

function ClientPhotoTile({
  photo,
  canDownload,
  onOpen,
}: {
  photo: GalleryPhoto
  canDownload: boolean
  onOpen: () => void
}) {
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        version={photo.version}
        statusNote={photo.suggestedByPhotographer ? '⭐ Suggested by photographer' : undefined}
        liked={photo.likedByMe}
        likeIcon="heart"
        likeLabel={photo.likedByMe ? 'Unselect this photo' : 'Select this photo'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={canDownload}
        downloadHref={`/api/photos/${photo.id}/download`}
        commentCount={photo.comments.length}
        showReplace={false}
        onReplace={() => {}}
        onOpen={onOpen}
      />
      {error && <p role="alert">{error}</p>}
    </>
  )
}

function ClientPhotoLightbox({
  photo,
  canDownload,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: {
  photo: GalleryPhoto
  canDownload: boolean
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  return (
    <>
      <PhotoLightbox
        photoId={photo.id}
        previewUrl={photo.previewUrl}
        statusNote={photo.suggestedByPhotographer ? '⭐ Suggested by photographer' : undefined}
        liked={photo.likedByMe}
        likeIcon="heart"
        likeLabel={photo.likedByMe ? 'Unselect this photo' : 'Select this photo'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={canDownload}
        downloadHref={`/api/photos/${photo.id}/download`}
        comments={photo.comments}
        showReplace={false}
        onReplace={() => {}}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
      />
      {error && <p role="alert">{error}</p>}
    </>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/ClientGallery.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Verify the app builds**

Run: `npx next build`
Expected: build succeeds (the share page consumes `ClientGallery` with the same external prop signature, so it needs no changes).

- [ ] **Step 6: Commit**

```bash
git add src/components/ClientGallery.tsx tests/components/ClientGallery.test.tsx
git commit -m "Refactor ClientGallery to use PhotoTile/PhotoLightbox instead of an inline grid+dialog"
```

---

### Task 7: `PhotographerGallery` + album page wiring

**Files:**
- Create: `src/components/PhotographerGallery.tsx`
- Test: `tests/components/PhotographerGallery.test.tsx`
- Modify: `src/app/albums/[albumId]/page.tsx`

**Interfaces:**
- Consumes: `PhotoTile` (Task 4), `PhotoLightbox` (Task 5), `useLikeToggle` (Task 1), `useReplacePhoto` (Task 2).
- Produces: `PhotographerGallery({ photos }: { photos: PhotographerGalleryPhoto[] })` where
  ```ts
  export interface PhotographerGalleryPhoto {
    id: string
    thumbnailUrl: string
    previewUrl: string
    version: number
    suggestedByMe: boolean
    clientLikers: string[]
    comments: ThreadComment[]
  }
  ```
  Consumed by `src/app/albums/[albumId]/page.tsx` in this same task.

- [ ] **Step 1: Write the failing tests**

`tests/components/PhotographerGallery.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { PhotographerGallery } from '@/components/PhotographerGallery'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const photos = [
  {
    id: 'p1',
    thumbnailUrl: 'https://blob/p1-thumb.jpg',
    previewUrl: 'https://blob/p1-preview.jpg',
    version: 1,
    suggestedByMe: false,
    clientLikers: [],
    comments: [],
  },
  {
    id: 'p2',
    thumbnailUrl: 'https://blob/p2-thumb.jpg',
    previewUrl: 'https://blob/p2-preview.jpg',
    version: 3,
    suggestedByMe: true,
    clientLikers: ['Jane Doe', 'John Smith'],
    comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }],
  },
]

describe('PhotographerGallery', () => {
  it('renders a tile per photo with version badge and client-likers status note', () => {
    render(<PhotographerGallery photos={photos} />)

    expect(screen.getByText('v3')).toBeTruthy()
    expect(screen.getByText('❤ Selected by: Jane Doe, John Smith')).toBeTruthy()
  })

  it('opens the lightbox showing the preview image when a tile is clicked', () => {
    render(<PhotographerGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('shows a star icon for the suggest toggle and posts to the like endpoint', () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as never)
    render(<PhotographerGallery photos={photos} />)

    const suggestButton = screen.getByRole('button', { name: 'Suggest to client' })
    expect(suggestButton.textContent).toBe('☆')

    fireEvent.click(suggestButton)

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/p1/like', { method: 'POST' })
  })

  it('shows Replace / update version in the action menu, and Download is always present', () => {
    render(<PhotographerGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[0])
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /more actions/i }))

    expect(within(dialog).getByRole('menuitem', { name: /replace \/ update version/i })).toBeTruthy()
    expect(within(dialog).getByRole('menuitem', { name: /download/i })).toBeTruthy()
  })

  it('triggers the hidden file input when Replace / update version is chosen', () => {
    render(<PhotographerGallery photos={photos} />)

    const fileInput = screen.getAllByLabelText('Replace photo file')[0] as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    fireEvent.click(screen.getAllByRole('button', { name: /more actions/i })[0])
    fireEvent.click(screen.getAllByRole('menuitem', { name: /replace \/ update version/i })[0])

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('uploads a replacement file and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as never)
    render(<PhotographerGallery photos={photos} />)

    const fileInput = screen.getAllByLabelText('Replace photo file')[0] as HTMLInputElement
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/photos/p1/replace',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('shows an error message when the suggest toggle fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)
    render(<PhotographerGallery photos={photos} />)

    fireEvent.click(screen.getByRole('button', { name: 'Suggest to client' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })

  it('shows an error message when the replace upload fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File too large' }),
    } as never)
    render(<PhotographerGallery photos={photos} />)

    const fileInput = screen.getAllByLabelText('Replace photo file')[0] as HTMLInputElement
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('File too large')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/PhotographerGallery.test.tsx`
Expected: FAIL — cannot find module `@/components/PhotographerGallery`.

- [ ] **Step 3: Write `src/components/PhotographerGallery.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import { useReplacePhoto } from '@/lib/hooks/useReplacePhoto'
import type { ThreadComment } from './CommentThread'

export interface PhotographerGalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  suggestedByMe: boolean
  clientLikers: string[]
  comments: ThreadComment[]
}

function statusNoteFor(photo: PhotographerGalleryPhoto): string | undefined {
  return photo.clientLikers.length > 0 ? `❤ Selected by: ${photo.clientLikers.join(', ')}` : undefined
}

export function PhotographerGallery({ photos }: { photos: PhotographerGalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <PhotographerPhotoTile photo={photo} onOpen={() => setOpenIndex(index)} />
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <PhotographerPhotoLightbox
          photo={photos[openIndex]}
          hasPrevious={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          onPrevious={() => setOpenIndex(openIndex - 1)}
          onNext={() => setOpenIndex(openIndex + 1)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}

function PhotographerPhotoTile({
  photo,
  onOpen,
}: {
  photo: PhotographerGalleryPhoto
  onOpen: () => void
}) {
  const { submitting, error: likeError, toggle } = useLikeToggle(photo.id)
  const { inputRef, error: replaceError, triggerFileSelect, handleFileChange } = useReplacePhoto(
    photo.id
  )
  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        version={photo.version}
        statusNote={statusNoteFor(photo)}
        liked={photo.suggestedByMe}
        likeIcon="star"
        likeLabel={photo.suggestedByMe ? 'Unsuggest to client' : 'Suggest to client'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={true}
        downloadHref={`/api/photos/${photo.id}/download`}
        commentCount={photo.comments.length}
        showReplace={true}
        onReplace={triggerFileSelect}
        onOpen={onOpen}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace photo file"
      />
      {likeError && <p role="alert">{likeError}</p>}
      {replaceError && <p role="alert">{replaceError}</p>}
    </>
  )
}

function PhotographerPhotoLightbox({
  photo,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: {
  photo: PhotographerGalleryPhoto
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { submitting, error: likeError, toggle } = useLikeToggle(photo.id)
  const { inputRef, error: replaceError, triggerFileSelect, handleFileChange } = useReplacePhoto(
    photo.id
  )
  return (
    <>
      <PhotoLightbox
        photoId={photo.id}
        previewUrl={photo.previewUrl}
        statusNote={statusNoteFor(photo)}
        liked={photo.suggestedByMe}
        likeIcon="star"
        likeLabel={photo.suggestedByMe ? 'Unsuggest to client' : 'Suggest to client'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={true}
        downloadHref={`/api/photos/${photo.id}/download`}
        comments={photo.comments}
        showReplace={true}
        onReplace={triggerFileSelect}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace photo file"
      />
      {likeError && <p role="alert">{likeError}</p>}
      {replaceError && <p role="alert">{replaceError}</p>}
    </>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/PhotographerGallery.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Replace the full contents of `src/app/albums/[albumId]/page.tsx`**

```tsx
import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAlbum } from '@/lib/album-permissions'
import { UploadPhotos } from '@/components/UploadPhotos'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'
import { DownloadToggle } from '@/components/DownloadToggle'
import { PhotographerGallery } from '@/components/PhotographerGallery'

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
    include: {
      photos: {
        orderBy: { displayOrder: 'asc' },
        include: {
          likes: true,
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  })
  if (!album || !canManageAlbum(session.user, album)) {
    notFound()
  }

  const photos = album.photos.map((photo) => {
    const suggestedByMe = photo.likes.some(
      (like) => like.actorType === 'PHOTOGRAPHER' && like.userId === session.user.id
    )
    const clientLikers = photo.likes
      .filter((like) => like.actorType === 'CLIENT')
      .map((like) => like.actorName)
      .filter((name): name is string => Boolean(name))
    const comments = photo.comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      authorLabel:
        comment.actorName ?? comment.user?.name ?? comment.user?.email ?? 'Photographer',
    }))

    return {
      id: photo.id,
      thumbnailUrl: photo.thumbnailUrl,
      previewUrl: photo.previewUrl,
      version: photo.version,
      suggestedByMe,
      clientLikers,
      comments,
    }
  })

  return (
    <main>
      <h1>
        {album.name} — {album.clientName}
      </h1>
      <p>
        Share link: <code>/a/{album.shareToken}</code>
      </p>
      <SetAlbumPassword albumId={album.id} hasPassword={Boolean(album.passwordHash)} />
      <DownloadToggle albumId={album.id} downloadEnabled={album.downloadEnabled} />
      <UploadPhotos albumId={album.id} />
      <PhotographerGallery photos={photos} />
    </main>
  )
}
```

- [ ] **Step 6: Verify the app builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/PhotographerGallery.tsx tests/components/PhotographerGallery.test.tsx src/app/albums/\[albumId\]/page.tsx
git commit -m "Add PhotographerGallery and wire it into the album detail page"
```

---

### Task 8: Remove superseded components

**Files:**
- Delete: `src/components/LikeButton.tsx`
- Delete: `tests/components/LikeButton.test.tsx`
- Delete: `src/components/ReplacePhotoButton.tsx`
- Delete: `tests/components/ReplacePhotoButton.test.tsx`

**Interfaces:** None — this task only removes files with no remaining importers after Task 6 (`ClientGallery`) and Task 7 (`PhotographerGallery` + the album page) stopped using them.

- [ ] **Step 1: Confirm nothing still imports the two components**

Run: `grep -rn "components/LikeButton\|components/ReplacePhotoButton" src/ --include="*.tsx" --include="*.ts"`
Expected: no output (no remaining imports anywhere in `src/`).

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/LikeButton.tsx tests/components/LikeButton.test.tsx src/components/ReplacePhotoButton.tsx tests/components/ReplacePhotoButton.test.tsx
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, with the total test count reduced by exactly the number of tests that were in the two deleted test files (no other file references them).

- [ ] **Step 4: Verify the app builds**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git commit -m "Remove LikeButton and ReplacePhotoButton, superseded by the new icon/menu UI"
```

---

### Task 9: Manual end-to-end verification

This exercises real hover/CSS behavior and touch-device fallback, which unit tests can't meaningfully assert on. Do this after Tasks 1-8 are complete and committed, with the dev server running against real data (an existing album with a few uploaded photos, on `main` after this branch merges, or directly on this branch).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Photographer grid — hover reveals exactly two icons**

Open an album's detail page. Hover over a thumbnail: confirm the star icon and "..." button fade in, and fade out when the mouse leaves. Confirm the version badge (if any) and "Selected by: ..." note (if any) are visible **without** hovering.

- [ ] **Step 3: Photographer lightbox**

Click a thumbnail: confirm the lightbox opens with the full preview, Previous/Next/Close, and three items (star icon, Download, Comments) plus "...". Click "...": confirm the menu lists Suggest/Unsuggest, Download, View comments, and Replace / update version.

- [ ] **Step 4: Replace via the menu**

From the lightbox's "..." menu, click "Replace / update version", pick a new image file. Confirm the upload succeeds and the version badge increments after the page refreshes.

- [ ] **Step 5: Comment panel**

Click the 💬 icon in the lightbox: confirm the comment panel slides in beside the photo (not over it) showing existing comments and the add-comment form. Post a comment, confirm it appears and the panel stays open.

- [ ] **Step 6: Client gallery — same checks from the client's perspective**

Open the album's share link in a private/incognito window, pass the gates. Repeat Steps 2-3 for the heart icon (instead of star) and confirm the menu never shows "Replace / update version" for a client actor. Confirm the Download item/icon only appears when the album's download toggle is on (from Plan 5).

- [ ] **Step 7: Touch-device fallback**

In the browser's device toolbar (e.g., Chrome DevTools' device emulation), switch to a touch device profile. Reload the client gallery: confirm the heart and "..." icons are visible on the grid **without** any hover/tap-and-hold, since there is no hover event on a touch device.
