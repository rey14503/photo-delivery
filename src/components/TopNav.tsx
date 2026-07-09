'use client'

import Link from 'next/link'
import styles from './TopNav.module.css'

export interface TopNavProps {
  userName?: string | null
  userEmail?: string | null
  onCreateClick?: () => void
}

export function TopNav({ userName, userEmail, onCreateClick }: TopNavProps) {
  const displayUser = userName || userEmail || 'Photographer'

  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        <Link href="/albums" className={styles.brand}>
          <img src="/logo.png" alt="Product Logo" className={styles.logo} />
          <span>Photo Delivery</span>
        </Link>
        {onCreateClick ? (
          <button type="button" onClick={onCreateClick} className={styles.primaryBtn}>
            + Tạo album
          </button>
        ) : (
          <Link href="/albums/new" className={styles.primaryBtn}>
            + Tạo album
          </Link>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.user}>{displayUser}</span>
        <Link href="/api/auth/signout" className={styles.signOut}>
          Đăng xuất
        </Link>
      </div>
    </header>
  )
}
