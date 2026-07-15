'use client'

import { useState } from 'react'
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
  const [imgError, setImgError] = useState(false)
  const displayName = stripExtension(name)

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
              src={thumbnailUrl}
              alt=""
              className={styles.image}
              onError={() => setImgError(true)}
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

        {isCover && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'rgba(255, 179, 0, 0.95)',
              color: '#000',
              fontWeight: 700,
              fontSize: '0.72rem',
              padding: '3px 8px',
              borderRadius: 6,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              zIndex: 3,
              pointerEvents: 'none',
              letterSpacing: '0.3px',
            }}
          >
            ★ COVER
          </div>
        )}

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
