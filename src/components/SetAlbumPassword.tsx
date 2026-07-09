'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LockOutlineIcon } from './PhotoIcons'
import styles from './AlbumControls.module.css'

async function submitPassword(albumId: string, password: string | null) {
  return fetch(`/api/albums/${albumId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export function SetAlbumPassword({
  albumId,
  hasPassword,
}: {
  albumId: string
  hasPassword: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSetSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitPassword(albumId, password.trim() || null)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Save failed')
      } else {
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitPassword(albumId, null)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      setPassword('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.card}>
      <form onSubmit={handleSetSubmit} className={styles.cardRow}>
        <div>
          <label className={styles.label}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <LockOutlineIcon size={16} /> Album password
            </span>
            <input
              aria-label="Album password"
              type="text"
              placeholder="Enter PIN / password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              style={{ marginLeft: 8 }}
            />
          </label>
          <div className={styles.subText}>
            {hasPassword
              ? 'Password protection is currently ACTIVE for client access.'
              : 'Set a password to restrict unauthorized client gallery view.'}
          </div>
        </div>
        <div className={styles.inputGroup}>
          <button type="submit" disabled={submitting} className={styles.btnPrimary}>
            {hasPassword ? 'Change password' : 'Set password'}
          </button>
          {hasPassword && (
            <button type="button" onClick={handleRemove} disabled={submitting} className={styles.btnSecondary}>
              Remove password
            </button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
    </div>
  )
}
