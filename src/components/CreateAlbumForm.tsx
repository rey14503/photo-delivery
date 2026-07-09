'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from './CreateAlbumForm.module.css'

export interface CreateAlbumFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function CreateAlbumForm({ onSuccess, onCancel }: CreateAlbumFormProps = {}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')

  // Backed settings toggles
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [albumPassword, setAlbumPassword] = useState('')
  const [downloadEnabled, setDownloadEnabled] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clientName }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      const album = await res.json()

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
        router.push('/albums')
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Album Title */}
      <div className={styles.field}>
        <label htmlFor="albumNameInput" className={styles.labelRow}>
          <span className={styles.star}>*</span>
          Tên album (Album name)
        </label>
        <input
          id="albumNameInput"
          aria-label="Album name"
          type="text"
          placeholder="Tên album"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.input}
        />
      </div>

      {/* Client Name */}
      <div className={styles.field}>
        <label htmlFor="clientNameInput" className={styles.labelRow}>
          <span className={styles.star}>*</span>
          Tên khách hàng (Client name)
        </label>
        <input
          id="clientNameInput"
          aria-label="Client name"
          type="text"
          placeholder="Tên khách hàng"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className={styles.input}
        />
      </div>

      {/* Settings Section: Backed options only (Rule 4) */}
      <div className={styles.settingsSection}>
        {/* 1. Bảo vệ album bằng mật khẩu Toggle */}
        <div>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Bảo vệ album bằng mật khẩu</span>
            <button
              type="button"
              onClick={() => setPasswordProtected(!passwordProtected)}
              className={`${styles.toggleBtn} ${
                passwordProtected ? styles.toggleOnOrange : styles.toggleOff
              }`}
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
                placeholder="Nhập mật khẩu truy cập album..."
                value={albumPassword}
                onChange={(e) => setAlbumPassword(e.target.value)}
                className={styles.input}
              />
            </div>
          )}
        </div>

        {/* 2. Cho phép tải xuống Toggle */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Cho phép tải xuống gốc</span>
          <button
            type="button"
            onClick={() => setDownloadEnabled(!downloadEnabled)}
            className={`${styles.toggleBtn} ${
              downloadEnabled ? styles.toggleOnGreen : styles.toggleOff
            }`}
          >
            <span
              className={`${styles.toggleThumb} ${
                downloadEnabled ? styles.toggleThumbOn : ''
              }`}
            />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}

      {/* Bottom Action Buttons */}
      <div className={styles.actions}>
        {onCancel && (
          <button type="button" onClick={onCancel} className={styles.btnCancel}>
            Hủy bỏ
          </button>
        )}
        <button type="submit" disabled={submitting} aria-label="Create album" className={styles.btnSubmit}>
          {submitting ? 'Creating…' : 'Tạo ngay'}
        </button>
      </div>
    </form>
  )
}
