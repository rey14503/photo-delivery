'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AvatarCropper } from './AvatarCropper'
import styles from './EditProfileModal.module.css'

export interface EditProfileModalProps {
  initialName?: string | null
  initialStudioName?: string | null
  initialAvatarUrl?: string | null
  initialRole?: 'OWNER' | 'ADMIN' | 'PHOTOGRAPHER'
  onClose: () => void
  onSaveSuccess: (updated: { name: string; studioName: string; avatarUrl: string | null; role: 'OWNER' | 'ADMIN' | 'PHOTOGRAPHER' }) => void
}

export function EditProfileModal({
  initialName,
  initialStudioName,
  initialAvatarUrl,
  initialRole,
  onClose,
  onSaveSuccess,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName || '')
  const [studioName, setStudioName] = useState(initialStudioName || '')
  const [role, setRole] = useState<'OWNER' | 'ADMIN' | 'PHOTOGRAPHER'>(initialRole || 'PHOTOGRAPHER')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null)
  const [imgError, setImgError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [backdropMouseDown, setBackdropMouseDown] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    fetch('/api/user/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.name) setName(data.name)
          if (data.studioName !== undefined) setStudioName(data.studioName)
          if (data.role) setRole(data.role)
          if (data.avatarUrl !== undefined) setAvatarUrl(data.avatarUrl)
        }
      })
      .catch(err => console.error('Failed to fetch latest profile:', err))
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setCropImageSrc(objectUrl)
    setCropperOpen(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', croppedBlob, 'avatar.jpg')
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl)
          setImgError(false)
          onSaveSuccess({
            name,
            studioName,
            role,
            avatarUrl: data.avatarUrl,
          })
        }
      }
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploadingAvatar(false)
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
      setCropImageSrc(null)
      setCropperOpen(false)
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
          studioName: data.studioName !== undefined ? data.studioName : studioName,
          role: data.role || role,
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
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setBackdropMouseDown(true)
        else setBackdropMouseDown(false)
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDown) onClose()
        setBackdropMouseDown(false)
      }}
    >
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <h2 className={styles.title}>Edit Profile</h2>
        <p className={styles.subtitle}>Update your profile picture and display information for clients</p>

        <form onSubmit={handleSave}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper}>
              <div
                className={styles.avatarContainer}
                data-uploading={uploadingAvatar ? 'true' : 'false'}
                onClick={() => fileInputRef.current?.click()}
                title="Update profile picture"
              >
                {avatarUrl && !imgError ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className={styles.avatarImage}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className={styles.avatarInitials}>{initials}</span>
                )}
                <div className={styles.avatarOverlay}>
                  <span>{uploadingAvatar ? 'Uploading...' : 'Change'}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.cameraBadge}
                onClick={() => fileInputRef.current?.click()}
                title="Update profile picture"
                aria-label="Update profile picture"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                </svg>
              </button>
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
              Full Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={styles.input}
              placeholder="e.g. Nguyen Khoa"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-studio" className={styles.label}>
                Nickname
              </label>
              <input
                id="edit-studio"
                type="text"
                value={studioName}
                onChange={e => setStudioName(e.target.value)}
                className={styles.input}
                placeholder="e.g. Rey"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="edit-role" className={styles.label}>
                Role
              </label>
              <input
                id="edit-role"
                type="text"
                value={role === 'OWNER' ? 'Owner' : role === 'ADMIN' ? 'Admin' : 'Photographer'}
                disabled
                className={`${styles.input} ${styles.readOnlyInput}`}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading || uploadingAvatar} className={styles.saveBtn}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <AvatarCropper
        imageSrc={cropImageSrc}
        isOpen={cropperOpen}
        onClose={() => {
          setCropperOpen(false)
          if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
          setCropImageSrc(null)
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}
