'use client'

import { useState } from 'react'
import { CommentThread, type ThreadComment } from './CommentThread'
import { PhotoActionMenu } from './PhotoActionMenu'
import { LikeIcon, DownloadIcon, CommentIcon, InfoOutlineIcon } from './PhotoIcons'
import { stripExtension } from '@/lib/photo-name'
import styles from './PhotoLightbox.module.css'

export interface PhotoLightboxProps {
  photoId: string
  previewUrl: string
  name?: string
  statusNote?: string
  liked: boolean
  likeIcon: 'heart' | 'star'
  likeLabel: string
  onToggleLike: () => void
  toggling: boolean
  showDownload: boolean
  downloadHref: string
  comments: ThreadComment[]
  showReplace: boolean
  onReplace: () => void
  onSetCover?: () => void
  isCover?: boolean
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
  showInfo?: boolean
  onToggleInfo?: () => void
  photoInfoDetails?: {
    filename?: string
    resolution?: string
    fileSize?: string
    uploadedDate?: string
  }
}

export function PhotoLightbox({
  photoId,
  previewUrl,
  name,
  statusNote,
  liked,
  likeIcon,
  likeLabel,
  onToggleLike,
  toggling,
  showDownload,
  downloadHref,
  comments,
  showReplace,
  onReplace,
  onSetCover,
  isCover = false,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
  showInfo,
  onToggleInfo,
  photoInfoDetails,
}: PhotoLightboxProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [internalInfoOpen, setInternalInfoOpen] = useState(false)
  const displayName = stripExtension(name)
  const isInfoOpen = showInfo !== undefined ? showInfo : internalInfoOpen
  const handleToggleInfo = onToggleInfo ? onToggleInfo : () => setInternalInfoOpen((prev) => !prev)

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-label={`Photo preview: ${displayName}`} className={styles.lightbox}>
        <div className={styles.stage}>
          <div className={styles.topBarControls}>
            <button
              type="button"
              onClick={handleToggleInfo}
              className={styles.infoButton}
              aria-label="Toggle photo info"
              title="Toggle photo info"
            >
              <InfoOutlineIcon size={20} />
            </button>
            <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          {hasPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className={`${styles.navButton} ${styles.previousButton}`}
              aria-label="Previous"
              title="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={onNext}
              className={`${styles.navButton} ${styles.nextButton}`}
              aria-label="Next"
              title="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          )}
          {statusNote && <p className={styles.statusNote}>{statusNote}</p>}

          <div className={styles.imageContainer}>
            <img src={previewUrl} alt={displayName} className={styles.image} />
          </div>

          <div className={styles.actionBar}>
            <button
              type="button"
              aria-label={likeLabel}
              aria-pressed={liked}
              disabled={toggling}
              onClick={onToggleLike}
              className={styles.iconButton}
            >
              <LikeIcon liked={liked} icon={likeIcon} size={20} />
            </button>
            {showDownload && (
              <a
                href={downloadHref}
                className={styles.downloadLink}
                aria-label="Download"
                title="Download"
              >
                <DownloadIcon size={20} />
              </a>
            )}
            <button
              type="button"
              aria-pressed={commentsOpen}
              aria-label={`Comments (${comments.length})`}
              title={`Comments (${comments.length})`}
              onClick={() => setCommentsOpen((prev) => !prev)}
              className={styles.iconButton}
            >
              <CommentIcon filled={commentsOpen || comments.length > 0} size={20} />
            </button>
            <PhotoActionMenu
              likeLabel={likeLabel}
              onToggleLike={onToggleLike}
              toggling={toggling}
              showDownload={showDownload}
              downloadHref={downloadHref}
              commentCount={comments.length}
              onViewComments={() => setCommentsOpen(true)}
              showReplace={showReplace}
              onReplace={onReplace}
              onSetCover={onSetCover}
              isCover={isCover}
              direction="up"
            />
          </div>
        </div>

        {commentsOpen && (
          <aside aria-label="Comments" className={styles.commentsPanel}>
            <CommentThread photoId={photoId} comments={comments} />
          </aside>
        )}

        {isInfoOpen && (
          <aside aria-label="EXIF & Metadata" data-testid="photo-info-panel" className={styles.infoPanel}>
            <div className={styles.infoPanelHeader}>
              <h4>EXIF &amp; Metadata</h4>
              <button type="button" onClick={() => handleToggleInfo()} aria-label="Close info">✕</button>
            </div>
            <div className={styles.infoPanelContent}>
              <div className={styles.infoRow}>
                <span>Filename:</span>
                <strong>{photoInfoDetails?.filename || name || photoId || 'Untitled photo'}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>Resolution:</span>
                <strong>{photoInfoDetails?.resolution || '3840 x 2160'}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>File Size:</span>
                <strong>{photoInfoDetails?.fileSize || '4.2 MB'}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>Uploaded Date:</span>
                <strong>{photoInfoDetails?.uploadedDate || '2026-07-10'}</strong>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
