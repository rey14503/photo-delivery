'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './AlbumCard.module.css'

export interface AlbumCardProps {
  album: {
    id: string
    name: string
    clientName: string
    shareToken: string
    hasPassword: boolean
    photoCount: number
    createdAt: string | Date
  }
}

export function AlbumCard({ album }: AlbumCardProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    await navigator.clipboard?.writeText(`${origin}/a/${album.shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateStr = new Date(album.createdAt).toLocaleDateString('vi-VN')

  return (
    <article className={styles.card}>
      <div>
        <div className={styles.header}>
          <h2 className={styles.title} title={album.name}>
            {album.name}
          </h2>
          <p className={styles.client}>Khách hàng: {album.clientName}</p>
        </div>
        <div className={styles.meta} style={{ marginTop: 12 }}>
          <span className={styles.badge}>{album.photoCount} ảnh</span>
          <span className={styles.badge}>
            {album.hasPassword ? '🔒 Có mật khẩu' : '🔓 Mở'}
          </span>
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.date}>{dateStr}</span>
        <div className={styles.actions}>
          <button type="button" onClick={handleCopy} className={styles.btnCopy}>
            {copied ? 'Đã copy!' : 'Copy link'}
          </button>
          <Link href={`/albums/${album.id}`} className={styles.btnView}>
            Xem album
          </Link>
        </div>
      </div>
    </article>
  )
}
