'use client'

import { PhotoActionMenu } from './PhotoActionMenu'
import styles from './PhotoTile.module.css'

export interface PhotoTileProps {
  thumbnailUrl: string
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

function likeGlyph(liked: boolean, icon: 'heart' | 'star') {
  if (icon === 'heart') return liked ? '♥' : '♡'
  return liked ? '⭐' : '☆'
}

export function PhotoTile({
  thumbnailUrl,
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
  // Extract simple ID or name from URL or fallback for sleek bottom display
  const displayId = thumbnailUrl ? thumbnailUrl.split('/').pop()?.split('?')[0] || 'photo' : 'photo'

  return (
    <div className={styles.tile}>
      {/* Image Container with AI Studio aspect ratio and hover overlay */}
      <div className={styles.imageContainer}>
        <button type="button" aria-label="Open photo" onClick={onOpen} className={styles.openButton}>
          <img src={thumbnailUrl} alt="Photo thumbnail" className={styles.image} />
        </button>

        {/* Hover / Always-visible Overlay for controls matching exact AI Studio mockup */}
        <div className={styles.overlay}>
          <div className={styles.topRow}>
            <div />
            <div className={styles.quickActions}>
              <button
                type="button"
                aria-label={likeLabel}
                aria-pressed={liked}
                disabled={toggling}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLike()
                }}
                className={styles.actionBtn}
                title={likeLabel}
              >
                {likeGlyph(liked, likeIcon)}
              </button>
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
                <span>💬 {commentCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* ALWAYS VISIBLE BADGES matching AI Studio layout */}
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

      {/* Meta info underneath matching AI Studio PhotoTile layout */}
      <div className={styles.metaInfo}>
        <h4 className={styles.photoTitle}>{displayId}</h4>
        <div className={styles.metaBottom}>
          <span>ID: {displayId.slice(0, 10)}</span>
          <span style={{ textTransform: 'uppercase' }}>LANDSCAPE</span>
        </div>
      </div>
    </div>
  )
}
