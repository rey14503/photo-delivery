'use client'

import { useState, useEffect } from 'react'
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
  const [active, setActive] = useState(downloadEnabled)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setActive(downloadEnabled)
  }, [downloadEnabled])

  async function handleToggle() {
    if (submitting) return
    const nextState = !active
    setActive(nextState)
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/albums/${albumId}/download-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        setActive(!nextState)
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
      setActive(!nextState)
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
                backgroundColor: active
                  ? 'var(--success-subtle)'
                  : 'var(--warning-subtle)',
                color: active ? 'var(--success)' : 'var(--warning)',
                fontWeight: 700,
              }}
            >
              {active ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <div className={styles.subText}>
            {active
              ? 'Clients can download original high-resolution files and ZIP archives.'
              : 'Clients can only view compressed previews without original download links.'}
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={submitting}
            aria-pressed={active}
            className={`${styles.toggleBtn} ${active ? styles.toggleOn : styles.toggleOff}`}
            style={{
              backgroundColor: active ? '#10b981' : '#71717a',
              borderColor: active ? '#059669' : '#52525b',
            }}
            title={active ? 'Downloads: On' : 'Downloads: Off'}
          >
            <span
              className={`${styles.toggleThumb} ${active ? styles.toggleThumbOn : ''}`}
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
              {active ? 'Downloads: On' : 'Downloads: Off'}
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
