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
      <div role="dialog" aria-modal="true" aria-label="Tạo album" className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Tạo album</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className={styles.closeBtn}>
            ✕
          </button>
        </div>
        <div className={styles.content}>
          <CreateAlbumForm onSuccess={onClose} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
