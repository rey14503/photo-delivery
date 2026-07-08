import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadPhotos } from '@/components/UploadPhotos'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('UploadPhotos', () => {
  it('uploads each selected file to the album photos endpoint and refreshes', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'photo_1' }),
    } as never)

    render(<UploadPhotos albumId="album_1" />)
    const input = screen.getByLabelText('Upload photos') as HTMLInputElement
    const file = new File(['bytes'], 'a.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/albums/album_1/photos',
      expect.objectContaining({ method: 'POST' })
    )
    const callArgs = vi.mocked(global.fetch).mock.calls[0][1] as { body: FormData }
    expect(callArgs.body).toBeInstanceOf(FormData)
  })

  it('shows an error message when an upload fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'file must be an image' }),
    } as never)

    render(<UploadPhotos albumId="album_1" />)
    const input = screen.getByLabelText('Upload photos') as HTMLInputElement
    const file = new File(['bytes'], 'a.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('file must be an image')
  })
})
