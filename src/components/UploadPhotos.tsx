'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CameraOutlineIcon } from './PhotoIcons'
import styles from './AlbumControls.module.css'

export function UploadPhotos({ albumId }: { albumId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.set('file', file)
        const res = await fetch(`/api/albums/${albumId}/photos`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Something went wrong')
          setUploading(false)
          return
        }
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardRow}>
        <div>
          <div className={styles.label}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <CameraOutlineIcon size={16} /> Upload photos & Sync
            </span>
          </div>
          <div className={styles.subText}>
            Select multiple high-resolution images to add directly to this client gallery.
          </div>
        </div>
        <div>
          <label className={styles.btnPrimary} style={{ cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
            {uploading ? 'Uploading files...' : '+ Upload photos'}
            <input
              aria-label="Upload photos"
              type="file"
              accept="image/*"
              multiple
              onChange={handleChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
    </div>
  )
}
