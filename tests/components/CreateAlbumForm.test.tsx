import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateAlbumForm } from '@/components/CreateAlbumForm'

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('CreateAlbumForm', () => {
  it('submits name and clientName and redirects on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1' }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.change(screen.getByLabelText('Album name'), { target: { value: 'Wedding' } })
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/albums'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Wedding', clientName: 'Jane' }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'name and clientName are required' }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'name and clientName are required'
    )
  })

  it('shows a network error and re-enables the button when fetch rejects', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    render(<CreateAlbumForm />)
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network error — please try again.'
    )
    expect(screen.getByRole('button', { name: /create album/i })).toBeInTheDocument()
  })
})
