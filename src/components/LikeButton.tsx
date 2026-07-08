'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LikeButton({
  photoId,
  liked,
  label,
}: {
  photoId: string
  liked: boolean
  label: string
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' })
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
    <div>
      <button type="button" onClick={handleClick} disabled={submitting} aria-pressed={liked}>
        {liked ? `${label} (on)` : `${label} (off)`}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
