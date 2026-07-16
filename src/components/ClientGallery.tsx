'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import type { ThreadComment } from './CommentThread'
import {
  CalendarOutlineIcon,
  FolderOutlineIcon,
  LockOutlineIcon,
  SearchOutlineIcon,
  BoltOutlineIcon,
  StarIcon,
  ZoomInIcon,
  ZoomOutIcon,
  InfoOutlineIcon,
  ZipBoxIcon,
  LockIcon,
} from './PhotoIcons'
import styles from './ClientGallery.module.css'

export interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  name?: string
  version?: number
  likedByMe?: boolean
  liked?: boolean
  suggestedByPhotographer?: boolean
  comments?: ThreadComment[]
}

export interface ClientGalleryAlbumInfo {
  title?: string
  actorName?: string
  clientActorName?: string
  photographerName?: string
  location?: string
  date?: string
  phone?: string
  facebookUrl?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  qrCodeUrl?: string
}

export interface ClientGalleryProps {
  albumId?: string
  shareToken?: string
  initialPhotos?: GalleryPhoto[]
  photos?: GalleryPhoto[]
  canDownload?: boolean
  albumInfo?: ClientGalleryAlbumInfo
  selectionLocked?: boolean
  selectionLimit?: number
}

export function ClientGallery(props: ClientGalleryProps) {
  const rawPhotos = props.photos ?? props.initialPhotos ?? []
  const canDownload = props.canDownload ?? false
  const { albumId, shareToken, albumInfo } = props

  const photos = rawPhotos.map((p) => ({
    ...p,
    version: p.version ?? 1,
    likedByMe: Boolean((p.liked !== undefined ? p.liked : p.likedByMe) ?? false),
    suggestedByPhotographer: p.suggestedByPhotographer ?? false,
    comments: p.comments ?? [],
  }))

  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [gridZoom, setGridZoom] = useState(3)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'recommended' | 'liked' | 'comments'>('all')

  const [showContactModal, setShowContactModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const hasContactInfo = Boolean(albumInfo?.phone || albumInfo?.facebookUrl)
  const hasPaymentInfo = Boolean(albumInfo?.bankName || albumInfo?.bankAccountNumber || albumInfo?.qrCodeUrl)

  const [isSelectionLocked, setIsSelectionLocked] = useState(Boolean(props.selectionLocked))
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submittingLock, setSubmittingLock] = useState(false)

  let processedPhotos = [...photos]

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    processedPhotos = processedPhotos.filter(
      (p) => p.id.toLowerCase().includes(query) || p.thumbnailUrl.toLowerCase().includes(query)
    )
  }

  if (filter === 'recommended') {
    processedPhotos = processedPhotos.filter((p) => p.suggestedByPhotographer)
  } else if (filter === 'liked') {
    processedPhotos = processedPhotos.filter((p) => p.likedByMe)
  } else if (filter === 'comments') {
    processedPhotos = processedPhotos.filter((p) => p.comments && p.comments.length > 0)
  }

  const selectedCount = photos.filter((p) => p.likedByMe).length
  const selectionLimit = props.selectionLimit ?? 0
  const [limitWarning, setLimitWarning] = useState<string | null>(null)

  function handleSelectAttempt(isAlreadyLiked: boolean, doToggle: () => void) {
    if (isSelectionLocked) return
    if (!isAlreadyLiked && selectionLimit > 0 && selectedCount >= selectionLimit) {
      setLimitWarning(`You have reached the maximum selection limit of ${selectionLimit} photos for this album. Please unselect another photo before choosing this one.`)
      return
    }
    setLimitWarning(null)
    doToggle()
  }

  async function handleConfirmSubmit() {
    if (!albumId) return
    setSubmittingLock(true)
    try {
      const res = await fetch(`/api/albums/${albumId}/lock-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken }),
      })
      if (res.ok) {
        setIsSelectionLocked(true)
        setShowSubmitConfirm(false)
      }
    } finally {
      setSubmittingLock(false)
    }
  }

  return (
    <div className={styles.container}>
      {limitWarning && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }} role="alert">
          <span>⚠️ {limitWarning}</span>
          <button type="button" onClick={() => setLimitWarning(null)} style={{ color: '#fca5a5', fontWeight: 700, fontSize: '1.2rem', padding: '0 8px', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {/* Client Shared Album Banner */}
      <div className={styles.banner} style={{ overflow: 'visible' }}>
        <div className={styles.bannerLeft}>
          <span className={styles.sharedAccessBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <LockOutlineIcon size={14} /> Shared Gallery Access {albumInfo?.clientActorName ? `• ${albumInfo.clientActorName}` : ''}
          </span>
          <h1 className={styles.albumTitle}>{albumInfo?.title || 'Shared Album Gallery'}</h1>
          <p className={styles.deliveredBy}>
            Delivered by <span className={styles.brandHighlight}>BK Media Box</span> • Professional Client Portal
          </p>
          <div className={styles.bannerMeta}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <CalendarOutlineIcon size={15} />
              <span>{albumInfo?.date || 'Recent'}</span>
            </div>
            {hasContactInfo && (
              <button type="button" className={styles.bannerMetaBtn} onClick={() => setShowContactModal(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Liên hệ
              </button>
            )}
            {hasPaymentInfo && (
              <button type="button" className={styles.bannerMetaBtn} onClick={() => setShowPaymentModal(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Thanh toán
              </button>
            )}
          </div>
        </div>

        <div className={styles.bannerRight}>
          {canDownload && albumId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const selectedIds = photos.filter((p) => p.likedByMe || p.liked).map((p) => p.id)
                    const res = await fetch(`/api/albums/${albumId}/download-selected`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ shareToken, photoIds: selectedIds }),
                    })
                    if (res.ok) {
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'selected-photos.zip'
                      a.click()
                      URL.revokeObjectURL(url)
                    }
                  }}
                  className={styles.downloadSelectedZipBtn}
                >
                  <ZipBoxIcon size={16} />
                  Download Selected ({selectedCount}) ZIP
                </button>
              )}
              <a href={`/api/albums/${albumId}/download-all`} className={styles.downloadAllBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <BoltOutlineIcon size={16} /> Download all ({selectedCount > 0 ? `${selectedCount} selected` : 'ZIP'})
              </a>
            </div>
          ) : !canDownload ? (
            <div className={styles.disabledNotice}>
              <div className={styles.disabledTitle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LockOutlineIcon size={16} /> Original Downloads Disabled
              </div>
              <div>The photographer has restricted access to compressed previews only.</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid Toolbar Controls matching AI Studio layout */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>
            <SearchOutlineIcon size={16} />
          </span>
          <input
            type="text"
            placeholder="Search shared photos..."
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
            All Shared ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('recommended')}
            className={`${styles.filterBtn} ${filter === 'recommended' ? styles.filterBtnActive : ''}`}
          >
            Studio Choice ({photos.filter((p) => p.suggestedByPhotographer).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('liked')}
            className={`${styles.filterBtn} ${filter === 'liked' ? styles.filterBtnActive : ''}`}
          >
            My Selections ({selectionLimit > 0 ? `${selectedCount} / ${selectionLimit}` : selectedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('comments')}
            className={`${styles.filterBtn} ${filter === 'comments' ? styles.filterBtnActive : ''}`}
          >
            With Feedback ({photos.filter((p) => p.comments && p.comments.length > 0).length})
          </button>
        </div>

        <div className={styles.zoomControl}>
          <span title="Zoom out" className={styles.zoomIcon}><ZoomOutIcon size={16} /></span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={gridZoom}
            onChange={(e) => setGridZoom(Number(e.target.value))}
            aria-label="Grid zoom level"
            className={styles.zoomSlider}
          />
          <span title="Zoom in" className={styles.zoomIcon}><ZoomInIcon size={16} /></span>
        </div>
      </div>

      {/* Grid List or Empty State */}
      {processedPhotos.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ color: 'var(--text-muted, #a1a1aa)' }}>
            <FolderOutlineIcon size={40} />
          </div>
          <div style={{ fontWeight: 600 }}>No Matching Photos Found</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Adjust your search queries or category filters to view delivered photos.
          </div>
        </div>
      ) : (
        <ul className={`${styles.grid} ${styles[`gridZoom${gridZoom}`] || ''}`}>
          {processedPhotos.map((photo) => {
            const actualIndex = photos.findIndex((p) => p.id === photo.id)
            return (
              <li key={photo.id}>
                <ClientPhotoTile
                  photo={photo}
                  canDownload={canDownload}
                  photographerName={albumInfo?.photographerName}
                  onOpen={() => setOpenIndex(actualIndex)}
                  toggling={isSelectionLocked}
                  selectionLocked={isSelectionLocked}
                  onSelectAttempt={handleSelectAttempt}
                />
              </li>
            )
          })}
          <li className={styles.flexSpacer} aria-hidden="true" />
        </ul>
      )}

      {openIndex !== null && photos[openIndex] && (
        <ClientPhotoLightbox
          photo={photos[openIndex]}
          canDownload={canDownload}
          hasPrevious={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          onPrevious={() => setOpenIndex(openIndex - 1)}
          onNext={() => setOpenIndex(openIndex + 1)}
          onClose={() => setOpenIndex(null)}
          toggling={isSelectionLocked}
          selectionLocked={isSelectionLocked}
          onSelectAttempt={handleSelectAttempt}
        />
      )}

      {/* Floating Selection Bar */}
      {(selectedCount > 0 || isSelectionLocked) && (
        <div className={styles.floatingBar}>
          {isSelectionLocked ? (
            <div className={styles.floatingBarLocked} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <LockIcon size={16} />
              <span>Selection Submitted — Thank you! Your photographer is reviewing your selected photos.</span>
            </div>
          ) : (
            <div className={styles.floatingBarActive}>
              <span className={styles.floatingBarText}>Selected: {selectionLimit > 0 ? `${selectedCount} / ${selectionLimit}` : selectedCount} photo(s)</span>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className={styles.submitSelectionBtn}
              >
                Submit Final Selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm Submit Modal */}
      {showSubmitConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowSubmitConfirm(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Confirm Final Selection</h3>
            <p className={styles.modalText}>
              Are you sure you want to submit your selection of {selectedCount} photo(s)? Once submitted, you won&apos;t be able to add or remove selections unless the photographer unlocks the album.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submittingLock}
                className={styles.modalConfirmBtn}
              >
                {submittingLock ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className={styles.modalOverlay} onClick={() => setShowContactModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Liên hệ Photographer</h3>
            <div className={styles.contactList}>
              {albumInfo?.phone && (
                <a href={`tel:${albumInfo.phone}`} className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </span>
                  <div className={styles.contactDetail}>
                    <span className={styles.contactLabel}>Số điện thoại</span>
                    <span className={styles.contactValue}>{albumInfo.phone}</span>
                  </div>
                </a>
              )}
              {albumInfo?.facebookUrl && (
                <a href={albumInfo.facebookUrl} target="_blank" rel="noopener noreferrer" className={styles.contactItem}>
                  <span className={styles.contactIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </span>
                  <div className={styles.contactDetail}>
                    <span className={styles.contactLabel}>Facebook</span>
                    <span className={styles.contactValue}>Mở trang Facebook</span>
                  </div>
                </a>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setShowContactModal(false)} className={styles.modalCancelBtn}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Thông tin thanh toán</h3>
            <div className={styles.paymentDetails}>
              {albumInfo?.bankName && (
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Ngân hàng</span>
                  <span className={styles.paymentValue}>{albumInfo.bankName}</span>
                </div>
              )}
              {albumInfo?.bankAccountNumber && (
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Số tài khoản</span>
                  <span className={styles.paymentValue}>{albumInfo.bankAccountNumber}</span>
                </div>
              )}
              {albumInfo?.bankAccountName && (
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Chủ tài khoản</span>
                  <span className={styles.paymentValue}>{albumInfo.bankAccountName}</span>
                </div>
              )}
              {albumInfo?.qrCodeUrl && (
                <div className={styles.qrCodeContainer}>
                  <img src={albumInfo.qrCodeUrl} alt="QR Code thanh toán" className={styles.qrCodeImage} />
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setShowPaymentModal(false)} className={styles.modalCancelBtn}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientPhotoTile({
  photo,
  canDownload,
  photographerName,
  onOpen,
  toggling,
  selectionLocked,
  onSelectAttempt,
}: {
  photo: GalleryPhoto
  canDownload: boolean
  photographerName?: string
  onOpen: () => void
  toggling?: boolean
  selectionLocked?: boolean
  onSelectAttempt?: (isAlreadyLiked: boolean, doToggle: () => void) => void
}) {
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  const isToggling = Boolean(submitting || toggling)
  const likeLabel = selectionLocked
    ? 'Select photo'
    : photo.likedByMe
      ? 'Unselect this photo'
      : 'Select this photo'

  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        name={photo.name}
        photographerName={photographerName}
        version={photo.version ?? 1}
        statusNote={photo.suggestedByPhotographer ? 'Suggested by photographer' : undefined}
        liked={Boolean(photo.likedByMe)}
        likeIcon="heart"
        likeLabel={likeLabel}
        onToggleLike={selectionLocked ? () => {} : () => {
          if (onSelectAttempt) {
            onSelectAttempt(Boolean(photo.likedByMe), toggle)
          } else {
            toggle()
          }
        }}
        toggling={isToggling}
        showDownload={canDownload}
        downloadHref={`/api/photos/${photo.id}/download`}
        commentCount={photo.comments?.length ?? 0}
        showReplace={false}
        onReplace={() => {}}
        onOpen={onOpen}
      />
      {error && <p role="alert">{error}</p>}
    </>
  )
}

function ClientPhotoLightbox({
  photo,
  canDownload,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
  toggling,
  selectionLocked,
  onSelectAttempt,
}: {
  photo: GalleryPhoto
  canDownload: boolean
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
  toggling?: boolean
  selectionLocked?: boolean
  onSelectAttempt?: (isAlreadyLiked: boolean, doToggle: () => void) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  const isToggling = Boolean(submitting || toggling)
  const likeLabel = selectionLocked
    ? 'Select photo'
    : photo.likedByMe
      ? 'Unselect this photo'
      : 'Select this photo'

  return (
    <>
      <PhotoLightbox
        photoId={photo.id}
        previewUrl={photo.previewUrl}
        name={photo.name}
        statusNote={photo.suggestedByPhotographer ? 'Suggested by photographer' : undefined}
        liked={Boolean(photo.likedByMe)}
        likeIcon="heart"
        likeLabel={likeLabel}
        onToggleLike={selectionLocked ? () => {} : () => {
          if (onSelectAttempt) {
            onSelectAttempt(Boolean(photo.likedByMe), toggle)
          } else {
            toggle()
          }
        }}
        toggling={isToggling}
        showDownload={canDownload}
        downloadHref={`/api/photos/${photo.id}/download`}
        comments={photo.comments ?? []}
        showReplace={false}
        onReplace={() => {}}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
        showInfo={showInfo}
        onToggleInfo={() => setShowInfo(!showInfo)}
        photoInfoDetails={{
          filename: photo.name || photo.id,
        }}
      />
      {error && <p role="alert">{error}</p>}
    </>
  )
}
