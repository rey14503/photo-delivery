'use client'

import { useState, type FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthCard } from '@/components/AuthCard'
import styles from '@/components/AuthCard.module.css'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Invalid or missing password reset token. Please request a new link.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Unable to reset password. The token may be expired or invalid.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle={!submitted && 'Enter your new password below to secure your account.'}
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '2rem' }}>🎉</div>
          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
            Your password has been successfully reset.
          </p>
          <div>
            <Link href="/login" className={styles.btnPrimary} style={{ display: 'inline-block', textDecoration: 'none' }}>
              Sign in with new password
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="newPasswordInput" className={styles.label}>
              New password
            </label>
            <input
              id="newPasswordInput"
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPasswordInput" className={styles.label}>
              Confirm new password
            </label>
            <input
              id="confirmPasswordInput"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
            />
          </div>

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p role="alert" className={styles.alert}>{error}</p>
              <div style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                <Link href="/forgot-password" className={styles.forgotLink}>
                  Request a new reset link &rarr;
                </Link>
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting} className={styles.btnPrimary}>
            {submitting ? 'Updating password…' : 'Reset password'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthCard title="Set a new password">
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          Loading reset options...
        </div>
      </AuthCard>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
