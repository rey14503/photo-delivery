'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export interface ThreadComment {
  id: string
  text: string
  authorLabel: string
}

export function CommentThread({
  photoId,
  comments,
}: {
  photoId: string
  comments: ThreadComment[]
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      setText('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <ul>
        {comments.map((comment) => (
          <li key={comment.id}>
            <strong>{comment.authorLabel}:</strong> {comment.text}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label>
          Add a comment
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </div>
  )
}
