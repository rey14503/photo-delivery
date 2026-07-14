'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from './CreateAlbumForm.module.css'

export interface CreateAlbumFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}

export function CreateAlbumForm({ onSuccess, onCancel, onSubmittingChange }: CreateAlbumFormProps = {}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [driveLink, setDriveLink] = useState('')

  // Backed settings toggles
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [albumPassword, setAlbumPassword] = useState('')
  const [downloadEnabled, setDownloadEnabled] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateSubmitting(val: boolean) {
    setSubmitting(val)
    onSubmittingChange?.(val)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateSubmitting(true)
    setError(null)
    setImportSummary(null)
    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clientName, driveLink }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      const album = await res.json()

      if (typeof album.imported === 'number') {
        setImportSummary({ imported: album.imported, skipped: album.skipped ?? 0 })
      }

      // If password protection is enabled, set album password right away
      if (passwordProtected && albumPassword && album?.id) {
        try {
          await fetch(`/api/albums/${album.id}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: albumPassword }),
          })
        } catch {
          // Ignore non-fatal password setting errors during creation
        }
      }

      // If download toggle is off, patch it
      if (!downloadEnabled && album?.id) {
        try {
          await fetch(`/api/albums/${album.id}/download-toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
          })
        } catch {
          // Ignore
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(album?.id ? `/albums/${album.id}` : '/albums')
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      updateSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <fieldset disabled={submitting} style={{ border: 'none', padding: 0, margin: 0 }}>
        {/* 1. Google Drive Folder Link */}
        <div className={styles.field}>
          <label htmlFor="driveLinkInput" className={styles.labelRow}>
            <span className={styles.star}>*</span>
            Google Drive folder link
          </label>
          <input
            id="driveLinkInput"
            aria-label="Google Drive folder link"
            type="url"
            placeholder="https://drive.google.com/drive/folders/..."
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            required
            disabled={submitting}
            className={styles.input}
          />
        </div>

        {/* 2. Album Title */}
        <div className={styles.field}>
          <label htmlFor="albumNameInput" className={styles.labelRow}>
            <span className={styles.star}>*</span>
            Album name
          </label>
          <input
            id="albumNameInput"
            aria-label="Album name"
            type="text"
            placeholder="Album name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className={styles.input}
          />
        </div>

        {/* 3. Client Name */}
        <div className={styles.field}>
          <label htmlFor="clientNameInput" className={styles.labelRow}>
            <span className={styles.star}>*</span>
            Client name
          </label>
          <input
            id="clientNameInput"
            aria-label="Client name"
            type="text"
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            disabled={submitting}
            className={styles.input}
          />
        </div>

        {/* 4. Cover Photo info */}
        <div className={styles.field}>
          <label className={styles.labelRow}>
            Cover photo
          </label>
          <div
            className={styles.input}
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#a1a1aa',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'default',
            }}
          >
            ✦ Auto-assign first photo from Drive after import (default)
          </div>
        </div>

        {/* Settings Section: Backed options only (Rule 4) */}
        <div className={styles.settingsSection}>
          {/* 1. Password Protect Album Toggle */}
          <div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Password protect album</span>
              <button
                type="button"
                aria-pressed={passwordProtected}
                disabled={submitting}
                onClick={() => setPasswordProtected(!passwordProtected)}
                className={`${styles.toggleBtn} ${
                  passwordProtected ? styles.toggleOnOrange : styles.toggleOff
                }`}
                style={{
                  backgroundColor: passwordProtected ? '#ff5722' : '#71717a',
                  borderColor: passwordProtected ? '#e64a19' : '#52525b',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                <span
                  className={`${styles.toggleThumb} ${
                    passwordProtected ? styles.toggleThumbOn : ''
                  }`}
                />
              </button>
            </div>
            {passwordProtected && (
              <div className={styles.subInputContainer}>
                <input
                  type="text"
                  placeholder="Enter album access password..."
                  value={albumPassword}
                  onChange={(e) => setAlbumPassword(e.target.value)}
                  disabled={submitting}
                  className={styles.input}
                />
              </div>
            )}
          </div>

          {/* 2. Enable Original Download Toggle */}
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Allow photo downloads</span>
            <button
              type="button"
              aria-pressed={downloadEnabled}
              disabled={submitting}
              onClick={() => setDownloadEnabled(!downloadEnabled)}
              className={`${styles.toggleBtn} ${
                downloadEnabled ? styles.toggleOnGreen : styles.toggleOff
              }`}
              style={{
                backgroundColor: downloadEnabled ? '#10b981' : '#71717a',
                borderColor: downloadEnabled ? '#059669' : '#52525b',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <span
                className={`${styles.toggleThumb} ${
                  downloadEnabled ? styles.toggleThumbOn : ''
                }`}
              />
            </button>
          </div>
        </div>
      </fieldset>

      {importSummary && (
        <div role="status" className={styles.successAlert}>
          <div>🎉 Successfully imported {importSummary.imported} {importSummary.imported === 1 ? 'photo' : 'photos'}!</div>
          {importSummary.skipped > 0 && (
            <div style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.9 }}>
              (Skipped {importSummary.skipped} non-image {importSummary.skipped === 1 ? 'file' : 'files'})
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}

      {/* Bottom Action Buttons */}
      <div className={styles.actions}>
        {onCancel && (
          <button type="button" disabled={submitting} onClick={onCancel} className={styles.btnCancel}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={submitting} aria-label="Create album" className={styles.btnSubmit}>
          {submitting ? 'Creating…' : 'Create album'}
        </button>
      </div>
    </form>
  )
}
