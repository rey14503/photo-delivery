import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LikeButton } from '@/components/LikeButton'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('LikeButton', () => {
  it('toggles by posting to the like endpoint and refreshing on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ liked: true }),
    } as never)

    render(<LikeButton photoId="photo_1" liked={false} label="Select" />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/photo_1/like', { method: 'POST' })
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    } as never)

    render(<LikeButton photoId="photo_1" liked={false} label="Select" />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized')
  })

  it('reflects the liked state in its label and aria-pressed', () => {
    render(<LikeButton photoId="photo_1" liked={true} label="Select" />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Select (on)')
  })
})
