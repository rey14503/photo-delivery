import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientGallery } from '@/components/ClientGallery'

const photos = [
  { id: 'p1', thumbnailUrl: 'https://blob/p1-thumb.jpg', previewUrl: 'https://blob/p1-preview.jpg', version: 1 },
  { id: 'p2', thumbnailUrl: 'https://blob/p2-thumb.jpg', previewUrl: 'https://blob/p2-preview.jpg', version: 2 },
  { id: 'p3', thumbnailUrl: 'https://blob/p3-thumb.jpg', previewUrl: 'https://blob/p3-preview.jpg', version: 1 },
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

    let dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/p2-preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
