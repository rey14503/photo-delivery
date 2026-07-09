'use client'

import { useState } from 'react'
import { PhotoTile } from './PhotoTile'
import { PhotoLightbox } from './PhotoLightbox'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'
import type { ThreadComment } from './CommentThread'
import styles from './ClientGallery.module.css'

interface GalleryPhoto {
  id: string
  thumbnailUrl: string
  previewUrl: string
  name?: string
  version: number
  likedByMe: boolean
  suggestedByPhotographer: boolean
  comments: ThreadComment[]
}

export interface ClientGalleryAlbumInfo {
  title?: string
  clientActorName?: string
  photographerName?: string
  location?: string
  date?: string
}

export function ClientGallery({
  photos,
  canDownload,
  albumId,
  albumInfo,
}: {
  photos: GalleryPhoto[]
  canDownload: boolean
  albumId?: string
  albumInfo?: ClientGalleryAlbumInfo
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'recommended' | 'liked' | 'comments'>('all')

  let processedPhotos = [...photos]

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    processedPhotos = processedPhotos.filter(
      (p) => p.id.toLowerCase().includes(query) || p.thumbnailUrl.toLowerCase().includes(query)
    )
  }

  if (filter === 'recommended') {
    processedPhotos = processedPhotos.filter((p) => p.suggestedByPhotographer)
  } else if (filter === 'liked') {
    processedPhotos = processedPhotos.filter((p) => p.likedByMe)
  } else if (filter === 'comments') {
    processedPhotos = processedPhotos.filter((p) => p.comments.length > 0)
  }

  const selectedCount = photos.filter((p) => p.likedByMe).length

  return (
    <div className={styles.container}>
      {/* Client Shared Album Banner */}
      <div className={styles.banner}>
        <div className={styles.bannerLeft}>
          <span className={styles.sharedAccessBadge}>
            🛡️ Shared Gallery Access {albumInfo?.clientActorName ? `• ${albumInfo.clientActorName}` : ''}
          </span>
          <h1 className={styles.albumTitle}>{albumInfo?.title || 'Shared Album Gallery'}</h1>
          <p className={styles.deliveredBy}>
            Delivered by <span className={styles.brandHighlight}>BK Media Box</span> • Professional Client Portal
          </p>
          <div className={styles.bannerMeta}>
            <div>📍 <span>{albumInfo?.location || 'Studio'}</span></div>
            <div>📅 <span>{albumInfo?.date || 'Gần đây'}</span></div>
            <div>📂 <span>{photos.length} photos delivered</span></div>
          </div>
        </div>

        <div className={styles.bannerRight}>
          {canDownload && albumId ? (
            <a href={`/api/albums/${albumId}/download-all`} className={styles.downloadAllBtn}>
              ⬇️ Download all ({selectedCount > 0 ? `${selectedCount} selected` : 'ZIP'})
            </a>
          ) : !canDownload ? (
            <div className={styles.disabledNotice}>
              <div className={styles.disabledTitle}>🔒 Original Downloads Disabled</div>
              <div>The photographer has restricted access to compressed previews only.</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid Toolbar Controls matching AI Studio layout */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search shared photos..."
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
            All Shared ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('recommended')}
            className={`${styles.filterBtn} ${filter === 'recommended' ? styles.filterBtnActive : ''}`}
          >
            Studio Choice ({photos.filter((p) => p.suggestedByPhotographer).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('liked')}
            className={`${styles.filterBtn} ${filter === 'liked' ? styles.filterBtnActive : ''}`}
          >
            My Selections ({selectedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('comments')}
            className={`${styles.filterBtn} ${filter === 'comments' ? styles.filterBtnActive : ''}`}
          >
            With Feedback ({photos.filter((p) => p.comments.length > 0).length})
          </button>
        </div>
      </div>

      {/* Grid List or Empty State */}
      {processedPhotos.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: '2rem' }}>🖼️</div>
          <div style={{ fontWeight: 600 }}>No Matching Photos Found</div>
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
            Adjust your search queries or category filters to view delivered photos.
          </div>
        </div>
      ) : (
        <ul className={styles.grid}>
          {processedPhotos.map((photo) => {
            const actualIndex = photos.findIndex((p) => p.id === photo.id)
            return (
              <li key={photo.id}>
                <ClientPhotoTile
                  photo={photo}
                  canDownload={canDownload}
                  photographerName={albumInfo?.photographerName}
                  onOpen={() => setOpenIndex(actualIndex)}
                />
              </li>
            )
          })}
        </ul>
      )}

      {openIndex !== null && photos[openIndex] && (
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
  photographerName,
  onOpen,
}: {
  photo: GalleryPhoto
  canDownload: boolean
  photographerName?: string
  onOpen: () => void
}) {
  const { submitting, error, toggle } = useLikeToggle(photo.id)
  return (
    <>
      <PhotoTile
        thumbnailUrl={photo.thumbnailUrl}
        name={photo.name}
        photographerName={photographerName}
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
