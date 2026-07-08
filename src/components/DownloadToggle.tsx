'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DownloadToggle({
  albumId,
  downloadEnabled,
}: {
  albumId: string
  downloadEnabled: boolean
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/albums/${albumId}/download-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !downloadEnabled }),
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
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={submitting}
        aria-pressed={downloadEnabled}
      >
        {downloadEnabled ? 'Downloads: On' : 'Downloads: Off'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
