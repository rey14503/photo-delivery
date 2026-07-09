'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import type { ThreadComment } from './CommentThread'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  likedByMe: boolean
  suggestedByPhotographer: boolean
  comments: ThreadComment[]
}

export function ClientGallery({
  photos,
  canDownload,
  albumId,
}: {
  photos: GalleryPhoto[]
  canDownload: boolean
  albumId?: string
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      {canDownload && albumId && (
        <a href={`/api/albums/${albumId}/download-all`}>Download all</a>
      )}
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <ClientPhotoTile photo={photo} canDownload={canDownload} onOpen={() => setOpenIndex(index)} />
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <ClientPhotoLightbox
          photo={photos[openIndex]}
          canDownload={canDownload}
          hasPrevious={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          onPrevious={() => setOpenIndex(openIndex - 1)}
          onNext={() => setOpenIndex(openIndex + 1)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}

function ClientPhotoTile({
  photo,
  canDownload,
  onOpen,
}: {
  photo: GalleryPhoto
  canDownload: boolean
  onOpen: () => void
}) {
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        version={photo.version}
        statusNote={photo.suggestedByPhotographer ? '⭐ Suggested by photographer' : undefined}
        liked={photo.likedByMe}
        likeIcon="heart"
        likeLabel={photo.likedByMe ? 'Unselect this photo' : 'Select this photo'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={canDownload}
        downloadHref={`/api/photos/${photo.id}/download`}
        commentCount={photo.comments.length}
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
}: {
  photo: GalleryPhoto
  canDownload: boolean
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  return (
    <>
      <PhotoLightbox
        photoId={photo.id}
        previewUrl={photo.previewUrl}
        statusNote={photo.suggestedByPhotographer ? '⭐ Suggested by photographer' : undefined}
        liked={photo.likedByMe}
        likeIcon="heart"
        likeLabel={photo.likedByMe ? 'Unselect this photo' : 'Select this photo'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={canDownload}
        downloadHref={`/api/photos/${photo.id}/download`}
        comments={photo.comments}
        showReplace={false}
        onReplace={() => {}}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
      />
      {error && <p role="alert">{error}</p>}
    </>
  )
}
