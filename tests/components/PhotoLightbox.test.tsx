import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PhotoLightbox, type PhotoLightboxProps } from '@/components/PhotoLightbox'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

function baseProps(overrides: Partial<PhotoLightboxProps> = {}): PhotoLightboxProps {
  return {
    photoId: 'photo_1',
    previewUrl: 'https://blob/preview.jpg',
    statusNote: undefined,
    liked: false,
    likeIcon: 'heart',
    likeLabel: 'Select this photo',
    onToggleLike: vi.fn(),
    toggling: false,
    showDownload: true,
    downloadHref: '/api/photos/photo_1/download',
    comments: [],
    showReplace: false,
    onReplace: vi.fn(),
    hasPrevious: false,
    hasNext: false,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('PhotoLightbox', () => {
  it('renders the preview image inside a dialog and calls onClose', () => {
    const props = baseProps()
    render(<PhotoLightbox {...props} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('https://blob/preview.jpg')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows Previous/Next only when hasPrevious/hasNext are true', () => {
    const { rerender } = render(
      <PhotoLightbox {...baseProps({ hasPrevious: false, hasNext: false })} />
    )
    expect(screen.queryByRole('button', { name: /previous/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull()

    rerender(<PhotoLightbox {...baseProps({ hasPrevious: true, hasNext: true })} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /next/i })).toBeTruthy()
  })

  it('calls onPrevious and onNext when clicked', () => {
    const props = baseProps({ hasPrevious: true, hasNext: true })
    render(<PhotoLightbox {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(props.onPrevious).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('renders the status note when provided', () => {
    render(<PhotoLightbox {...baseProps({ statusNote: '⭐ Suggested by photographer' })} />)

    expect(screen.getByText('⭐ Suggested by photographer')).toBeTruthy()
  })

  it('calls onToggleLike when the quick like icon is clicked', () => {
    const props = baseProps()
    render(<PhotoLightbox {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select this photo' }))

    expect(props.onToggleLike).toHaveBeenCalledTimes(1)
  })

  it('renders the download link only when showDownload is true', () => {
    const { rerender } = render(<PhotoLightbox {...baseProps({ showDownload: false })} />)
    expect(screen.queryByRole('link', { name: /^download$/i })).toBeNull()

    rerender(
      <PhotoLightbox
        {...baseProps({ showDownload: true, downloadHref: '/api/photos/photo_5/download' })}
      />
    )
    expect(screen.getByRole('link', { name: /^download$/i })).toHaveAttribute(
      'href',
      '/api/photos/photo_5/download'
    )
  })

  it('toggles the comment panel open and closed via the comment icon, showing existing comments', () => {
    render(
      <PhotoLightbox
        {...baseProps({ comments: [{ id: 'c1', text: 'Lovely', authorLabel: 'Jane Doe' }] })}
      />
    )

    expect(screen.queryByRole('complementary', { name: /comments/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /comments \(1\)/i }))
    expect(screen.getByRole('complementary', { name: /comments/i })).toBeTruthy()
    expect(screen.getByText(/Lovely/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /comments \(1\)/i }))
    expect(screen.queryByRole('complementary', { name: /comments/i })).toBeNull()
  })

  it('opens the comment panel when "View comments" is chosen from the action menu', () => {
    render(<PhotoLightbox {...baseProps({ comments: [] })} />)

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view comments/i }))

    expect(screen.getByRole('complementary', { name: /comments/i })).toBeTruthy()
  })

  it('shows Replace / update version in the action menu only when showReplace is true, and calls onReplace', () => {
    const props = baseProps({ showReplace: true })
    render(<PhotoLightbox {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /replace \/ update version/i }))

    expect(props.onReplace).toHaveBeenCalledTimes(1)
  })
})
