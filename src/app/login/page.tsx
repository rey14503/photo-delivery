'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthCard } from '@/components/AuthCard'
import styles from '@/components/AuthCard.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  async function handleGoogleSignIn() {
    setGoogleSubmitting(true)
    setError(null)
    try {
      await signIn('google', { callbackUrl: '/albums' })
    } catch {
      setError('Unable to connect to Google authentication.')
      setGoogleSubmitting(false)
    }
  }

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError('Invalid email or password.')
      } else if (res?.ok) {
        router.push('/albums')
        router.refresh()
      } else {
        setError('An unexpected error occurred during sign in.')
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle={
        <>
          Don&apos;t have an account?{' '}
          <Link href="/register" className={styles.link}>
            Sign up
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleSubmitting || submitting}
        className={styles.btnGoogle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            fill="#EA4335"
          />
        </svg>
        {googleSubmitting ? 'Connecting…' : 'Sign in with Google'}
      </button>

      <div className={styles.divider}>Or use email</div>

      <form onSubmit={handleCredentialsSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="emailInput" className={styles.label}>
            Email
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

        <div className={styles.field}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="passwordInput" className={styles.label}>
              Password
            </label>
            <Link href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>
          <input
            id="passwordInput"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
        </div>

        {error && <p role="alert" className={styles.alert}>{error}</p>}

        <button
          type="submit"
          disabled={submitting || googleSubmitting}
          className={styles.btnPrimary}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  )
}
