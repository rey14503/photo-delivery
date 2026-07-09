'use client'

import { useEffect } from 'react'
import { CreateAlbumForm } from './CreateAlbumForm'
import { CloseOutlineIcon } from './PhotoIcons'
import styles from './CreateAlbumModal.module.css'

export interface CreateAlbumModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateAlbumModal({ isOpen, onClose }: CreateAlbumModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Create album" className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create album</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={styles.closeBtn}>
            <CloseOutlineIcon size={16} />
          </button>
        </div>
        <div className={styles.content}>
          <CreateAlbumForm onSuccess={onClose} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
