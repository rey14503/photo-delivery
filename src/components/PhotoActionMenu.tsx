'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  onSetCover?: () => void
  isCover?: boolean
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
  onSetCover,
  isCover = false,
  direction = 'down',
}: PhotoActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number; openUpward: boolean }>({ top: 0, right: 0, openUpward: false })
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        (!menuRef.current || !menuRef.current.contains(e.target as Node))
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleScroll() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, { capture: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
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
          if (!open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            const openUpward = direction === 'up' || (spaceBelow < 260 && rect.top > 260)
            setCoords({
              top: openUpward ? rect.top - 6 : rect.bottom + 6,
              right: window.innerWidth - rect.right,
              openUpward,
            })
          }
          setOpen((prev) => !prev)
        }}
      >
        <MoreActionsIcon size={20} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          className={`${styles.menu} ${coords.openUpward ? styles.menuUp : styles.menuDown}`}
          style={{
            position: 'fixed',
            top: coords.openUpward ? 'auto' : `${coords.top}px`,
            bottom: coords.openUpward ? `${window.innerHeight - coords.top + 12}px` : 'auto',
            right: `${coords.right}px`,
            zIndex: 999999,
          }}
        >
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
          {onSetCover && (
            <li role="none" className={styles.menuItemWrapper}>
              <button
                type="button"
                role="menuitem"
                disabled={isCover}
                className={styles.itemBtn}
                style={isCover ? { color: '#ffb300', fontWeight: 600 } : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  onSetCover()
                  setOpen(false)
                }}
              >
                {isCover ? '★ Cover Photo' : 'Set as Album Cover'}
              </button>
            </li>
          )}
        </ul>,
        document.body
      )}
    </div>
  )
}
