import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SetAlbumPassword } from '@/components/SetAlbumPassword'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('SetAlbumPassword', () => {
  it('submits a new password and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', hasPassword: true }),
    } as never)

    render(<SetAlbumPassword albumId="album_1" hasPassword={false} />)
    fireEvent.change(screen.getByLabelText('Album password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret123' }),
      })
    )
  })

  it('shows a remove-password button and clears it when a password is already set', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', hasPassword: false }),
    } as never)

    render(<SetAlbumPassword albumId="album_1" hasPassword={true} />)
    fireEvent.click(screen.getByRole('button', { name: /remove password/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: null }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)

    render(<SetAlbumPassword albumId="album_1" hasPassword={false} />)
    fireEvent.change(screen.getByLabelText('Album password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })
})
