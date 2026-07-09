'use client'

import styles from './DashboardToolbar.module.css'

export interface DashboardToolbarProps {
  albumCount: number
  photoCount: number
}

export function DashboardToolbar({ albumCount, photoCount }: DashboardToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <h1 className={styles.title}>Dashboard</h1>
      <div className={styles.metrics}>
        <span className={styles.pill}>Total albums: {albumCount}</span>
        <span className={styles.pill}>Total photos: {photoCount}</span>
      </div>
    </div>
  )
}
