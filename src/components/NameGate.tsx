'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function NameGate() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/share/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>What&apos;s your name?</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Your name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Continuing…' : 'Continue'}
        </button>
      </form>
    </main>
  )
}
