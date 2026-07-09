'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import { useReplacePhoto } from '@/lib/hooks/useReplacePhoto'
import type { ThreadComment } from './CommentThread'

export interface PhotographerGalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  suggestedByMe: boolean
  clientLikers: string[]
  comments: ThreadComment[]
}

function statusNoteFor(photo: PhotographerGalleryPhoto): string | undefined {
  return photo.clientLikers.length > 0 ? `❤ Selected by: ${photo.clientLikers.join(', ')}` : undefined
}

export function PhotographerGallery({ photos }: { photos: PhotographerGalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      <ul>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <PhotographerPhotoTile photo={photo} onOpen={() => setOpenIndex(index)} />
          </li>
        ))}
      </ul>
      {openIndex !== null && (
        <PhotographerPhotoLightbox
          photo={photos[openIndex]}
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

function PhotographerPhotoTile({
  photo,
  onOpen,
}: {
  photo: PhotographerGalleryPhoto
  onOpen: () => void
}) {
  const { submitting, error: likeError, toggle } = useLikeToggle(photo.id)
  const { inputRef, error: replaceError, triggerFileSelect, handleFileChange } = useReplacePhoto(
    photo.id
  )
  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        version={photo.version}
        statusNote={statusNoteFor(photo)}
        liked={photo.suggestedByMe}
        likeIcon="star"
        likeLabel={photo.suggestedByMe ? 'Unsuggest to client' : 'Suggest to client'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={true}
        downloadHref={`/api/photos/${photo.id}/download`}
        commentCount={photo.comments.length}
        showReplace={true}
        onReplace={triggerFileSelect}
        onOpen={onOpen}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace photo file"
      />
      {likeError && <p role="alert">{likeError}</p>}
      {replaceError && <p role="alert">{replaceError}</p>}
    </>
  )
}

function PhotographerPhotoLightbox({
  photo,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
}: {
  photo: PhotographerGalleryPhoto
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { submitting, error: likeError, toggle } = useLikeToggle(photo.id)
  const { inputRef, error: replaceError, triggerFileSelect, handleFileChange } = useReplacePhoto(
    photo.id
  )
  return (
    <>
      <PhotoLightbox
        photoId={photo.id}
        previewUrl={photo.previewUrl}
        statusNote={statusNoteFor(photo)}
        liked={photo.suggestedByMe}
        likeIcon="star"
        likeLabel={photo.suggestedByMe ? 'Unsuggest to client' : 'Suggest to client'}
        onToggleLike={toggle}
        toggling={submitting}
        showDownload={true}
        downloadHref={`/api/photos/${photo.id}/download`}
        comments={photo.comments}
        showReplace={true}
        onReplace={triggerFileSelect}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Replace photo file"
      />
      {likeError && <p role="alert">{likeError}</p>}
      {replaceError && <p role="alert">{replaceError}</p>}
    </>
  )
}
