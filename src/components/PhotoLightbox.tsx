'use client'

import { useState } from 'react'
import { CommentThread, type ThreadComment } from './CommentThread'
import { PhotoActionMenu } from './PhotoActionMenu'

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
    <div role="dialog" aria-label="Photo preview">
      <button type="button" onClick={onClose}>
        Close
      </button>
      {hasPrevious && (
        <button type="button" onClick={onPrevious}>
          Previous
        </button>
      )}
      <img src={previewUrl} alt="Photo preview" />
      {hasNext && (
        <button type="button" onClick={onNext}>
          Next
        </button>
      )}
      {statusNote && <p>{statusNote}</p>}

      <div>
        <button
          type="button"
          aria-label={likeLabel}
          aria-pressed={liked}
          disabled={toggling}
          onClick={onToggleLike}
        >
          {likeGlyph(liked, likeIcon)}
        </button>
        {showDownload && <a href={downloadHref}>Download</a>}
        <button
          type="button"
          aria-pressed={commentsOpen}
          aria-label={`Comments (${comments.length})`}
          onClick={() => setCommentsOpen((prev) => !prev)}
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

      {commentsOpen && (
        <aside aria-label="Comments">
          <CommentThread photoId={photoId} comments={comments} />
        </aside>
      )}
    </div>
  )
}
