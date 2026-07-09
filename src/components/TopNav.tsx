'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
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
          <img src="/logo.png" alt="BK Media Box Logo" className={styles.logo} />
          <span>
            <span className={styles.brandAccent}>BK</span> Media Box
          </span>
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
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={styles.signOut}
          aria-label="Đăng xuất"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  )
}
