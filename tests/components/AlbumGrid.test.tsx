import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlbumGrid } from '@/components/AlbumGrid'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('AlbumGrid', () => {
  const albums = [
    {
      id: 'alb_1',
      name: 'Album 1',
      clientName: 'Client 1',
      shareToken: 'tok_1',
      hasPassword: true,
      photoCount: 10,
      createdAt: new Date('2026-07-01'),
    },
  ]

  it('renders inline create album card as first item alongside album cards', () => {
    render(<AlbumGrid albums={albums} />)

    expect(screen.getByRole('button', { name: /tạo album mới trong danh sách/i })).toBeInTheDocument()
    expect(screen.getByText('Album 1')).toBeInTheDocument()
  })

  it('opens modal when inline create card or TopNav create button is clicked', () => {
    render(<AlbumGrid albums={albums} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /tạo album mới trong danh sách/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
