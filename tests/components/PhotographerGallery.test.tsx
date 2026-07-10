import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import { PhotographerGallery } from '@/components/PhotographerGallery'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const basePhoto = {
  id: 'p1',
  thumbnailUrl: 'https://blob/p1-thumb.jpg',
  previewUrl: 'https://blob/p1-preview.jpg',
  version: 1,
  suggestedByMe: false,
  clientLikers: [],
  comments: [],
}

const photos = [
  { ...basePhoto, id: 'p1' },
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
    const svgIcon = suggestButton.querySelector('svg')
    expect(svgIcon).toHaveAttribute('data-icon', 'star')
    expect(svgIcon).toHaveAttribute('data-filled', 'false')

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

  it('renders D6/D7 banner features: by photographer attribution, separate title lines, and copy/QR share link', () => {
    const albumInfo = {
      id: 'cmrbj8px100018ltoanzqoqyz',
      name: 'Wedding Album',
      clientName: 'Alice & Bob',
      photographerName: 'Jane Photographer',
      shareToken: '1234567890abcdef1234567890abcdef',
      date: '09/07/2026',
    }
    render(<PhotographerGallery photos={photos} albumInfo={albumInfo} />)

    expect(screen.getByText('• by Jane Photographer')).toBeTruthy()
    expect(screen.getByText('Wedding Album')).toBeTruthy()
    expect(screen.getByText('Alice & Bob')).toBeTruthy()
    expect(screen.queryByText(/cmrbj8px100018ltoanzqoqyz/)).toBeNull()
    expect(screen.queryByText(/📍/)).toBeNull()

    const qrBtn = screen.getByRole('button', { name: /toggle qr code/i })
    expect(qrBtn).toBeTruthy()
    fireEvent.click(qrBtn)

    const copyBtn = screen.getByRole('button', { name: /copy link/i })
    expect(copyBtn).toBeTruthy()
  })

  it('renders photo count with items label and allows toggling the edit names form', async () => {
    const albumInfo = {
      id: 'cmrbj8px100018ltoanzqoqyz',
      name: 'Wedding Album',
      clientName: 'Alice & Bob',
      photographerName: 'Jane Photographer',
      shareToken: '1234567890abcdef1234567890abcdef',
      date: '09/07/2026',
    }
    render(<PhotographerGallery photos={photos} albumInfo={albumInfo} />)

    expect(screen.getByText('2 photos')).toBeTruthy()

    const moreMenuBtn = screen.getByRole('button', { name: /more actions menu/i })
    expect(moreMenuBtn).toBeTruthy()
    fireEvent.click(moreMenuBtn)

    const editTrigger = screen.getByRole('button', { name: /edit details/i })
    expect(editTrigger).toBeTruthy()

    fireEvent.click(editTrigger)
    const albumInput = screen.getByPlaceholderText('Album title')
    const clientInput = screen.getByPlaceholderText('Client name')
    expect(albumInput).toHaveValue('Wedding Album')
    expect(clientInput).toHaveValue('Alice & Bob')

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'New Wedding Album', clientName: 'Charlie & Dave' }),
    } as never)

    fireEvent.change(albumInput, { target: { value: 'New Wedding Album' } })
    fireEvent.change(clientInput, { target: { value: 'Charlie & Dave' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/albums/cmrbj8px100018ltoanzqoqyz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Wedding Album', clientName: 'Charlie & Dave' }),
      })
      expect(screen.getByText('New Wedding Album')).toBeTruthy()
      expect(screen.getByText('Charlie & Dave')).toBeTruthy()
    })
  })

  it('renders CLIENT SUBMITTED badge and Unlock Client Selection button when selectionLocked is true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    global.fetch = fetchMock

    render(
      <PhotographerGallery
        albumId="alb_123"
        albumName="Wedding Album"
        clientName="John Doe"
        shareToken="tok_abc"
        initialPhotos={[{ ...basePhoto, id: 'p1', clientLikers: ['John Doe'] }]}
        selectionLocked={true}
      />
    )

    expect(screen.getByText(/CLIENT SUBMITTED/i)).toBeInTheDocument()
    const unlockBtn = screen.getByRole('button', { name: /unlock client selection/i })
    await act(async () => {
      fireEvent.click(unlockBtn)
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb_123/unlock-selection', expect.any(Object))
  })
})
