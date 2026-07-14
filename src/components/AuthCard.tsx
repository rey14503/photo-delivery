import React, { type ReactNode } from 'react'
import styles from './AuthCard.module.css'
import { FALLBACK_LOGO_DATA_URL } from '@/lib/logo-data'

export interface AuthCardProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.logoWrapper}>
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
          </div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  )
}
