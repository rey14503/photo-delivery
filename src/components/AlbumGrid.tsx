'use client'

import { useState } from 'react'
import { TopNav } from './TopNav'
import { DashboardToolbar } from './DashboardToolbar'
import { AlbumCard, type AlbumCardProps } from './AlbumCard'
import { CreateAlbumModal } from './CreateAlbumModal'
import styles from './AlbumGrid.module.css'

export interface AlbumGridProps {
  albums: AlbumCardProps['album'][]
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
  studioName?: string | null
}

export function AlbumGrid({ albums, userName, userEmail, avatarUrl, studioName }: AlbumGridProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const totalPhotos = albums.reduce((acc, alb) => acc + alb.photoCount, 0)

  return (
    <>
      <TopNav
        userName={userName}
        userEmail={userEmail}
        avatarUrl={avatarUrl}
        studioName={studioName}
        onCreateClick={() => setModalOpen(true)}
        onLogoClick={() => setModalOpen(false)}
      />
      <DashboardToolbar albumCount={albums.length} photoCount={totalPhotos} />
      <main className={styles.container}>
        <div className={styles.grid}>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={styles.createTile}
            aria-label="Create new album in list"
          >
            <div className={styles.iconPlusWrap}>
              <span>+</span>
            </div>
            <span className={styles.labelCreate}>Create Album</span>
            <span className={styles.descCreate}>
              Upload photos, generate share links, and collaborate seamlessly with your clients.
            </span>
          </button>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </main>
      <CreateAlbumModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
