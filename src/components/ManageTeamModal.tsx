'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './ManageTeamModal.module.css'

export interface TeamUser {
  id: string
  email: string
  name?: string | null
  studioName?: string | null
  role: 'OWNER' | 'ADMIN' | 'PHOTOGRAPHER'
  avatarUrl?: string | null
}

export interface ManageTeamModalProps {
  currentUserId?: string
  isOpen: boolean
  onClose: () => void
}

export function ManageTeamModal({
  currentUserId,
  isOpen,
  onClose,
}: ManageTeamModalProps) {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [backdropMouseDown, setBackdropMouseDown] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (err) {
      console.error('Failed to fetch team users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'PHOTOGRAPHER') => {
    setUpdatingId(userId)
    try {
      const res = await fetch(`/api/team/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, role: updated.role } : u))
        )
      } else {
        const errData = await res.json()
        alert(errData.error || 'Failed to update user role')
      }
    } catch (err) {
      console.error('Role update failed:', err)
      alert('Failed to update user role')
    } finally {
      setUpdatingId(null)
    }
  }

  if (!mounted || !isOpen || typeof document === 'undefined') return null

  const modalContent = (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setBackdropMouseDown(true)
        else setBackdropMouseDown(false)
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDown) onClose()
        setBackdropMouseDown(false)
      }}
    >
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Team & Permissions</h2>
            <p className={styles.subtitle}>
              Manage user roles for project administration and team job schedules
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingBox}>Loading team members...</div>
          ) : users.length === 0 ? (
            <div className={styles.loadingBox}>No team members found.</div>
          ) : (
            users.map(u => {
              const initials = u.name
                ? u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                : 'BK'
              const isOwner = u.role === 'OWNER' || u.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL || u.email === 'khoanguyenfotk5@gmail.com'

              return (
                <div key={u.id} className={styles.userCard}>
                  <div className={styles.userInfo}>
                    {u.avatarUrl && !imgErrors[u.id] ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className={styles.avatar}
                        onError={() => setImgErrors(prev => ({ ...prev, [u.id]: true }))}
                      />
                    ) : (
                      <div className={styles.avatar}>{initials}</div>
                    )}
                    <div className={styles.userDetails}>
                      <div className={styles.userNameRow}>
                        <span className={styles.userName}>{u.name || 'Photographer'}</span>
                        {u.studioName && (
                          <span className={styles.userNickname}>{u.studioName}</span>
                        )}
                      </div>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                  </div>

                  <div className={styles.roleAction}>
                    {isOwner ? (
                      <span className={styles.ownerBadge}>Owner (Root)</span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={updatingId === u.id}
                        onChange={e => handleRoleChange(u.id, e.target.value as 'ADMIN' | 'PHOTOGRAPHER')}
                        className={styles.roleSelect}
                      >
                        <option value="PHOTOGRAPHER">Photographer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
