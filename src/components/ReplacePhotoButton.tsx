'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

export function ReplacePhotoButton({ photoId }: { photoId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const res = await fetch(`/api/photos/${photoId}/replace`, {
        method: 'POST',
        body: formData,
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
      setUploading(false)
    }
  }

  return (
    <div>
      <label>
        Replace photo
        <input type="file" accept="image/*" onChange={handleChange} disabled={uploading} />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
