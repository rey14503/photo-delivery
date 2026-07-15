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
  it('submits name, clientName, and driveLink and redirects on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_1' }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.change(screen.getByLabelText('Album name'), { target: { value: 'Wedding' } })
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText('Google Drive folder link'), { target: { value: 'https://drive.google.com/drive/folders/123ABC' } })
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/albums/album_1'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Wedding', clientName: 'Jane', driveLink: 'https://drive.google.com/drive/folders/123ABC', selectionLimit: 0 }),
      })
    )
  })

  it('displays imported and skipped counts when returned from creation response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'album_2', imported: 15, skipped: 3 }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.change(screen.getByLabelText('Album name'), { target: { value: 'Birthday' } })
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText('Google Drive folder link'), { target: { value: 'https://drive.google.com/drive/folders/456DEF' } })
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Successfully imported 15 photos!/)
    expect(screen.getByRole('status')).toHaveTextContent(/Skipped 3 non-image files/)
  })

  it('shows an error message when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'name and clientName are required' }),
    } as never)

    render(<CreateAlbumForm />)
    fireEvent.change(screen.getByLabelText('Google Drive folder link'), { target: { value: 'https://drive.google.com/drive/folders/456DEF' } })
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'name and clientName are required'
    )
  })

  it('shows a network error and re-enables the button when fetch rejects', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    render(<CreateAlbumForm />)
    fireEvent.change(screen.getByLabelText('Google Drive folder link'), { target: { value: 'https://drive.google.com/drive/folders/456DEF' } })
    fireEvent.click(screen.getByRole('button', { name: /create album/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network error — please try again.'
    )
    expect(screen.getByRole('button', { name: /create album/i })).toBeInTheDocument()
  })

  it('disables all form inputs, toggles, and buttons while submitting', async () => {
    let resolvePromise: (value: unknown) => void = () => {}
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    vi.mocked(global.fetch).mockReturnValue(pendingPromise as never)

    const onCancel = vi.fn()
    render(<CreateAlbumForm onCancel={onCancel} />)

    const driveInput = screen.getByLabelText('Google Drive folder link')
    const albumInput = screen.getByLabelText('Album name')
    const clientInput = screen.getByLabelText('Client name')
    const submitBtn = screen.getByRole('button', { name: /create album/i })
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })

    fireEvent.change(driveInput, { target: { value: 'https://drive.google.com/drive/folders/456DEF' } })
    fireEvent.click(submitBtn)

    expect(driveInput).toBeDisabled()
    expect(albumInput).toBeDisabled()
    expect(clientInput).toBeDisabled()
    expect(submitBtn).toBeDisabled()
    expect(cancelBtn).toBeDisabled()

    resolvePromise({ ok: true, json: async () => ({ id: 'album_123' }) })
  })
})
