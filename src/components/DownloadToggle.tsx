'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './AlbumControls.module.css'

export function DownloadToggle({
  albumId,
  downloadEnabled,
}: {
  albumId: string
  downloadEnabled: boolean
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/albums/${albumId}/download-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !downloadEnabled }),
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
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardRow}>
        <div>
          <div className={styles.label}>
            <span>⚡ Client Downloads</span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: downloadEnabled
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(245, 158, 11, 0.15)',
                color: downloadEnabled ? '#10b981' : '#f59e0b',
                fontWeight: 700,
              }}
            >
              {downloadEnabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <div className={styles.subText}>
            {downloadEnabled
              ? 'Clients can download original high-resolution files and ZIP archives.'
              : 'Clients can only view compressed previews without original download links.'}
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={submitting}
            aria-pressed={downloadEnabled}
            className={`${styles.toggleBtn} ${downloadEnabled ? styles.toggleOn : styles.toggleOff}`}
            title={downloadEnabled ? 'Downloads: On' : 'Downloads: Off'}
          >
            <span
              className={`${styles.toggleThumb} ${downloadEnabled ? styles.toggleThumbOn : ''}`}
            />
            <span
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                border: 0,
              }}
            >
              {downloadEnabled ? 'Downloads: On' : 'Downloads: Off'}
            </span>
          </button>
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
