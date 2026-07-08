import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReplacePhotoButton } from '@/components/ReplacePhotoButton'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('ReplacePhotoButton', () => {
  it('uploads the replacement file to the replace endpoint and refreshes', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'photo_1', version: 2 }),
    } as never)

    render(<ReplacePhotoButton photoId="photo_1" />)
    const input = screen.getByLabelText('Replace photo') as HTMLInputElement
    const file = new File(['bytes'], 'edited.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/photos/photo_1/replace',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows an error message when the replace fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'file must be an image' }),
    } as never)

    render(<ReplacePhotoButton photoId="photo_1" />)
    const input = screen.getByLabelText('Replace photo') as HTMLInputElement
    const file = new File(['bytes'], 'a.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('file must be an image')
  })
})
