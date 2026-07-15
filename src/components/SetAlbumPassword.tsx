'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyOutlineIcon } from './PhotoIcons'
import styles from './AlbumControls.module.css'

async function submitPassword(albumId: string, password: string | null) {
  return fetch(`/api/albums/${albumId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export interface SetAlbumPasswordProps {
  albumId: string
  currentHasPassword?: boolean
  hasPassword?: boolean
}

export function SetAlbumPassword({ albumId, currentHasPassword, hasPassword }: SetAlbumPasswordProps) {
  const activeHasPass = currentHasPassword ?? hasPassword ?? false
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSetSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setSubmitting(true)
    setError(null)
    const res = await submitPassword(albumId, password.trim())
    setSubmitting(false)
    if (res.ok) {
      setPassword('')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Could not set password')
    }
  }

  async function handleRemove() {
    setSubmitting(true)
    setError(null)
    const res = await submitPassword(albumId, null)
    setSubmitting(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError('Could not remove password')
    }
  }

  if (activeHasPass) {
    return (
      <div className={styles.card}>
        <div className={styles.cardRow}>
          <span>
            <strong>Password protected</strong> — clients must enter the password to view this album.
          </span>
          <button type="button" onClick={handleRemove} disabled={submitting} className={styles.btnDanger}>
            {submitting ? 'Removing…' : 'Remove password'}
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <form onSubmit={handleSetSubmit} className={styles.cardRow}>
        <div>
          <label className={styles.label}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <KeyOutlineIcon size={16} /> Album password
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
            {activeHasPass
              ? 'Password protection is currently ACTIVE for client access.'
              : 'Set a password to restrict unauthorized client gallery view.'}
          </div>
        </div>
        <div className={styles.inputGroup}>
          <button type="submit" disabled={submitting} className={styles.btnPrimary}>
            {activeHasPass ? 'Change password' : 'Set password'}
          </button>
          {activeHasPass && (
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
