'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import { useReplacePhoto } from '@/lib/hooks/useReplacePhoto'
import type { ThreadComment } from './CommentThread'
import {
  MoreActionsIcon,
  EditOutlineIcon,
  CopyOutlineIcon,
  CheckOutlineIcon,
  DeleteOutlineIcon,
  CalendarOutlineIcon,
  FolderOutlineIcon,
  LockOutlineIcon,
  SearchOutlineIcon,
  CloseOutlineIcon,
  WarningOutlineIcon,
  PhoneOutlineIcon,
  UnlockIcon,
  LockIcon,
  ShareNetworkIcon,
  UploadTrayIcon,
  HourglassOutlineIcon,
  ClipboardListIcon,
  TxtFileIcon,
  ZipBoxIcon,
} from './PhotoIcons'
import { AlbumActionMenu } from './AlbumActionMenu'
import styles from './PhotographerGallery.module.css'

export interface PhotographerGalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  name?: string
  version: number
  suggestedByMe: boolean
  clientLikers: string[]
  comments: ThreadComment[]
}

export interface PhotographerGalleryAlbumInfo {
  id?: string
  name?: string
  clientName?: string
  photographerName?: string
  shareToken?: string
  date?: string
  downloadEnabled?: boolean
  hasPassword?: boolean
  coverPhotoId?: string | null
  selectionLocked?: boolean
}

function statusNoteFor(photo: PhotographerGalleryPhoto): string | undefined {
  return photo.clientLikers.length > 0 ? `❤ Selected by: ${photo.clientLikers.join(', ')}` : undefined
}

export interface PhotographerGalleryProps {
  photos?: PhotographerGalleryPhoto[]
  albumInfo?: PhotographerGalleryAlbumInfo
  albumId?: string
  albumName?: string
  clientName?: string
  shareToken?: string
  initialPhotos?: PhotographerGalleryPhoto[]
  selectionLocked?: boolean
}

export function PhotographerGallery(props: PhotographerGalleryProps) {
  const photos = props.photos ?? props.initialPhotos ?? []
  const albumInfo: PhotographerGalleryAlbumInfo = useMemo(() => props.albumInfo ?? {
    id: props.albumId,
    name: props.albumName,
    clientName: props.clientName,
    shareToken: props.shareToken,
    selectionLocked: props.selectionLocked,
  }, [props.albumInfo, props.albumId, props.albumName, props.clientName, props.shareToken, props.selectionLocked])
  const router = useRouter()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'suggested' | 'selected' | 'comments'>('all')
  const [sortBy, setSortBy] = useState<'default' | 'version' | 'comments-count'>('default')
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const albumId = props.albumId ?? albumInfo.id
  const [isLocked, setIsLocked] = useState(Boolean(props.selectionLocked ?? albumInfo.selectionLocked))
  const [unlocking, setUnlocking] = useState(false)

  const clientLikedPhotosCount = photos.filter((p) => p.clientLikers.length > 0).length

  async function handleUnlockSelection() {
    if (!albumId) return
    setUnlocking(true)
    try {
      const res = await fetch(`/api/albums/${albumId}/unlock-selection`, { method: 'PATCH' })
      if (res.ok) setIsLocked(false)
    } finally {
      setUnlocking(false)
    }
  }

  const [locking, setLocking] = useState(false)

  async function handleLockSelection() {
    if (!albumId) return
    setLocking(true)
    try {
      const res = await fetch(`/api/albums/${albumId}/lock-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) setIsLocked(true)
    } finally {
      setLocking(false)
    }
  }

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  function getSelectedFilenamesList(): string[] {
    const clientSelected = photos.filter((p) => p.clientLikers.length > 0)
    const targetPhotos = clientSelected.length > 0 ? clientSelected : photos.filter((p) => p.suggestedByMe)
    return targetPhotos.map((p) => p.name && p.name.trim() ? p.name.trim() : p.id)
  }

  async function handleCopyFilenames() {
    const list = getSelectedFilenamesList()
    if (list.length === 0) {
      setCopyFeedback('No selected photos to copy')
      setTimeout(() => setCopyFeedback(null), 3000)
      return
    }
    const str = list.join(', ')
    await navigator.clipboard?.writeText(str)
    setCopyFeedback(`Copied ${list.length} filenames to clipboard!`)
    setTimeout(() => setCopyFeedback(null), 3000)
  }

  function handleExportTxt() {
    const list = getSelectedFilenamesList()
    if (list.length === 0) return
    const content = list.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(displayName || props.albumName || 'album').replace(/[^a-zA-Z0-9-_]/g, '_')}-selected-filenames.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const [showAlbumMenu, setShowAlbumMenu] = useState(false)
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editName, setEditName] = useState(albumInfo?.name || '')
  const [editClientName, setEditClientName] = useState(albumInfo?.clientName || '')
  const [editCoverPhotoId, setEditCoverPhotoId] = useState<string | null>(albumInfo?.coverPhotoId ?? null)
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(albumInfo?.name || '')
  const [displayClientName, setDisplayClientName] = useState(albumInfo?.clientName || '')

  const [downloadsOn, setDownloadsOn] = useState(albumInfo?.downloadEnabled ?? true)
  const [togglingDownloads, setTogglingDownloads] = useState(false)

  const [hasPass, setHasPass] = useState(albumInfo?.hasPassword ?? false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [isDeletingAlbum, setIsDeletingAlbum] = useState(false)
  const [deletingAlbum, setDeletingAlbum] = useState(false)
  const [deleteAlbumError, setDeleteAlbumError] = useState<string | null>(null)

  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    if (albumInfo) {
      setEditName(albumInfo.name || '')
      setEditClientName(albumInfo.clientName || '')
      setDisplayName(albumInfo.name || '')
      setDisplayClientName(albumInfo.clientName || '')
      setEditCoverPhotoId(albumInfo?.coverPhotoId ?? null)
      if (albumInfo.downloadEnabled !== undefined) {
        setDownloadsOn(albumInfo.downloadEnabled)
      }
      if (albumInfo.hasPassword !== undefined) {
        setHasPass(albumInfo.hasPassword)
      }
    }
  }, [albumInfo])

  async function handleToggleDownloads() {
    if (!albumInfo?.id) return
    const targetState = !downloadsOn
    setDownloadsOn(targetState)
    setTogglingDownloads(true)
    try {
      const res = await fetch(`/api/albums/${albumInfo.id}/download-toggle`, {
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

  async function handleSavePassword(passValue: string | null) {
    if (!albumInfo?.id) return
    setPasswordLoading(true)
    setPasswordError(null)
    try {
      const res = await fetch(`/api/albums/${albumInfo.id}/password`, {
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

  async function handleQuickUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!albumInfo?.id) return
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingPhotos(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.set('file', file)
        const res = await fetch(`/api/albums/${albumInfo.id}/photos`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          setUploadError(data.error ?? 'Something went wrong while uploading.')
          setUploadingPhotos(false)
          return
        }
      }
      router.refresh()
    } catch {
      setUploadError('Network error — please check your connection.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    if (!albumInfo?.id) return
    setSavingInfo(true)
    setInfoError(null)
    try {
      const payload: { name: string; clientName: string; coverPhotoId?: string | null } = {
        name: editName,
        clientName: editClientName,
      }
      if (editCoverPhotoId !== (albumInfo.coverPhotoId ?? null)) {
        payload.coverPhotoId = editCoverPhotoId
      }
      const res = await fetch(`/api/albums/${albumInfo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let errorMsg = 'Failed to update album info'
        try {
          const data = await res.json()
          if (data.error) errorMsg = data.error
        } catch {
          try {
            const text = await res.text()
            if (text) errorMsg = text.slice(0, 100)
          } catch {}
        }
        setInfoError(errorMsg)
        return
      }
      const updated = await res.json()
      setDisplayName(updated.name ?? editName)
      setDisplayClientName(updated.clientName ?? editClientName)
      if (updated.coverPhotoId !== undefined) {
        setEditCoverPhotoId(updated.coverPhotoId)
      }
      setIsEditingInfo(false)
      router.refresh()
    } catch {
      setInfoError('Network error — please try again.')
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleDeleteAlbum() {
    if (!albumInfo?.id) return
    setDeletingAlbum(true)
    setDeleteAlbumError(null)
    try {
      const res = await fetch(`/api/albums/${albumInfo.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setIsDeletingAlbum(false)
        router.push('/albums')
      } else {
        let err = 'Could not delete album.'
        try {
          const d = await res.json()
          if (d.error) err = d.error
        } catch {}
        setDeleteAlbumError(err)
        setDeletingAlbum(false)
      }
    } catch {
      setDeleteAlbumError('Network error while deleting album.')
      setDeletingAlbum(false)
    }
  }

  function handleCopyShareLink() {
    if (!albumInfo?.shareToken) return
    const url = origin ? `${origin}/a/${albumInfo.shareToken}` : `${window.location.origin}/a/${albumInfo.shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = albumInfo?.shareToken ? (origin ? `${origin}/a/${albumInfo.shareToken}` : `/a/${albumInfo.shareToken}`) : ''

  // Processing photos matching exact AI Studio logic
  let processedPhotos = [...photos]

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    processedPhotos = processedPhotos.filter(
      (p) => p.id.toLowerCase().includes(query) || p.thumbnailUrl.toLowerCase().includes(query)
    )
  }

  if (filter === 'suggested') {
    processedPhotos = processedPhotos.filter((p) => p.suggestedByMe)
  } else if (filter === 'selected') {
    processedPhotos = processedPhotos.filter((p) => p.clientLikers.length > 0)
  } else if (filter === 'comments') {
    processedPhotos = processedPhotos.filter((p) => p.comments.length > 0)
  }

  if (sortBy === 'version') {
    processedPhotos.sort((a, b) => b.version - a.version)
  } else if (sortBy === 'comments-count') {
    processedPhotos.sort((a, b) => b.comments.length - a.comments.length)
  }

  return (
    <div className={styles.container}>
      {/* Album Specs Card / Banner when albumInfo is passed */}
      {albumInfo && (
        <div className={styles.banner}>
          <div className={styles.bannerLeft}>
            <Link href="/albums" className={styles.backToMenuBtn} aria-label="Back to main menu">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              <span>Back to Main Menu</span>
            </Link>
            <div className={styles.modeBadgeRow}>
              <span className={styles.modeBadge}>Photographer Mode</span>
              {isLocked ? (
                <span className={styles.submittedBadge}>
                  <CheckOutlineIcon size={14} />
                  <span>CLIENT SUBMITTED ({clientLikedPhotosCount} PHOTOS)</span>
                </span>
              ) : (
                <span className={styles.proofingBadge}>
                  <HourglassOutlineIcon size={14} />
                  <span>PROOFING IN PROGRESS</span>
                </span>
              )}
              {albumInfo.photographerName && (
                <span className={styles.idText}>• by {albumInfo.photographerName}</span>
              )}
            </div>
            <div className={styles.albumTitleGroup}>
              <div className={styles.titleLineHeader}>
                <div>
                  <div className={styles.titleLine}>
                    <span className={styles.titleLabel}>Album:</span> {displayName || 'Untitled Album'}
                  </div>
                  <div className={styles.titleLine}>
                    <span className={styles.titleLabel}>Client:</span> {displayClientName || 'None'}
                  </div>
                </div>
                {albumInfo.id && (
                  <div style={{ position: 'relative', display: 'inline-flex', marginLeft: 12 }}>
                    <AlbumActionMenu
                      onEdit={() => {
                        setIsDeletingAlbum(false)
                        setIsEditingInfo(true)
                      }}
                      onCopyLink={handleCopyShareLink}
                      copied={copied}
                      onDelete={() => {
                        setIsEditingInfo(false)
                        setIsDeletingAlbum(true)
                      }}
                      direction="down"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.bannerMeta}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CalendarOutlineIcon size={15} />
                <span>{albumInfo.date || 'Recent'}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FolderOutlineIcon size={15} />
                <span>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
              </div>
            </div>
          </div>
          {albumInfo.shareToken && (
            <div className={styles.bannerRight}>
              <div className={styles.topActionBar}>
                {/* 1. Quick Upload Icon Button */}
                <label className={styles.topActionBtn} title="Quick upload delivery photos" style={{ cursor: uploadingPhotos ? 'not-allowed' : 'pointer' }}>
                  <UploadTrayIcon size={16} />
                  <span>{uploadingPhotos ? 'Uploading...' : 'Upload'}</span>
                  <input
                    aria-label="Quick upload photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleQuickUpload}
                    style={{ display: 'none' }}
                    disabled={uploadingPhotos}
                  />
                </label>

                {/* 2. Toggle Downloads Pill Switch */}
                <button
                  type="button"
                  onClick={handleToggleDownloads}
                  disabled={togglingDownloads}
                  className={`${styles.topToggleBtn} ${downloadsOn ? styles.topToggleBtnActive : ''}`}
                  title={downloadsOn ? 'Client downloads: ON' : 'Client downloads: OFF'}
                  aria-label="Toggle client photo downloads"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>Downloads: {downloadsOn ? 'ON' : 'OFF'}</span>
                  <div className={styles.switchTrack}>
                    <div className={styles.switchThumb} />
                  </div>
                </button>

                {/* 3. Album Password Icon Button */}
                <button
                  type="button"
                  onClick={() => { setPasswordError(null); setPasswordInput(''); setShowPasswordModal(true); }}
                  className={`${styles.topActionBtn} ${hasPass ? styles.topActionBtnSecured : ''}`}
                  title={hasPass ? 'Album protected by secret password' : 'Configure album password'}
                  aria-label="Configure album password"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>{hasPass ? 'Secured' : 'Pass: OFF'}</span>
                </button>

                {/* 4. Share to Client Button */}
                <button
                  type="button"
                  onClick={() => setShowQr(true)}
                  className={styles.shareMainBtn}
                  aria-label="Toggle QR code / Share album"
                >
                  <ShareNetworkIcon size={17} />
                  <span>Share</span>
                </button>

                {isLocked ? (
                  <button
                    type="button"
                    onClick={handleUnlockSelection}
                    disabled={unlocking}
                    className={styles.unlockBtn}
                  >
                    <UnlockIcon size={16} />
                    {unlocking ? 'Unlocking...' : 'Unlock Client Selection'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLockSelection}
                    disabled={locking}
                    className={styles.lockBtn}
                  >
                    <LockIcon size={16} />
                    {locking ? 'Locking...' : 'Lock Client Selection'}
                  </button>
                )}

                <div className={styles.lightroomActionsGroup}>
                  {albumId && (
                    <a
                      href={`/api/albums/${albumId}/download-all`}
                      className={styles.toolbarActionBtn}
                      style={{ textDecoration: 'none' }}
                      title="Download all photos as ZIP"
                    >
                      <ZipBoxIcon size={16} />
                      Download All Photos
                    </a>
                  )}
                  {clientLikedPhotosCount > 0 && albumId && (
                    <button
                      type="button"
                      onClick={async () => {
                        const selectedIds = photos.filter((p) => p.clientLikers.length > 0).map((p) => p.id)
                        const res = await fetch(`/api/albums/${albumId}/download-selected`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ shareToken: albumInfo.shareToken, photoIds: selectedIds }),
                        })
                        if (res.ok) {
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${(albumInfo.name || 'album').replace(/[^a-zA-Z0-9-_]/g, '_')}-selected.zip`
                          a.click()
                          URL.revokeObjectURL(url)
                        }
                      }}
                      className={styles.downloadSelectedZipBtn || styles.toolbarActionBtn}
                    >
                      <ZipBoxIcon size={16} />
                      Download Selected ({clientLikedPhotosCount}) ZIP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyFilenames}
                    className={styles.toolbarActionBtn}
                    title="Copy comma-separated filenames for Lightroom filter"
                  >
                    <ClipboardListIcon size={16} />
                    Copy Selected Filenames
                  </button>
                  <button
                    type="button"
                    onClick={handleExportTxt}
                    className={styles.toolbarActionBtn}
                    title="Download .txt list of filenames for editing"
                  >
                    <TxtFileIcon size={16} />
                    Export Lightroom List (.TXT)
                  </button>
                  {copyFeedback && <span className={styles.copyFeedbackBadge}>{copyFeedback}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Album Popup Modal */}
      {typeof document !== 'undefined' && isEditingInfo && createPortal(
        <div
          className={styles.shareModalOverlay}
          onClick={() => {
            setIsEditingInfo(false)
            setInfoError(null)
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Edit details modal"
        >
          <div className={styles.shareModalCard} style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <div>
                <h2 className={styles.shareModalTitle}>Edit Album</h2>
                <p className={styles.shareModalSubtitle}>Update album title, client name, and cover photo.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingInfo(false)
                  setInfoError(null)
                  setEditName(displayName)
                  setEditClientName(displayClientName)
                  setEditCoverPhotoId(albumInfo?.coverPhotoId ?? null)
                }}
                className={styles.shareModalCloseBtn}
                aria-label="Close edit modal"
              >
                <CloseOutlineIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveInfo} style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#a0a0ab' }}>Album:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className={styles.editInput}
                  placeholder="Album title"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#a0a0ab' }}>Client:</label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className={styles.editInput}
                  placeholder="Client name"
                />
              </div>
              {infoError && <div role="alert" className={styles.editError}>{infoError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={savingInfo} className={styles.saveInfoBtn} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: '#ff5c5c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {savingInfo ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingInfo(false)
                    setInfoError(null)
                    setEditName(displayName)
                    setEditClientName(displayClientName)
                    setEditCoverPhotoId(albumInfo?.coverPhotoId ?? null)
                  }}
                  disabled={savingInfo}
                  className={styles.cancelInfoBtn}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #3e3e4a', background: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Share to client Popup Modal with blurred background overlay */}
      {showQr && albumInfo?.shareToken && (
        <div
          className={styles.shareModalOverlay}
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Share to client Modal"
        >
          <div className={styles.shareModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <div>
                <h2 className={styles.shareModalTitle}>Share to client</h2>
                <p className={styles.shareModalSubtitle}>Scan the QR code or copy the full access link below to share with your client.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQr(false)}
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
                onClick={handleCopyShareLink}
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

            {/* Album Customization Options inside Share Modal */}
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
            </div>
          </div>
        </div>
      )}

      {/* Password Configuration Popup Modal */}
      {showPasswordModal && (
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
                <LockOutlineIcon size={20} />
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
              <label htmlFor="modal-album-pass" className={styles.passwordLabel}>Secret Password</label>
              <input
                id="modal-album-pass"
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
        </div>
      )}

      {/* Delete Album Confirmation Modal */}
      {isDeletingAlbum && (
        <div
          className={styles.passwordModalOverlay}
          onClick={() => setIsDeletingAlbum(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Delete Album Confirmation Modal"
        >
          <div className={styles.passwordModalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className={styles.shareModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DeleteOutlineIcon size={20} style={{ color: '#ff5c5c' }} />
                <div>
                  <h2 className={styles.shareModalTitle} style={{ color: '#ff5c5c' }}>Delete Album</h2>
                  <p className={styles.shareModalSubtitle}>
                    Are you sure you want to permanently delete <strong>&quot;{albumInfo?.name}&quot;</strong>? All photos, likes, and comments will be removed immediately.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeletingAlbum(false)}
                className={styles.shareModalCloseBtn}
                aria-label="Close delete modal"
              >
                <CloseOutlineIcon size={16} />
              </button>
            </div>

            {deleteAlbumError && <div className={styles.editError} style={{ marginTop: 10 }}>{deleteAlbumError}</div>}
            <div className={styles.passwordActions}>
              <button
                type="button"
                onClick={() => setIsDeletingAlbum(false)}
                disabled={deletingAlbum}
                className={styles.btnRemovePass}
              >
                Cancel
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={handleDeleteAlbum}
                disabled={deletingAlbum}
                className={styles.btnSavePass}
                style={{ backgroundColor: '#ff5c5c', color: '#fff' }}
              >
                {deletingAlbum ? 'Deleting...' : 'Yes, Delete Album'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Toolbar Controls matching AI Studio layout */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>
            <SearchOutlineIcon size={16} />
          </span>
          <input
            type="text"
            placeholder="Search photos by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          >
            All Photos ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('suggested')}
            className={`${styles.filterBtn} ${filter === 'suggested' ? styles.filterBtnActive : ''}`}
          >
            Recommended ({photos.filter((p) => p.suggestedByMe).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('selected')}
            className={`${styles.filterBtn} ${filter === 'selected' ? styles.filterBtnActive : ''}`}
          >
            Selected by Client ({photos.filter((p) => p.clientLikers.length > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('comments')}
            className={`${styles.filterBtn} ${filter === 'comments' ? styles.filterBtnActive : ''}`}
          >
            With Comments ({photos.filter((p) => p.comments.length > 0).length})
          </button>
        </div>

        <div className={styles.sortBox}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.sortSelect}
          >
            <option value="default">Default Order</option>
            <option value="version">Sort by Version Bump</option>
            <option value="comments-count">Sort by Comments</option>
          </select>
        </div>
      </div>

      {/* Photo Grid or Empty State */}
      {processedPhotos.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ color: 'var(--text-muted, #a1a1aa)' }}>
            <FolderOutlineIcon size={40} />
          </div>
          <h3 className={styles.emptyTitle}>No Matching Photos Found</h3>
          <p className={styles.emptyText}>
            Adjust your search queries or category filters to list the matching client delivery photo cards.
          </p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {processedPhotos.map((photo) => {
            const actualIndex = photos.findIndex((p) => p.id === photo.id)
            return (
              <li key={photo.id}>
                <PhotographerPhotoTile photo={photo} onOpen={() => setOpenIndex(actualIndex)} />
              </li>
            )
          })}
          <li className={styles.flexSpacer} aria-hidden="true" />
        </ul>
      )}

      {openIndex !== null && photos[openIndex] && (
        <PhotographerPhotoLightbox
          photo={photos[openIndex]}
          hasPrevious={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          onPrevious={() => setOpenIndex(openIndex - 1)}
          onNext={() => setOpenIndex(openIndex + 1)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}

function PhotographerPhotoTile({
  photo,
  onOpen,
}: {
  photo: PhotographerGalleryPhoto
  onOpen: () => void
}) {
  const { submitting, error: likeError, toggle } = useLikeToggle(photo.id)
  const { inputRef, error: replaceError, triggerFileSelect, handleFileChange } = useReplacePhoto(
    photo.id
  )
  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        name={photo.name}
        version={photo.version}
        statusNote={statusNoteFor(photo)}
        liked={photo.suggestedByMe}
        likeIcon="star"
        likeLabel={photo.suggestedByMe ? 'Unsuggest to client' : 'Suggest to client'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={true}
        downloadHref={`/api/photos/${photo.id}/download`}
        commentCount={photo.comments.length}
        showReplace={true}
        onReplace={triggerFileSelect}
        onOpen={onOpen}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace photo file"
      />
      {likeError && <p role="alert">{likeError}</p>}
      {replaceError && <p role="alert">{replaceError}</p>}
    </>
  )
}

function PhotographerPhotoLightbox({
  photo,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: {
  photo: PhotographerGalleryPhoto
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { submitting, error: likeError, toggle } = useLikeToggle(photo.id)
  const { inputRef, error: replaceError, triggerFileSelect, handleFileChange } = useReplacePhoto(
    photo.id
  )
  return (
    <>
      <PhotoLightbox
        photoId={photo.id}
        previewUrl={photo.previewUrl}
        name={photo.name}
        statusNote={statusNoteFor(photo)}
        liked={photo.suggestedByMe}
        likeIcon="star"
        likeLabel={photo.suggestedByMe ? 'Unsuggest to client' : 'Suggest to client'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={true}
        downloadHref={`/api/photos/${photo.id}/download`}
        comments={photo.comments}
        showReplace={true}
        onReplace={triggerFileSelect}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace photo file"
      />
      {likeError && <p role="alert">{likeError}</p>}
      {replaceError && <p role="alert">{replaceError}</p>}
    </>
  )
}
