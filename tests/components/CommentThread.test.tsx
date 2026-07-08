import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommentThread } from '@/components/CommentThread'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('CommentThread', () => {
  it('renders existing comments', () => {
    render(
      <CommentThread
        photoId="photo_1"
        comments={[{ id: 'c1', text: 'Love this!', authorLabel: 'Jane Doe' }]}
      />
    )

    expect(screen.getByText(/Love this!/)).toBeTruthy()
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
  })

  it('submits a new comment and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'c2', text: 'Nice shot', authorLabel: 'Jane Doe' }),
    } as never)

    render(<CommentThread photoId="photo_1" comments={[]} />)
    fireEvent.change(screen.getByLabelText('Add a comment'), {
      target: { value: 'Nice shot' },
    })
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/photos/photo_1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Nice shot' }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A comment between 1 and 2000 characters is required' }),
    } as never)

    render(<CommentThread photoId="photo_1" comments={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /post comment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A comment between 1 and 2000 characters is required'
    )
  })
})
