'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import { useReplacePhoto } from '@/lib/hooks/useReplacePhoto'
import type { ThreadComment } from './CommentThread'
import styles from './PhotographerGallery.module.css'

export interface PhotographerGalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  version: number
  suggestedByMe: boolean
  clientLikers: string[]
  comments: ThreadComment[]
}

export interface PhotographerGalleryAlbumInfo {
  id?: string
  name?: string
  clientName?: string
  shareToken?: string
  location?: string
  date?: string
}

function statusNoteFor(photo: PhotographerGalleryPhoto): string | undefined {
  return photo.clientLikers.length > 0 ? `❤ Selected by: ${photo.clientLikers.join(', ')}` : undefined
}

export function PhotographerGallery({
  photos,
  albumInfo,
}: {
  photos: PhotographerGalleryPhoto[]
  albumInfo?: PhotographerGalleryAlbumInfo
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'suggested' | 'selected' | 'comments'>('all')
  const [sortBy, setSortBy] = useState<'default' | 'version' | 'comments-count'>('default')

  // Processing photos matching exact AI Studio logic
  let processedPhotos = [...photos]

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    processedPhotos = processedPhotos.filter(
      (p) => p.id.toLowerCase().includes(query) || p.thumbnailUrl.toLowerCase().includes(query)
    )
  }

  if (filter === 'suggested') {
    processedPhotos = processedPhotos.filter((p) => p.suggestedByMe)
  } else if (filter === 'selected') {
    processedPhotos = processedPhotos.filter((p) => p.clientLikers.length > 0)
  } else if (filter === 'comments') {
    processedPhotos = processedPhotos.filter((p) => p.comments.length > 0)
  }

  if (sortBy === 'version') {
    processedPhotos.sort((a, b) => b.version - a.version)
  } else if (sortBy === 'comments-count') {
    processedPhotos.sort((a, b) => b.comments.length - a.comments.length)
  }

  return (
    <div className={styles.container}>
      {/* Album Specs Card / Banner when albumInfo is passed */}
      {albumInfo && (
        <div className={styles.banner}>
          <div className={styles.bannerLeft}>
            <div className={styles.modeBadgeRow}>
              <span className={styles.modeBadge}>Photographer Mode</span>
              {albumInfo.id && <span className={styles.idText}>• ID: {albumInfo.id}</span>}
            </div>
            <h2 className={styles.albumTitle}>
              {albumInfo.name || 'Album'} {albumInfo.clientName ? `— ${albumInfo.clientName}` : ''}
            </h2>
            {albumInfo.shareToken && (
              <div className={styles.accessRow}>
                <span>Client Access:</span>
                <span className={styles.shareTokenCode}>/a/{albumInfo.shareToken}</span>
              </div>
            )}
            <div className={styles.bannerMeta}>
              <div>📍 <span>{albumInfo.location || 'Studio'}</span></div>
              <div>📅 <span>{albumInfo.date || 'Gần đây'}</span></div>
              <div>📂 <span>{photos.length} original photos</span></div>
            </div>
          </div>
          <div className={styles.bannerRight}>
            {/* Optional right slots for download or extra controls */}
          </div>
        </div>
      )}

      {/* Grid Toolbar Controls matching AI Studio layout */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search photos by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          >
            All Photos ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('suggested')}
            className={`${styles.filterBtn} ${filter === 'suggested' ? styles.filterBtnActive : ''}`}
          >
            Recommended ({photos.filter((p) => p.suggestedByMe).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('selected')}
            className={`${styles.filterBtn} ${filter === 'selected' ? styles.filterBtnActive : ''}`}
          >
            Selected by Client ({photos.filter((p) => p.clientLikers.length > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('comments')}
            className={`${styles.filterBtn} ${filter === 'comments' ? styles.filterBtnActive : ''}`}
          >
            With Comments ({photos.filter((p) => p.comments.length > 0).length})
          </button>
        </div>

        <div className={styles.sortBox}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.sortSelect}
          >
            <option value="default">Default Order</option>
            <option value="version">Sort by Version Bump</option>
            <option value="comments-count">Sort by Comments</option>
          </select>
        </div>
      </div>

      {/* Photo Grid or Empty State */}
      {processedPhotos.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: '2rem' }}>🖼️</div>
          <h3 className={styles.emptyTitle}>No Matching Photos Found</h3>
          <p className={styles.emptyText}>
            Adjust your search queries or category filters to list the matching client delivery photo cards.
          </p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {processedPhotos.map((photo) => {
            const actualIndex = photos.findIndex((p) => p.id === photo.id)
            return (
              <li key={photo.id}>
                <PhotographerPhotoTile photo={photo} onOpen={() => setOpenIndex(actualIndex)} />
              </li>
            )
          })}
        </ul>
      )}

      {openIndex !== null && photos[openIndex] && (
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
