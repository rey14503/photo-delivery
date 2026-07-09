import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateAlbumModal } from '@/components/CreateAlbumModal'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('CreateAlbumModal', () => {
  it('does not render anything when isOpen is false', () => {
    render(<CreateAlbumModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders modal content and form when isOpen is true', () => {
    render(<CreateAlbumModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Tạo album')).toBeInTheDocument()
    expect(screen.getByLabelText('Album name')).toBeInTheDocument()
  })

  it('calls onClose when close button or backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<CreateAlbumModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /đóng/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
