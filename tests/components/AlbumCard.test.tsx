import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AlbumCard } from '@/components/AlbumCard'

describe('AlbumCard', () => {
  const sampleAlbum = {
    id: 'alb_1',
    name: 'Tiệc Cưới Jane & John',
    clientName: 'Jane Doe',
    shareToken: 'tok_abc123',
    hasPassword: true,
    photoCount: 45,
    createdAt: new Date('2026-07-01T10:00:00Z'),
  }

  it('renders album name, client, photo count, lock status, and formatted date', () => {
    render(<AlbumCard album={sampleAlbum} />)

    expect(screen.getByText('Tiệc Cưới Jane & John')).toBeInTheDocument()
    expect(screen.getByText('Khách hàng: Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('45 ảnh')).toBeInTheDocument()
    expect(screen.getByText('🔒 Có mật khẩu')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /xem album/i })).toHaveAttribute('href', '/albums/alb_1')
  })

  it('renders unlocked badge when hasPassword is false', () => {
    render(<AlbumCard album={{ ...sampleAlbum, hasPassword: false }} />)

    expect(screen.getByText('🔓 Mở')).toBeInTheDocument()
  })

  it('copies share link to clipboard when Copy link button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } })

    render(<AlbumCard album={sampleAlbum} />)
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /đã copy!/i })).toBeInTheDocument())
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/a/tok_abc123'))
  })
})
