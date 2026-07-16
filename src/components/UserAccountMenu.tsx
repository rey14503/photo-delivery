'use client'

import React, { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import styles from './UserAccountMenu.module.css'
import { EditProfileModal } from './EditProfileModal'
import { ManageTeamModal } from './ManageTeamModal'
import { GearOutlineIcon, SignOutOutlineIcon, SunIcon, MoonIcon, MonitorIcon } from './PhotoIcons'

export interface UserAccountMenuProps {
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
  studioName?: string | null
  role?: 'OWNER' | 'ADMIN' | 'PHOTOGRAPHER'
}

export function UserAccountMenu({
  userName: initialUserName,
  userEmail,
  avatarUrl: initialAvatarUrl,
  studioName: initialStudioName,
  role: initialRole,
}: UserAccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [name, setName] = useState(initialUserName || '')
  const [studioName, setStudioName] = useState(initialStudioName || '')
  const [role, setRole] = useState<'OWNER' | 'ADMIN' | 'PHOTOGRAPHER'>(initialRole || 'PHOTOGRAPHER')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || null)
  const [imgError, setImgError] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (initialUserName) setName(initialUserName)
    if (initialStudioName) setStudioName(initialStudioName)
    if (initialAvatarUrl) setAvatarUrl(initialAvatarUrl)
    if (initialRole) setRole(initialRole)

    fetch('/api/user/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.name) setName(data.name)
          if (data.studioName !== undefined) setStudioName(data.studioName)
          if (data.role) setRole(data.role)
          if (data.avatarUrl !== undefined) setAvatarUrl(data.avatarUrl)
        }
      })
      .catch(err => console.error('Failed to fetch latest profile in UserAccountMenu:', err))
  }, [initialUserName, initialStudioName, initialAvatarUrl, initialRole])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const displayUser = name || studioName || userEmail || 'Photographer'
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'BK'

  const handleProfileUpdated = (updated: { name: string; studioName: string; avatarUrl: string | null; role: 'OWNER' | 'ADMIN' | 'PHOTOGRAPHER' }) => {
    setName(updated.name)
    setStudioName(updated.studioName)
    setRole(updated.role)
    setAvatarUrl(updated.avatarUrl)
    setImgError(false)
    setOpen(false) // Auto-close the menu after successful save
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.triggerBtn}
        onClick={() => setOpen(!open)}
        aria-label="open user menu"
      >
        <div className={styles.triggerAvatar}>
          {avatarUrl && !imgError ? (
            <img src={avatarUrl} alt="" className={styles.triggerAvatarImg} onError={() => setImgError(true)} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <span className={styles.triggerText}>{displayUser}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▼</span>
      </button>

      {open && (
        <div className={styles.popover}>
          <div className={styles.headerBox}>
            <div className={styles.popoverAvatarWrapper}>
              <div
                className={styles.popoverAvatar}
                onClick={() => {
                  setOpen(false)
                  setShowEditModal(true)
                }}
                title="Update profile picture"
              >
                {avatarUrl && !imgError ? (
                  <img src={avatarUrl} alt="" className={styles.popoverAvatarImg} onError={() => setImgError(true)} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                className={styles.popoverCameraBadge}
                onClick={() => {
                  setOpen(false)
                  setShowEditModal(true)
                }}
                title="Update profile picture"
                aria-label="Update profile picture"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                </svg>
              </button>
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{name || 'Photographer'}</span>
              <span className={styles.userEmail}>{userEmail || ''}</span>
              <div className={styles.badgesWrapper}>
                <span className={styles.roleBadge}>
                  {role === 'OWNER' ? 'Owner' : role === 'ADMIN' ? 'Admin' : 'Photographer'}
                </span>
                {studioName && (
                  <span className={styles.nicknameBadge}>
                    {studioName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.menuList}>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                setOpen(false)
                setShowEditModal(true)
              }}
            >
              <GearOutlineIcon size={18} className={styles.menuIconSvg} />
              <span>Edit Profile / Studio</span>
            </button>
            {(role === 'OWNER' || role === 'ADMIN') && (
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setOpen(false)
                  setShowTeamModal(true)
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.menuIconSvg}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>Manage Team & Permissions</span>
              </button>
            )}
            {mounted && (
              <div className={styles.themeToggleRow}>
                <span className={styles.themeToggleLabel}>Theme</span>
                <div className={styles.themeToggleGroup}>
                  <button
                    type="button"
                    className={`${styles.themeToggleBtn} ${theme === 'system' ? styles.themeToggleBtnActive : ''}`}
                    onClick={() => setTheme('system')}
                    title="System"
                  >
                    <MonitorIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeToggleBtn} ${theme === 'light' ? styles.themeToggleBtnActive : ''}`}
                    onClick={() => setTheme('light')}
                    title="Light"
                  >
                    <SunIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeToggleBtn} ${theme === 'dark' ? styles.themeToggleBtnActive : ''}`}
                    onClick={() => setTheme('dark')}
                    title="Dark"
                  >
                    <MoonIcon size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.footerBox}>
            <button
              type="button"
              className={styles.signOutBtn}
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <SignOutOutlineIcon size={18} className={styles.menuIconSvg} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {showEditModal && (
        <EditProfileModal
          initialName={name}
          initialStudioName={studioName}
          initialAvatarUrl={avatarUrl}
          initialRole={role}
          onClose={() => setShowEditModal(false)}
          onSaveSuccess={handleProfileUpdated}
        />
      )}

      <ManageTeamModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
      />
    </div>
  )
}
