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
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState<'wedding' | 'fashion' | 'portrait' | 'studio'>('wedding')

  // Setting Toggles matching exact AI Studio mockup
  const [refreshTime, setRefreshTime] = useState('Không')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [albumPassword, setAlbumPassword] = useState('')
  const [downloadEnabled, setDownloadEnabled] = useState(true)
  const [maxSelectedLimit, setMaxSelectedLimit] = useState(false)
  const [maxSelectedCount, setMaxSelectedCount] = useState(50)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleFillDemoDriveLink() {
    setGoogleDriveLink('https://drive.google.com/drive/folders/1A_B_C_Demo_BK_Media_Box')
    if (!name) setName('Album Ngoại Cảnh Đà Lạt')
    if (!clientName) setClientName('Khách Hàng Nguyễn Văn A')
  }

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
      {/* Google Drive Link input with cyan plus button */}
      <div className={styles.field}>
        <label htmlFor="driveInput" className={styles.labelRow}>
          <span className={styles.star}>*</span>
          Link ảnh Google Drive
          <span
            className={styles.helpIcon}
            title="Dán liên kết thư mục chứa ảnh trên Google Drive vào đây để hệ thống tự động đồng bộ ảnh vào album của khách."
          >
            ?
          </span>
        </label>
        <div className={styles.inputGroup}>
          <input
            id="driveInput"
            type="url"
            placeholder="Link Google Drive thư mục chứa ảnh vào đây"
            value={googleDriveLink}
            onChange={(e) => setGoogleDriveLink(e.target.value)}
            className={styles.input}
          />
          <button
            type="button"
            onClick={handleFillDemoDriveLink}
            title="Tự động điền link mẫu Google Drive"
            className={styles.btnPlus}
          >
            +
          </button>
        </div>
      </div>

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

      {/* Client Email & Location Info */}
      <div className={styles.grid2}>
        <div className={styles.field}>
          <label htmlFor="emailInput" className={styles.labelRow}>
            Email khách hàng
          </label>
          <input
            id="emailInput"
            type="email"
            placeholder="client@gmail.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="locationInput" className={styles.labelRow}>
            Địa điểm chụp
          </label>
          <input
            id="locationInput"
            type="text"
            placeholder="Địa điểm chụp..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={styles.input}
          />
        </div>
      </div>

      {/* Album Cover Preset Selector */}
      <div className={styles.presetContainer}>
        <div className={styles.labelRow}>
          <span className={styles.star}>*</span>
          Chọn ảnh bìa album
        </div>
        <div className={styles.subLabel}>Preset thể loại: {category.toUpperCase()}</div>
        <div className={styles.chips}>
          {(['wedding', 'fashion', 'portrait', 'studio'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`${styles.chip} ${category === cat ? styles.chipActive : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Rows */}
      <div className={styles.settingsSection}>
        {/* 1. Thời gian làm mới Dropdown */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Thời gian làm mới</span>
          <select
            value={refreshTime}
            onChange={(e) => setRefreshTime(e.target.value)}
            className={styles.select}
          >
            <option value="Không">Không</option>
            <option value="1 ngày">1 ngày</option>
            <option value="3 ngày">3 ngày</option>
            <option value="1 tuần">1 tuần</option>
          </select>
        </div>

        {/* 2. Cho phép bình luận Toggle */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Cho phép bình luận</span>
          <button
            type="button"
            onClick={() => setCommentsEnabled(!commentsEnabled)}
            className={`${styles.toggleBtn} ${
              commentsEnabled ? styles.toggleOnGreen : styles.toggleOff
            }`}
          >
            <span
              className={`${styles.toggleThumb} ${
                commentsEnabled ? styles.toggleThumbOn : ''
              }`}
            />
          </button>
        </div>

        {/* 3. Bảo vệ album bằng mật khẩu Toggle */}
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

        {/* 4. Cho phép tải xuống Toggle */}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Cho phép tải xuống</span>
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

        {/* 5. Giới hạn số lượng ảnh được chọn Toggle */}
        <div>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>Giới hạn số lượng ảnh được chọn</span>
            <button
              type="button"
              onClick={() => setMaxSelectedLimit(!maxSelectedLimit)}
              className={`${styles.toggleBtn} ${
                maxSelectedLimit ? styles.toggleOnOrange : styles.toggleOff
              }`}
            >
              <span
                className={`${styles.toggleThumb} ${
                  maxSelectedLimit ? styles.toggleThumbOn : ''
                }`}
              />
            </button>
          </div>
          {maxSelectedLimit && (
            <div className={styles.subInputContainer}>
              <div className={styles.subInputRow}>
                <span style={{ color: '#a1a1aa' }}>Giới hạn:</span>
                <input
                  type="number"
                  min="1"
                  value={maxSelectedCount}
                  onChange={(e) => setMaxSelectedCount(parseInt(e.target.value) || 50)}
                  className={styles.numInput}
                />
                <span style={{ color: '#a1a1aa' }}>ảnh</span>
              </div>
            </div>
          )}
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
