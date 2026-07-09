import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { PhotographerGallery } from '@/components/PhotographerGallery'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const photos = [
  {
    id: 'p1',
    thumbnailUrl: 'https://blob/p1-thumb.jpg',
    previewUrl: 'https://blob/p1-preview.jpg',
    version: 1,
    suggestedByMe: false,
    clientLikers: [],
    comments: [],
  },
  {
    id: 'p2',
    thumbnailUrl: 'https://blob/p2-thumb.jpg',
    previewUrl: 'https://blob/p2-preview.jpg',
    version: 3,
    suggestedByMe: true,
    clientLikers: ['Jane Doe', 'John Smith'],
    comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }],
  },
]

describe('PhotographerGallery', () => {
  it('renders a tile per photo with version badge and client-likers status note', () => {
    render(<PhotographerGallery photos={photos} />)

    expect(screen.getByText('v3')).toBeTruthy()
    expect(screen.getByText('❤ Selected by: Jane Doe, John Smith')).toBeTruthy()
  })

  it('opens the lightbox showing the preview image when a tile is clicked', () => {
    render(<PhotographerGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('shows a star icon for the suggest toggle and posts to the like endpoint', () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as never)
    render(<PhotographerGallery photos={photos} />)

    const suggestButton = screen.getByRole('button', { name: 'Suggest to client' })
    expect(suggestButton.textContent).toBe('☆')

    fireEvent.click(suggestButton)

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/p1/like', { method: 'POST' })
  })

  it('shows Replace / update version in the action menu, and Download is always present', () => {
    render(<PhotographerGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[0])
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /more actions/i }))

    expect(within(dialog).getByRole('menuitem', { name: /replace \/ update version/i })).toBeTruthy()
    expect(within(dialog).getByRole('menuitem', { name: /download/i })).toBeTruthy()
  })

  it('triggers the hidden file input when Replace / update version is chosen', () => {
    render(<PhotographerGallery photos={photos} />)

    const fileInput = screen.getAllByLabelText('Replace photo file')[0] as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    fireEvent.click(screen.getAllByRole('button', { name: /more actions/i })[0])
    fireEvent.click(screen.getAllByRole('menuitem', { name: /replace \/ update version/i })[0])

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('uploads a replacement file and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as never)
    render(<PhotographerGallery photos={photos} />)

    const fileInput = screen.getAllByLabelText('Replace photo file')[0] as HTMLInputElement
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/photos/p1/replace',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('shows an error message when the suggest toggle fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)
    render(<PhotographerGallery photos={photos} />)

    fireEvent.click(screen.getByRole('button', { name: 'Suggest to client' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })

  it('shows an error message when the replace upload fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File too large' }),
    } as never)
    render(<PhotographerGallery photos={photos} />)

    const fileInput = screen.getAllByLabelText('Replace photo file')[0] as HTMLInputElement
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('File too large')
  })
})
