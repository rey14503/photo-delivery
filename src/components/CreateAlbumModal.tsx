'use client'

import { useEffect, useState } from 'react'
import { CreateAlbumForm } from './CreateAlbumForm'
import { CloseOutlineIcon } from './PhotoIcons'
import styles from './CreateAlbumModal.module.css'

export interface CreateAlbumModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateAlbumModal({ isOpen, onClose }: CreateAlbumModalProps) {
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    if (isOpen) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose, submitting])

  if (!isOpen) return null

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Create album" className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create album</h2>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className={styles.closeBtn}>
            <CloseOutlineIcon size={16} />
          </button>
        </div>
        <div className={styles.content}>
          <CreateAlbumForm onSuccess={onClose} onCancel={onClose} onSubmittingChange={setSubmitting} />
        </div>
      </div>
    </div>
  )
}
