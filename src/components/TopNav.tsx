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
            + Create Album
          </button>
        ) : (
          <Link href="/albums/new" className={styles.primaryBtn}>
            + Create Album
          </Link>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.user}>{displayUser}</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={styles.signOut}
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
