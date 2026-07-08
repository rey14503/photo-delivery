'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

async function submitPassword(albumId: string, password: string | null) {
  return fetch(`/api/albums/${albumId}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export function SetAlbumPassword({
  albumId,
  hasPassword,
}: {
  albumId: string
  hasPassword: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSetSubmit(e: FormEvent) {
    e.preventDefault()
    await run(password)
  }

  async function handleRemove() {
    await run(null)
  }

  async function run(value: string | null) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitPassword(albumId, value)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      setPassword('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSetSubmit}>
        <label>
          Album password
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {hasPassword ? 'Change password' : 'Set password'}
        </button>
      </form>
      {hasPassword && (
        <button type="button" onClick={handleRemove} disabled={submitting}>
          Remove password
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
