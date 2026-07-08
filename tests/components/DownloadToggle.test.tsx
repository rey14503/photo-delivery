import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DownloadToggle } from '@/components/DownloadToggle'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('DownloadToggle', () => {
  it('turns downloads on and refreshes when currently off', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', downloadEnabled: true }),
    } as never)

    render(<DownloadToggle albumId="album_1" downloadEnabled={false} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/download-toggle',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ enabled: true }),
      })
    )
  })

  it('turns downloads off when currently on', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1', downloadEnabled: false }),
    } as never)

    render(<DownloadToggle albumId="album_1" downloadEnabled={true} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/download-toggle',
      expect.objectContaining({
        body: JSON.stringify({ enabled: false }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)

    render(<DownloadToggle albumId="album_1" downloadEnabled={false} />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })

  it('reflects the current state via aria-pressed and label', () => {
    render(<DownloadToggle albumId="album_1" downloadEnabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Downloads: On')
  })
})
