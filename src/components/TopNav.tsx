'use client'

import Link from 'next/link'
import styles from './TopNav.module.css'
import { UserAccountMenu } from './UserAccountMenu'

export interface TopNavProps {
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
  studioName?: string | null
  onCreateClick?: () => void
}

export function TopNav({ userName, userEmail, avatarUrl, studioName, onCreateClick }: TopNavProps) {
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
        <UserAccountMenu
          userName={userName}
          userEmail={userEmail}
          avatarUrl={avatarUrl}
          studioName={studioName}
        />
      </div>
    </header>
  )
}
