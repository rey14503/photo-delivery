'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export interface CreateAlbumFormProps {
  onSuccess?: () => void
}

export function CreateAlbumForm({ onSuccess }: CreateAlbumFormProps = {}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clientName }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/albums')
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Album name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Client name
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create album'}
      </button>
    </form>
  )
}
