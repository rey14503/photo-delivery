'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreActionsIcon } from './PhotoIcons'
import styles from './PhotoActionMenu.module.css'

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
  direction?: 'up' | 'down'
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
  direction = 'down',
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
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${styles.trigger} ${open ? styles.triggerActive : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
      >
        <MoreActionsIcon size={20} />
      </button>
      {open && (
        <ul role="menu" className={`${styles.menu} ${direction === 'up' ? styles.menuUp : styles.menuDown}`}>
          <li role="none" className={styles.menuItemWrapper}>
            <button
              type="button"
              role="menuitem"
              disabled={toggling}
              className={styles.itemBtn}
              onClick={(e) => {
                e.stopPropagation()
                onToggleLike()
                setOpen(false)
              }}
            >
              {likeLabel}
            </button>
          </li>
          {showDownload && (
            <li role="none" className={styles.menuItemWrapper}>
              <a
                role="menuitem"
                href={downloadHref}
                className={styles.itemLink}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                }}
              >
                Download
              </a>
            </li>
          )}
          <li role="none" className={styles.menuItemWrapper}>
            <button
              type="button"
              role="menuitem"
              className={styles.itemBtn}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onViewComments()
              }}
            >
              View comments ({commentCount})
            </button>
          </li>
          {showReplace && (
            <li role="none" className={styles.menuItemWrapper}>
              <button
                type="button"
                role="menuitem"
                className={`${styles.itemBtn} ${styles.replaceBtn}`}
                onClick={(e) => {
                  e.stopPropagation()
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
