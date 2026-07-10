import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { ClientGallery } from '@/components/ClientGallery'

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
    likedByMe: false,
    suggestedByPhotographer: false,
    comments: [],
  },
  {
    id: 'p2',
    thumbnailUrl: 'https://blob/p2-thumb.jpg',
    previewUrl: 'https://blob/p2-preview.jpg',
    version: 2,
    likedByMe: true,
    suggestedByPhotographer: true,
    comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }],
  },
  {
    id: 'p3',
    thumbnailUrl: 'https://blob/p3-thumb.jpg',
    previewUrl: 'https://blob/p3-preview.jpg',
    version: 1,
    likedByMe: false,
    suggestedByPhotographer: false,
    comments: [],
  },
]

const basePhoto = {
  id: 'base_p1',
  thumbnailUrl: 'https://blob/base-thumb.jpg',
  previewUrl: 'https://blob/base-preview.jpg',
  version: 1,
  likedByMe: false,
  suggestedByPhotographer: false,
  comments: [],
}

describe('ClientGallery', () => {
  it('renders a tile for every photo and no lightbox initially', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.getAllByRole('button', { name: /open photo/i })).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the lightbox showing the preview image when a tile is clicked', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('navigates to the next photo and closes the lightbox', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the suggested-by-photographer note on the tile and in the lightbox for a suggested photo', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.getByText('Suggested by photographer')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    expect(screen.getAllByText('Suggested by photographer')).toHaveLength(2)
  })

  it('does not show the suggested note for a photo with no photographer like', () => {
    render(<ClientGallery photos={[photos[0]]} canDownload={false} />)

    expect(screen.queryByText(/suggested by photographer/i)).toBeNull()
  })

  it('shows no download links when downloads are disabled', () => {
    render(<ClientGallery photos={photos} canDownload={false} />)

    expect(screen.queryByRole('link', { name: /download all/i })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[0])

    expect(screen.queryByRole('link', { name: /^download$/i })).toBeNull()
  })

  it('shows a per-photo download link and a download-all link when downloads are enabled', () => {
    render(<ClientGallery photos={photos} canDownload={true} albumId="album_1" />)

    const downloadAll = screen.getByRole('link', { name: /download all/i })
    expect(downloadAll).toHaveAttribute('href', '/api/albums/album_1/download-all')

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])

    const downloadPhoto = screen.getByRole('link', { name: /^download$/i })
    expect(downloadPhoto).toHaveAttribute('href', '/api/photos/p2/download')
  })

  it('toggles like via the quick icon on the tile, posting to the like endpoint', () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as never)
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Select this photo' })[0])

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/p1/like', { method: 'POST' })
  })

  it('shows an error message when the like toggle fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)
    render(<ClientGallery photos={photos} canDownload={false} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Select this photo' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })

  it('shows the correct action menu items for a client actor', () => {
    render(<ClientGallery photos={photos} canDownload={true} albumId="album_1" />)

    fireEvent.click(screen.getAllByRole('button', { name: /open photo/i })[1])
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /more actions/i }))

    expect(within(dialog).getByRole('menuitem', { name: 'Unselect this photo' })).toBeTruthy()
    expect(within(dialog).getByRole('menuitem', { name: /download/i })).toBeTruthy()
    expect(within(dialog).getByRole('menuitem', { name: /view comments \(1\)/i })).toBeTruthy()
    expect(within(dialog).queryByRole('menuitem', { name: /replace/i })).toBeNull()
  })

  it('renders floating selection bar when photos are selected, triggers confirmation modal and lock selection', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    global.fetch = fetchMock

    render(
      <ClientGallery
        albumId="alb_123"
        shareToken="tok_123"
        initialPhotos={[{ ...basePhoto, id: 'photo_1', liked: true }]}
        selectionLocked={false}
      />
    )

    expect(screen.getByText('Selected: 1 photo(s)')).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /submit final selection/i })
    fireEvent.click(submitBtn)

    expect(screen.getByText(/Are you sure you want to submit your selection of 1 photo/i)).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /confirm & submit/i })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb_123/lock-selection', expect.any(Object))
  })

  it('disables like button on ClientPhotoTile and shows submitted banner when selectionLocked is true', () => {
    render(
      <ClientGallery
        albumId="alb_123"
        shareToken="tok_123"
        initialPhotos={[{ ...basePhoto, id: 'photo_1', liked: true }]}
        selectionLocked={true}
      />
    )

    expect(screen.getByText(/Selection Submitted/i)).toBeInTheDocument()
    const likeBtn = screen.getByRole('button', { name: 'Select photo' })
    expect(likeBtn).toBeDisabled()
  })
})
