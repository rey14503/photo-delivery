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
