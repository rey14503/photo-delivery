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
              <span className={styles.shareModalQrHint}>Scan with camera or QR reader on phone</span>
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
                aria-label={copied ? 'Đã copy!' : 'Copy link'}
              >
                {copied ? (
                  <>
                    <CheckOutlineIcon size={15} /> Copied!
                  </>
                ) : (
                  <>
                    <CopyOutlineIcon size={15} /> Copy Link
                  </>
                )}
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
