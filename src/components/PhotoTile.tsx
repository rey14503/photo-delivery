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
  return (
    <div className={styles.tile}>
      <button type="button" aria-label="Open photo" onClick={onOpen}>
        <img src={thumbnailUrl} alt="Photo thumbnail" width={200} />
      </button>
      <div>
        {version > 1 && <span>v{version}</span>}
        {statusNote && <p>{statusNote}</p>}
      </div>
      <div className={styles.quickActions}>
        <button
          type="button"
          aria-label={likeLabel}
          aria-pressed={liked}
          disabled={toggling}
          onClick={onToggleLike}
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
  )
}
