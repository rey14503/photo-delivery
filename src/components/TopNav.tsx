'use client'

import Link from 'next/link'
import styles from './TopNav.module.css'
import { UserAccountMenu } from './UserAccountMenu'
import { FALLBACK_LOGO_DATA_URL } from '@/lib/logo-data'

export interface TopNavProps {
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
  studioName?: string | null
  role?: 'ADMIN' | 'PHOTOGRAPHER'
  onCreateClick?: () => void
  onLogoClick?: () => void
}

export function TopNav({ userName, userEmail, avatarUrl, studioName, role, onCreateClick, onLogoClick }: TopNavProps) {
  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        <Link
          href="/albums"
          className={styles.brand}
          onClick={() => {
            if (onLogoClick) onLogoClick()
          }}
        >
          <img
            src="/logo.png"
            alt="BK Media Box Logo"
            className={styles.logo}
            onError={(e) => {
              if (e.currentTarget.src !== FALLBACK_LOGO_DATA_URL) {
                e.currentTarget.src = FALLBACK_LOGO_DATA_URL
              }
            }}
          />
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
          role={role}
        />
      </div>
    </header>
  )
}
