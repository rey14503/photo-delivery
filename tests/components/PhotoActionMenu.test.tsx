import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoActionMenu, type PhotoActionMenuProps } from '@/components/PhotoActionMenu'

function baseProps(overrides: Partial<PhotoActionMenuProps> = {}): PhotoActionMenuProps {
  return {
    likeLabel: 'Select this photo',
    onToggleLike: vi.fn(),
    toggling: false,
    showDownload: true,
    downloadHref: '/api/photos/photo_1/download',
    commentCount: 2,
    onViewComments: vi.fn(),
    showReplace: false,
    onReplace: vi.fn(),
    ...overrides,
  }
}

describe('PhotoActionMenu', () => {
  it('is closed by default and opens the menu when the trigger is clicked', () => {
    render(<PhotoActionMenu {...baseProps()} />)

    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('shows the like label and view-comments count, hiding download/replace by default', () => {
    render(<PhotoActionMenu {...baseProps({ showDownload: false, showReplace: false })} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: 'Select this photo' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /view comments \(2\)/i })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /replace/i })).toBeNull()
  })

  it('shows Download when showDownload is true, with the given href', () => {
    render(
      <PhotoActionMenu
        {...baseProps({ showDownload: true, downloadHref: '/api/photos/photo_9/download' })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: /download/i })).toHaveAttribute(
      'href',
      '/api/photos/photo_9/download'
    )
  })

  it('shows Replace / update version only when showReplace is true', () => {
    render(<PhotoActionMenu {...baseProps({ showReplace: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: /replace \/ update version/i })).toBeTruthy()
  })

  it('calls onToggleLike and closes the menu when the like item is clicked', () => {
    const props = baseProps()
    render(<PhotoActionMenu {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Select this photo' }))

    expect(props.onToggleLike).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('calls onViewComments and closes the menu when the comments item is clicked', () => {
    const props = baseProps()
    render(<PhotoActionMenu {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view comments/i }))

    expect(props.onViewComments).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('calls onReplace and closes the menu when the replace item is clicked', () => {
    const props = baseProps({ showReplace: true })
    render(<PhotoActionMenu {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /replace \/ update version/i }))

    expect(props.onReplace).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes the menu when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <PhotoActionMenu {...baseProps()} />
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('disables the like menu item while toggling', () => {
    render(<PhotoActionMenu {...baseProps({ toggling: true })} />)
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }))

    expect(screen.getByRole('menuitem', { name: 'Select this photo' })).toBeDisabled()
  })
})
