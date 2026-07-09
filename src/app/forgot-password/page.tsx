'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AuthCard } from '@/components/AuthCard'
import styles from '@/components/AuthCard.module.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong while requesting reset.')
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
      title="Reset your password"
      subtitle="Enter the email address associated with your account and we'll send you a link to reset your password."
      footer={
        <Link href="/login" className={styles.link}>
          Back to sign in
        </Link>
      }
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '2rem' }}>📬</div>
          <p style={{ color: 'var(--text-main, #ffffff)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
            If an account exists for that email, we&apos;ve sent a reset link.
          </p>
          <p style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.82rem', margin: 0 }}>
            Please check your inbox and spam folder.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="emailInput" className={styles.label}>
              Email address
            </label>
            <input
              id="emailInput"
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>

          {error && <p role="alert" className={styles.alert}>{error}</p>}

          <button type="submit" disabled={submitting} className={styles.btnPrimary}>
            {submitting ? 'Sending link…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
