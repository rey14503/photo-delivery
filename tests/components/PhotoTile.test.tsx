import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoTile, type PhotoTileProps } from '@/components/PhotoTile'

function baseProps(overrides: Partial<PhotoTileProps> = {}): PhotoTileProps {
  return {
    thumbnailUrl: 'https://blob/thumb.jpg',
    version: 1,
    statusNote: undefined,
    liked: false,
    likeIcon: 'heart',
    likeLabel: 'Select this photo',
    onToggleLike: vi.fn(),
    toggling: false,
    showDownload: true,
    downloadHref: '/api/photos/photo_1/download',
    commentCount: 0,
    showReplace: false,
    onReplace: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  }
}

describe('PhotoTile', () => {
  it('renders the thumbnail and calls onOpen when clicked', () => {
    const props = baseProps()
    render(<PhotoTile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /open photo/i }))

    expect(props.onOpen).toHaveBeenCalledTimes(1)
  })

  it('shows the version badge only when version is greater than 1', () => {
    const { rerender } = render(<PhotoTile {...baseProps({ version: 1 })} />)
    expect(screen.queryByText('v1')).toBeNull()

    rerender(<PhotoTile {...baseProps({ version: 3 })} />)
    expect(screen.getByText('v3')).toBeTruthy()
  })

  it('renders the status note when provided, and nothing when omitted', () => {
    const { rerender } = render(<PhotoTile {...baseProps({ statusNote: undefined })} />)
    expect(screen.queryByText(/selected by/i)).toBeNull()

    rerender(<PhotoTile {...baseProps({ statusNote: '❤ Selected by: Jane Doe' })} />)
    expect(screen.getByText('❤ Selected by: Jane Doe')).toBeTruthy()
  })

  it('renders a heart glyph when likeIcon is "heart" and liked is true', () => {
    render(
      <PhotoTile {...baseProps({ likeIcon: 'heart', liked: true, likeLabel: 'Unselect this photo' })} />
    )

    expect(screen.getByRole('button', { name: 'Unselect this photo' }).textContent).toBe('♥')
  })

  it('renders a star glyph when likeIcon is "star" and liked is true', () => {
    render(
      <PhotoTile {...baseProps({ likeIcon: 'star', liked: true, likeLabel: 'Unsuggest to client' })} />
    )

    expect(screen.getByRole('button', { name: 'Unsuggest to client' }).textContent).toBe('⭐')
  })

  it('calls onToggleLike when the quick like icon is clicked', () => {
    const props = baseProps()
    render(<PhotoTile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select this photo' }))

    expect(props.onToggleLike).toHaveBeenCalledTimes(1)
  })

  it('opens the action menu and passes through showDownload/showReplace/commentCount', () => {
    render(
      <PhotoTile
        {...baseProps({
          showDownload: true,
          showReplace: true,
          commentCount: 5,
          downloadHref: '/api/photos/photo_7/download',
        })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: /view comments \(5\)/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /download/i })).toHaveAttribute(
      'href',
      '/api/photos/photo_7/download'
    )
    expect(screen.getByRole('menuitem', { name: /replace \/ update version/i })).toBeTruthy()
  })

  it('calls onOpen when "View comments" is chosen from the action menu', () => {
    const props = baseProps()
    render(<PhotoTile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view comments/i }))

    expect(props.onOpen).toHaveBeenCalledTimes(1)
  })

  it('shows the given photo name, falling back to a placeholder when omitted', () => {
    const { rerender } = render(<PhotoTile {...baseProps({ name: undefined })} />)
    expect(screen.getByText('Untitled photo')).toBeTruthy()

    rerender(<PhotoTile {...baseProps({ name: 'IMG_0001.jpg' })} />)
    expect(screen.getByText('IMG_0001.jpg')).toBeTruthy()
  })

  it('shows the photographer attribution only when provided', () => {
    const { rerender } = render(<PhotoTile {...baseProps({ photographerName: undefined })} />)
    expect(screen.queryByText(/^by /)).toBeNull()

    rerender(<PhotoTile {...baseProps({ photographerName: 'Jane Doe' })} />)
    expect(screen.getByText('by Jane Doe')).toBeTruthy()
  })
})
