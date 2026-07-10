'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MoreActionsIcon,
  EditOutlineIcon,
  CopyOutlineIcon,
  CheckOutlineIcon,
  DeleteOutlineIcon,
} from './PhotoIcons'
import styles from './AlbumActionMenu.module.css'

export interface AlbumActionMenuProps {
  onEdit: () => void
  onCopyLink: () => void
  copied?: boolean
  onDelete: () => void
  direction?: 'up' | 'down'
  align?: 'left' | 'right'
}

export function AlbumActionMenu({
  onEdit,
  onCopyLink,
  copied = false,
  onDelete,
  direction = 'down',
  align = 'left',
}: AlbumActionMenuProps) {
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
        aria-label="More actions menu"
        title="More actions menu"
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
        <ul
          role="menu"
          className={`${styles.menu} ${direction === 'up' ? styles.menuUp : styles.menuDown} ${align === 'right' ? styles.menuAlignRight : styles.menuAlignLeft}`}
          onClick={(e) => e.stopPropagation()}
        >
          <li role="none" className={styles.menuItemWrapper}>
            <button
              type="button"
              className={styles.itemBtn}
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
            >
              <EditOutlineIcon size={16} className={styles.menuIcon} />
              <span>Edit details</span>
            </button>
          </li>

          <li role="none" className={styles.menuItemWrapper}>
            <button
              type="button"
              aria-label={copied ? 'Copied!' : 'Copy link'}
              className={styles.itemBtn}
              onClick={() => {
                onCopyLink()
                setTimeout(() => setOpen(false), 1200)
              }}
            >
              {copied ? (
                <>
                  <CheckOutlineIcon size={16} className={styles.menuIcon} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <CopyOutlineIcon size={16} className={styles.menuIcon} />
                  <span>Copy share link</span>
                </>
              )}
            </button>
          </li>

          <li role="none" className={styles.menuDivider} />

          <li role="none" className={styles.menuItemWrapper}>
            <button
              type="button"
              className={`${styles.itemBtn} ${styles.itemDelete}`}
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
            >
              <DeleteOutlineIcon size={16} className={styles.menuIcon} />
              <span>Delete album</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
