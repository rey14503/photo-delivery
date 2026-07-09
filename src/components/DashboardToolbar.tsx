'use client'

import styles from './DashboardToolbar.module.css'

export interface DashboardToolbarProps {
  albumCount: number
  photoCount: number
}

export function DashboardToolbar({ albumCount, photoCount }: DashboardToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <h1 className={styles.title}>Bảng điều khiển</h1>
      <div className={styles.metrics}>
        <span className={styles.pill}>Tổng số album: {albumCount}</span>
        <span className={styles.pill}>Tổng số ảnh: {photoCount}</span>
      </div>
    </div>
  )
}
