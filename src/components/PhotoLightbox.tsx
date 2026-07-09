'use client'

import { useState } from 'react'
import { CommentThread, type ThreadComment } from './CommentThread'
import { PhotoActionMenu } from './PhotoActionMenu'
import styles from './PhotoLightbox.module.css'

export interface PhotoLightboxProps {
  photoId: string
  previewUrl: string
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
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}

function likeGlyph(liked: boolean, icon: 'heart' | 'star') {
  if (icon === 'heart') return liked ? '♥' : '♡'
  return liked ? '⭐' : '☆'
}

export function PhotoLightbox({
  photoId,
  previewUrl,
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
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: PhotoLightboxProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-label="Photo preview" className={styles.lightbox}>
        <div className={styles.stage}>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
            Close
          </button>
          {hasPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className={`${styles.navButton} ${styles.previousButton}`}
            >
              Previous
            </button>
          )}
          <img src={previewUrl} alt="Photo preview" className={styles.image} />
          {hasNext && (
            <button
              type="button"
              onClick={onNext}
              className={`${styles.navButton} ${styles.nextButton}`}
            >
              Next
            </button>
          )}
          {statusNote && <p className={styles.statusNote}>{statusNote}</p>}

          <div className={styles.actionBar}>
            <button
              type="button"
              aria-label={likeLabel}
              aria-pressed={liked}
              disabled={toggling}
              onClick={onToggleLike}
              className={styles.iconButton}
            >
              {likeGlyph(liked, likeIcon)}
            </button>
            {showDownload && (
              <a href={downloadHref} className={styles.downloadLink}>
                Download
              </a>
            )}
            <button
              type="button"
              aria-pressed={commentsOpen}
              aria-label={`Comments (${comments.length})`}
              onClick={() => setCommentsOpen((prev) => !prev)}
              className={styles.iconButton}
            >
              💬 Comments ({comments.length})
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
            />
          </div>
        </div>

        {commentsOpen && (
          <aside aria-label="Comments" className={styles.commentsPanel}>
            <CommentThread photoId={photoId} comments={comments} />
          </aside>
        )}
      </div>
    </div>
  )
}
