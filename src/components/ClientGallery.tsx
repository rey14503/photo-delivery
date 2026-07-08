'use client'

import { useState } from 'react'
import { LikeButton } from './LikeButton'
import { CommentThread, type ThreadComment } from './CommentThread'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  likedByMe: boolean
  suggestedByPhotographer: boolean
  comments: ThreadComment[]
}

export function ClientGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button type="button" onClick={() => setOpenIndex(index)}>
              <img src={photo.thumbnailUrl} alt="Photo thumbnail" width={200} />
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <div role="dialog" aria-label="Photo preview">
          <button type="button" onClick={() => setOpenIndex(null)}>
            Close
          </button>
          {openIndex > 0 && (
            <button type="button" onClick={() => setOpenIndex(openIndex - 1)}>
              Previous
            </button>
          )}
          <img src={photos[openIndex].previewUrl} alt="Photo preview" />
          {openIndex < photos.length - 1 && (
            <button type="button" onClick={() => setOpenIndex(openIndex + 1)}>
              Next
            </button>
          )}
          <LikeButton
            photoId={photos[openIndex].id}
            liked={photos[openIndex].likedByMe}
            label="❤ Select this photo"
          />
          {photos[openIndex].suggestedByPhotographer && <p>⭐ Suggested by photographer</p>}
          <CommentThread photoId={photos[openIndex].id} comments={photos[openIndex].comments} />
        </div>
      )}
    </div>
  )
}
