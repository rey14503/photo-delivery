'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

export function UploadPhotos({ albumId }: { albumId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.set('file', file)
        const res = await fetch(`/api/albums/${albumId}/photos`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Something went wrong')
          setUploading(false)
          return
        }
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
        Upload photos
        <input type="file" accept="image/*" multiple onChange={handleChange} disabled={uploading} />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
