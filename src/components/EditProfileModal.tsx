'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './EditProfileModal.module.css'

export interface EditProfileModalProps {
  initialName?: string | null
  initialStudioName?: string | null
  initialAvatarUrl?: string | null
  onClose: () => void
  onSaveSuccess: (updated: { name: string; studioName: string; avatarUrl: string | null }) => void
}

export function EditProfileModal({
  initialName,
  initialStudioName,
  initialAvatarUrl,
  onClose,
  onSaveSuccess,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName || '')
  const [studioName, setStudioName] = useState(initialStudioName || '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl)
        }
      }
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, studioName }),
      })
      if (res.ok) {
        const data = await res.json()
        onSaveSuccess({
          name: data.name || name,
          studioName: data.studioName || studioName,
          avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : avatarUrl,
        })
        onClose()
      }
    } catch (err) {
      console.error('Save profile failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'BK'

  const modalContent = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Chỉnh sửa thông tin cá nhân</h2>
        <p className={styles.subtitle}>Cập nhật ảnh đại diện và thông tin hiển thị với khách hàng</p>

        <form onSubmit={handleSave}>
          <div className={styles.avatarSection}>
            <div
              className={styles.avatarContainer}
              onClick={() => fileInputRef.current?.click()}
              title="Đổi ảnh đại diện"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className={styles.avatarImage} />
              ) : (
                <span className={styles.avatarInitials}>{initials}</span>
              )}
              <div className={styles.avatarOverlay}>
                <span>{uploadingAvatar ? 'Đang tải...' : 'Thay ảnh'}</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-name" className={styles.label}>
              Họ và tên
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={styles.input}
              placeholder="VD: Nguyễn Khoa"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="edit-studio" className={styles.label}>
              Tên Studio / Danh xưng
            </label>
            <input
              id="edit-studio"
              type="text"
              value={studioName}
              onChange={e => setStudioName(e.target.value)}
              className={styles.input}
              placeholder="VD: Chủ Studio (PRO)"
            />
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Hủy
            </button>
            <button type="submit" disabled={loading || uploadingAvatar} className={styles.saveBtn}>
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
