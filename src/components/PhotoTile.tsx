'use client'

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
  onOpen,
}: PhotoTileProps) {
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
          <img src={thumbnailUrl} alt={displayName} className={styles.image} />
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
