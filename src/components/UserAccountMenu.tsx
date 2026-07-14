'use client'

import React, { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import styles from './UserAccountMenu.module.css'
import { EditProfileModal } from './EditProfileModal'
import { GearOutlineIcon, SignOutOutlineIcon } from './PhotoIcons'

export interface UserAccountMenuProps {
  userName?: string | null
  userEmail?: string | null
  avatarUrl?: string | null
  studioName?: string | null
}

export function UserAccountMenu({
  userName: initialUserName,
  userEmail,
  avatarUrl: initialAvatarUrl,
  studioName: initialStudioName,
}: UserAccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [name, setName] = useState(initialUserName || '')
  const [studioName, setStudioName] = useState(initialStudioName || '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setName(initialUserName || '')
  }, [initialUserName])

  useEffect(() => {
    setStudioName(initialStudioName || '')
  }, [initialStudioName])

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl || null)
  }, [initialAvatarUrl])

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

  const handleProfileUpdated = (updated: { name: string; studioName: string; avatarUrl: string | null }) => {
    setName(updated.name)
    setStudioName(updated.studioName)
    setAvatarUrl(updated.avatarUrl)
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
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className={styles.triggerAvatarImg} />
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className={styles.popoverAvatarImg} />
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
              <span className={styles.studioBadge}>{studioName || 'PRO Studio'}</span>
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
          onClose={() => setShowEditModal(false)}
          onSaveSuccess={handleProfileUpdated}
        />
      )}
    </div>
  )
}
