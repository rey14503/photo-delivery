'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  DeleteOutlineIcon,
  FolderOutlineIcon,
  EditOutlineIcon,
  UserOutlineIcon,
  CalendarOutlineIcon,
  CameraOutlineIcon,
  CopyOutlineIcon,
  CheckOutlineIcon,
  CloseOutlineIcon,
  ShareNetworkIcon,
  PhoneOutlineIcon,
  KeyOutlineIcon,
  WarningOutlineIcon,
} from './PhotoIcons'
import styles from './AlbumCard.module.css'

export interface AlbumCardProps {
  album: {
    id: string
    name: string
    clientName: string
    photographerName?: string | null
    shareToken: string
    hasPassword: boolean
    photoCount: number
    createdAt: string | Date
    coverUrl?: string | null
    coverPhotoId?: string | null
    samplePhotos?: { id: string; name: string; url: string }[]
    downloadEnabled?: boolean
    selectionLimit?: number | null
    clientEmail?: string | null
    location?: string | null
  }
}

export function AlbumCard({ album }: AlbumCardProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [editName, setEditName] = useState(album.name)
  const [editClientName, setEditClientName] = useState(album.clientName)
  const [editCoverPhotoId, setEditCoverPhotoId] = useState<string | null>(album.coverPhotoId || null)
  const [saving, setSaving] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isCoverHovered, setIsCoverHovered] = useState(false)
  const [imgSrc, setImgSrc] = useState(album.coverUrl || null)
  const [retryCount, setRetryCount] = useState(0)
  const [imgError, setImgError] = useState(false)

  // Access Permissions & Security state (synced with PhotographerGallery share modal)
  const [downloadsOn, setDownloadsOn] = useState(album.downloadEnabled ?? false)
  const [togglingDownloads, setTogglingDownloads] = useState(false)

  const [hasPass, setHasPass] = useState(album.hasPassword)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [selectionLimitOn, setSelectionLimitOn] = useState((album.selectionLimit ?? 0) > 0)
  const [selectionLimitVal, setSelectionLimitVal] = useState<number>(album.selectionLimit ?? 0)
  const [updatingLimit, setUpdatingLimit] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalInput, setLimitModalInput] = useState<string>('30')
  const [limitError, setLimitError] = useState<string | null>(null)

  useEffect(() => {
    if ((album.coverUrl || null) !== (imgSrc || null) && retryCount === 0 && !imgError) {
      setImgSrc(album.coverUrl || null)
    }
  }, [album.coverUrl, imgSrc, retryCount, imgError])

  const handleCoverError = () => {
    if (!imgSrc) return setImgError(true)
    if (imgSrc.includes('type=preview')) {
      setImgSrc(imgSrc.replace('type=preview', 'type=thumb'))
    } else if (retryCount < 2) {
      setRetryCount((prev) => prev + 1)
      const sep = imgSrc.includes('?') ? '&' : '?'
      setImgSrc(`${imgSrc.replace(/&retry=\d+/, '')}${sep}retry=${Date.now()}`)
    } else {
      setImgError(true)
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = origin ? `${origin}/a/${album.shareToken}` : `/a/${album.shareToken}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleDownloads = async () => {
    const targetState = !downloadsOn
    setDownloadsOn(targetState)
    setTogglingDownloads(true)
    try {
      const res = await fetch(`/api/albums/${album.id}/download-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState }),
      })
      if (!res.ok) {
        setDownloadsOn(!targetState)
      } else {
        router.refresh()
      }
    } catch {
      setDownloadsOn(!targetState)
    } finally {
      setTogglingDownloads(false)
    }
  }

  const handleSavePassword = async (passValue: string | null) => {
    setPasswordLoading(true)
    setPasswordError(null)
    try {
      const res = await fetch(`/api/albums/${album.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passValue }),
      })
      if (!res.ok) {
        const data = await res.json()
        setPasswordError(data.error ?? 'Failed to update password')
        return
      }
      setHasPass(Boolean(passValue))
      setPasswordInput('')
      setShowPasswordModal(false)
      router.refresh()
    } catch {
      setPasswordError('Network error — please try again.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleOpenLimitModal = () => {
    setLimitModalInput(selectionLimitVal > 0 ? String(selectionLimitVal) : '30')
    setLimitError(null)
    setShowLimitModal(true)
  }

  const handleSaveSelectionLimit = async (newLimit: number) => {
    if (newLimit < 0) return
    setUpdatingLimit(true)
    setLimitError(null)
    try {
      const res = await fetch(`/api/albums/${album.id}/selection-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: newLimit }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setLimitError(err?.error || 'Failed to save selection limit')
      } else {
        const data = await res.json()
        setSelectionLimitVal(data.selectionLimit)
        setSelectionLimitOn(data.selectionLimit > 0)
        setShowLimitModal(false)
        router.refresh()
      }
    } catch {
      setLimitError('Network error while updating selection limit')
    } finally {
      setUpdatingLimit(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: { name: string; clientName: string; coverPhotoId?: string | null } = {
        name: editName,
        clientName: editClientName,
      }
      if (editCoverPhotoId !== (album.coverPhotoId || null)) {
        payload.coverPhotoId = editCoverPhotoId
      }
      const res = await fetch(`/api/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setIsEditing(false)
        router.refresh()
      } else {
        console.error('Failed to update album')
      }
    } catch {
      console.error('Network error while saving album')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/albums/${album.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.refresh()
      } else {
        console.error('Failed to delete album')
        setDeleting(false)
      }
    } catch {
      console.error('Network error while deleting album')
      setDeleting(false)
    }
  }

  const dateObj = new Date(album.createdAt)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  })

  return (
    <article className={styles.card}>
      <div
        className={styles.coverContainer}
        onMouseEnter={() => setIsCoverHovered(true)}
        onMouseLeave={() => setIsCoverHovered(false)}
      >
        {(imgSrc || album.coverUrl) && !imgError ? (
          <img
            src={imgSrc || album.coverUrl!}
            alt=""
            className={styles.coverImage}
            loading="lazy"
            onError={handleCoverError}
          />
        ) : (
          <div className={styles.coverPlaceholder}>
            <CameraOutlineIcon size={42} />
            <span>Album Cover</span>
          </div>
        )}



        <button
          type="button"
          onClick={() => {
            setIsEditing(false)
            setShowShareModal(false)
            setIsDeleting(true)
          }}
          className={styles.deleteCircleBtn}
          style={{
            opacity: isCoverHovered ? 1 : 0,
            visibility: isCoverHovered ? 'visible' : 'hidden',
            pointerEvents: isCoverHovered ? 'auto' : 'none',
            transform: isCoverHovered ? 'scale(1)' : 'scale(0.85)',
          }}
          title="Delete Album"
          aria-label="Delete Album"
        >
          <DeleteOutlineIcon size={18} />
        </button>

        <div
          className={styles.centerButtonsRow}
          style={{
            opacity: isCoverHovered ? 1 : 0,
            pointerEvents: isCoverHovered ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/albums/${album.id}`)}
            className={styles.btnChiTiet}
          >
            <span className={styles.btnIcon}>
              <FolderOutlineIcon size={16} />
            </span>
            Details
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDeleting(false)
              setShowShareModal(false)
              setEditName(album.name)
              setEditClientName(album.clientName)
              setIsEditing(true)
            }}
            className={styles.btnChinhSua}
          >
            <span className={styles.btnIcon}>
              <EditOutlineIcon size={16} />
            </span>
            Edit
          </button>

        </div>
      </div>

      <div className={styles.contentContainer}>
        <h3
          className={styles.title}
          onClick={() => router.push(`/albums/${album.id}`)}
          title={album.name}
        >
          {album.name}
        </h3>

        <ul className={styles.metaList}>
          <li className={styles.metaRow}>
            <span className={styles.metaIcon}>
              <UserOutlineIcon size={16} />
            </span>
            <span>
              {album.clientName}
            </span>
          </li>
          <li className={styles.metaRow}>
            <span className={styles.metaIcon}>
              <CameraOutlineIcon size={16} />
            </span>
            <span>By {album.photographerName || 'Photographer'}</span>
          </li>
          <li className={styles.metaRow}>
            <span className={styles.metaIcon}>
              <FolderOutlineIcon size={16} />
            </span>
            <span>
              {album.photoCount} {album.photoCount === 1 ? 'photo' : 'photos'}
            </span>
          </li>
        </ul>

        <div className={styles.footer}>
          <span className={styles.dateText}>
            <span className={styles.metaIcon}>
              <CalendarOutlineIcon size={15} />
            </span>
            {formattedDate}
          </span>

          <div className={styles.footerRight}>
            <span className={styles.statusBadge}>
              {album.downloadEnabled ? 'DOWNLOAD ON' : 'PREVIEW ONLY'}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsEditing(false)
                setIsDeleting(false)
                setShowShareModal(true)
              }}
              className={styles.shareIconBtn}
              title="Share / Menu tùy chọn"
              aria-label="Menu tùy chọn"
            >
              <ShareNetworkIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && showShareModal && createPortal(
        <div
          className={styles.modalOverlay}
          onClick={() => setShowShareModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Share to client Modal"
        >
          <div className={styles.modalCard} style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <div>
                <h3 className={styles.shareModalTitle}>Share to client</h3>
                <p className={styles.shareModalSubtitle}>
                  Scan the QR code or copy the full access link below to share with your client.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className={styles.shareModalCloseBtn}
                aria-label="Close modal"
              >
                <CloseOutlineIcon size={16} />
              </button>
            </div>

            <div className={styles.shareModalQrContainer}>
              <div className={styles.shareModalQrCard}>
                <QRCodeSVG value={shareUrl} size={220} level="M" />
              </div>
              <span className={styles.shareModalQrHint}>
                <PhoneOutlineIcon size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Scan with camera or QR reader on phone
              </span>
            </div>

            <div className={styles.shareModalLinkRow}>
              <div className={styles.shareModalLinkBox}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className={styles.shareModalLinkInput}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  aria-label="Full client access link URL"
                />
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`${styles.shareModalCopyBtn} ${copied ? styles.shareModalCopyBtnActive : ''}`}
                aria-label="Copy link"
              >
                {copied ? (
                  <>
                    <CheckOutlineIcon size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Copied
                  </>
                ) : (
                  <>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {copied && (
              <div role="alert" className={styles.shareModalCopiedAlert}>
                Link copied to clipboard!
              </div>
            )}

            {/* Access Permissions & Security — synced with PhotographerGallery */}
            <div className={styles.shareModalOptionsSection}>
              <h4 className={styles.shareModalOptionsHeading}>Access Permissions & Security</h4>

              <div className={styles.shareModalOptionRow}>
                <div className={styles.shareModalOptionInfo}>
                  <span className={styles.shareModalOptionTitle}>Allow client photo downloads</span>
                  <span className={styles.shareModalOptionDesc}>Let clients download high-resolution and preview photos</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleDownloads}
                  disabled={togglingDownloads}
                  className={`${styles.toggleSwitch} ${downloadsOn ? styles.toggleSwitchActive : ''}`}
                  aria-label="Toggle downloads in share modal"
                >
                  <div className={styles.toggleSwitchThumb} />
                </button>
              </div>

              <div className={styles.shareModalOptionRow}>
                <div className={styles.shareModalOptionInfo}>
                  <span className={styles.shareModalOptionTitle}>Password protection</span>
                  <span className={styles.shareModalOptionDesc}>
                    {hasPass ? 'Client must enter secret password before viewing album' : 'No password set (accessible directly via link)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setPasswordError(null); setPasswordInput(''); setShowPasswordModal(true); }}
                  className={styles.passwordModalTriggerBtn}
                >
                  {hasPass ? 'Change pass' : '+ Set pass'}
                </button>
              </div>

              <div className={styles.shareModalOptionRow}>
                <div className={styles.shareModalOptionInfo}>
                  <span className={styles.shareModalOptionTitle}>Limit client photo selection</span>
                  <span className={styles.shareModalOptionDesc}>
                    {selectionLimitOn ? `Client is limited to selecting at most ${selectionLimitVal} photos` : 'No selection limit set (client can select unlimited photos)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLimitModal}
                  className={styles.passwordModalTriggerBtn}
                  aria-label="Configure selection limit inside share modal"
                >
                  {selectionLimitOn ? `${selectionLimitVal} photos (Edit)` : '+ Set limit'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Password Configuration Popup Modal */}
      {typeof document !== 'undefined' && showPasswordModal && createPortal(
        <div
          className={styles.passwordModalOverlay}
          onClick={() => setShowPasswordModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Configure Album Password Modal"
        >
          <div className={styles.passwordModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyOutlineIcon size={20} />
                <div>
                  <h2 className={styles.shareModalTitle}>Album Password</h2>
                  <p className={styles.shareModalSubtitle}>Protect your client gallery with a secret password or remove existing protection.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className={styles.shareModalCloseBtn}
                aria-label="Close password modal"
              >
                <CloseOutlineIcon size={16} />
              </button>
            </div>

            <div className={styles.passwordInputContainer}>
              <label htmlFor={`card-album-pass-${album.id}`} className={styles.passwordLabel}>Secret Password</label>
              <input
                id={`card-album-pass-${album.id}`}
                type="password"
                placeholder="Enter new album password..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={styles.passwordInput}
              />
              {passwordError && (
                <div role="alert" className={styles.passwordAlert} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <WarningOutlineIcon size={16} />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            <div className={styles.passwordActions}>
              {hasPass && (
                <button
                  type="button"
                  onClick={() => handleSavePassword(null)}
                  disabled={passwordLoading}
                  className={styles.btnRemovePass}
                >
                  {passwordLoading ? 'Saving...' : 'Remove password'}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => handleSavePassword(passwordInput || null)}
                disabled={passwordLoading}
                className={styles.btnSavePass}
              >
                {passwordLoading ? 'Saving...' : (hasPass ? 'Change password' : 'Save password')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Selection Limit Configuration Popup Modal */}
      {typeof document !== 'undefined' && showLimitModal && createPortal(
        <div
          className={styles.passwordModalOverlay}
          onClick={() => setShowLimitModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Selection Limit Modal"
        >
          <div className={styles.passwordModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <EditOutlineIcon size={20} />
                <div>
                  <h2 className={styles.shareModalTitle}>Client Selection Limit</h2>
                  <p className={styles.shareModalSubtitle}>Set the maximum number of photos your client can choose or remove the limit.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className={styles.shareModalCloseBtn}
                aria-label="Close limit modal"
              >
                <CloseOutlineIcon size={16} />
              </button>
            </div>

            <div className={styles.passwordInputContainer}>
              <label htmlFor={`card-selection-limit-${album.id}`} className={styles.passwordLabel}>Maximum Photos Allowed</label>
              <input
                id={`card-selection-limit-${album.id}`}
                type="number"
                min="1"
                placeholder="Enter maximum photo limit (e.g. 30)..."
                value={limitModalInput}
                onChange={(e) => setLimitModalInput(e.target.value)}
                className={styles.passwordInput}
                autoFocus
              />
              {limitError && (
                <div role="alert" className={styles.passwordAlert} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <WarningOutlineIcon size={16} />
                  <span>{limitError}</span>
                </div>
              )}
            </div>

            <div className={styles.passwordActions}>
              {selectionLimitOn && (
                <button
                  type="button"
                  onClick={() => handleSaveSelectionLimit(0)}
                  disabled={updatingLimit}
                  className={styles.btnRemovePass}
                >
                  {updatingLimit ? 'Saving...' : 'Remove limit (Turn OFF)'}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => {
                  const val = Number(limitModalInput)
                  if (!val || isNaN(val) || val <= 0) {
                    setLimitError('Please enter a valid positive number greater than 0.')
                    return
                  }
                  handleSaveSelectionLimit(val)
                }}
                disabled={updatingLimit}
                className={styles.btnSavePass}
              >
                {updatingLimit ? 'Saving...' : selectionLimitOn ? 'Update Limit' : 'Turn ON & Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {typeof document !== 'undefined' && isEditing && !isDeleting && createPortal(
        <div className={styles.modalOverlay} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalCard}>
            <h3 className={styles.editTitle}>Edit Album</h3>
            <form
              onSubmit={handleSave}
              style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#a0a0ab' }}>Album:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={styles.editInput}
                  placeholder="Album Name"
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#a0a0ab' }}>Client:</label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className={styles.editInput}
                  placeholder="Client Name"
                  required
                />
              </div>
              {album.samplePhotos && album.samplePhotos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#a0a0ab' }}>Cover Photo:</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {editCoverPhotoId && (
                      <img
                        src={album.samplePhotos.find((p) => p.id === editCoverPhotoId)?.url || album.coverUrl || ''}
                        alt="Cover preview"
                        style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid #ff5722' }}
                      />
                    )}
                    <select
                      value={editCoverPhotoId || ''}
                      onChange={(e) => setEditCoverPhotoId(e.target.value || null)}
                      className={styles.editInput}
                      style={{ flex: 1, cursor: 'pointer' }}
                    >
                      <option value="">-- Auto (First Photo) --</option>
                      {album.samplePhotos.map((p, idx) => (
                        <option key={p.id} value={p.id}>
                          {p.name || `Photo #${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className={styles.editBtnRow}>
                <button type="submit" disabled={saving} className={styles.saveBtn}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {typeof document !== 'undefined' && isDeleting && !isEditing && createPortal(
        <div className={styles.modalOverlay} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalCard}>
            <div className={styles.confirmBox}>
              <p className={styles.confirmText}>
                Are you sure you want to delete album <strong>&quot;{album.name}&quot;</strong>?
              </p>
              <div className={styles.editBtnRow}>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={styles.deleteConfirmBtn}
                >
                  {deleting ? 'Deleting...' : 'Delete Album'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleting(false)}
                  disabled={deleting}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </article>
  )
}
