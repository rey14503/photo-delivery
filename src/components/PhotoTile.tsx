'use client'

import { useState, useEffect } from 'react'
import { PhotoActionMenu } from './PhotoActionMenu'
import { LikeIcon, CommentIcon } from './PhotoIcons'
import { stripExtension } from '@/lib/photo-name'
import styles from './PhotoTile.module.css'

export interface PhotoTileProps {
  thumbnailUrl: string
  name?: string
  photographerName?: string
  version: number
  statusNote?: string
  liked: boolean
  likeIcon: 'heart' | 'star'
  likeLabel: string
  onToggleLike: () => void
  toggling: boolean
  showDownload: boolean
  downloadHref: string
  commentCount: number
  showReplace: boolean
  onReplace: () => void
  onSetCover?: () => void
  isCover?: boolean
  onOpen: () => void
}

export function PhotoTile({
  thumbnailUrl,
  name,
  photographerName,
  version,
  statusNote,
  liked,
  likeIcon,
  likeLabel,
  onToggleLike,
  toggling,
  showDownload,
  downloadHref,
  commentCount,
  showReplace,
  onReplace,
  onSetCover,
  isCover = false,
  onOpen,
}: PhotoTileProps) {
  const [imgSrc, setImgSrc] = useState(thumbnailUrl)
  const [retryCount, setRetryCount] = useState(0)
  const [imgError, setImgError] = useState(false)
  const displayName = stripExtension(name)

  // Keep state in sync if parent changes prop
  useEffect(() => {
    if ((thumbnailUrl || null) !== (imgSrc || null) && retryCount === 0 && !imgError) {
      setImgSrc(thumbnailUrl)
    }
  }, [thumbnailUrl, imgSrc, retryCount, imgError])

  const handleImgError = () => {
    if (!imgSrc) return setImgError(true)
    if (retryCount < 2) {
      setRetryCount((prev) => prev + 1)
      const sep = imgSrc.includes('?') ? '&' : '?'
      setImgSrc(`${imgSrc.replace(/&retry=\d+/, '')}${sep}retry=${Date.now()}`)
    } else {
      setImgError(true)
    }
  }

  return (
    <div className={styles.tile}>
      <div className={styles.imageContainer}>
        <button
          type="button"
          aria-label={`Open photo: ${displayName}`}
          title={displayName}
          onClick={onOpen}
          className={styles.openButton}
        >
          {!imgError ? (
            <img
              src={imgSrc || thumbnailUrl}
              alt=""
              className={styles.image}
              onError={handleImgError}
            />

          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#2e2e33',
                color: '#888',
                fontSize: '0.85rem',
              }}
            >
              Photo
            </div>
          )}
        </button>

        <div className={styles.overlay}>
          <div className={styles.topRow}>
            <div className={styles.checkBadgeBox}>
              <button
                type="button"
                aria-label={likeLabel}
                aria-pressed={liked}
                disabled={toggling}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLike()
                }}
                className={`${styles.checkCircleBtn} ${liked ? styles.checkCircleActive : ''}`}
                title={likeLabel}
              >
                <LikeIcon liked={liked} icon={likeIcon} size={16} />
              </button>
            </div>
            <div className={styles.quickActions}>
              <PhotoActionMenu
                likeLabel={likeLabel}
                onToggleLike={onToggleLike}
                toggling={toggling}
                showDownload={showDownload}
                downloadHref={downloadHref}
                commentCount={commentCount}
                onViewComments={onOpen}
                showReplace={showReplace}
                onReplace={onReplace}
                onSetCover={onSetCover}
                isCover={isCover}
              />
            </div>
          </div>

          <div className={styles.bottomRowOverlay}>
            {commentCount > 0 && (
              <div className={styles.commentCountBadge}>
                <CommentIcon filled={true} size={13} />
                <span>{commentCount}</span>
              </div>
            )}
          </div>
        </div>

        {version > 1 && (
          <div className={styles.versionBadge}>
            <span>v{version}</span>
          </div>
        )}

        {statusNote && (
          <div className={styles.statusNoteBadge} title={statusNote}>
            <span>{statusNote}</span>
          </div>
        )}
      </div>

      <div className={styles.metaInfo}>
        <h4 className={styles.photoTitle} title={displayName}>
          {displayName}
        </h4>
        {photographerName && (
          <div className={styles.metaBottom}>
            <span>by {photographerName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
