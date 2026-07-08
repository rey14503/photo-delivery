import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientGallery } from '@/components/ClientGallery'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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

describe('ClientGallery', () => {
  it('renders a thumbnail for every photo and no lightbox initially', () => {
    render(<ClientGallery photos={photos} />)

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the lightbox showing the preview image when a thumbnail is clicked', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    const dialog = screen.getByRole('dialog')
    const dialogImage = dialog.querySelector('img')
    expect(dialogImage?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')
  })

  it('navigates to the next photo and closes the lightbox', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[0])
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the suggested-by-photographer badge and existing comments for the open photo', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(screen.getByText(/suggested by photographer/i)).toBeTruthy()
    expect(screen.getByText(/Lovely/)).toBeTruthy()
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
  })

  it('does not show the suggested badge for a photo with no photographer like', () => {
    render(<ClientGallery photos={photos} />)

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(screen.queryByText(/suggested by photographer/i)).toBeNull()
  })
})
