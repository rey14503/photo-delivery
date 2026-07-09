'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from './CommentThread.module.css'

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
    <div className={styles.container}>
      <div className={styles.header}>
        <span>Comments</span>
        <span>{comments.length}</span>
      </div>
      {comments.length === 0 ? (
        <div className={styles.empty}>No comments yet. Start the conversation!</div>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.item}>
              <span className={styles.author}>
                <span>👤</span>
                {comment.authorLabel}
              </span>
              <span className={styles.text}>{comment.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputRow}>
            <label
              htmlFor={`commentInput_${photoId}`}
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                border: 0,
              }}
            >
              Add a comment
            </label>
            <textarea
              id={`commentInput_${photoId}`}
              aria-label="Add a comment"
              placeholder="Add a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={styles.textarea}
              rows={1}
            />
            <button
              type="submit"
              disabled={submitting}
              className={styles.sendButton}
              aria-label="Post comment"
            >
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
      </div>
    </div>
  )
}
