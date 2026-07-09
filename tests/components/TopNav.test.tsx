import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopNav } from '@/components/TopNav'

describe('TopNav', () => {
  it('renders logo, title, user name, and sign out link', () => {
    const onCreate = vi.fn()
    render(<TopNav userName="Khoa Nguyen" userEmail="khoa@example.com" onCreateClick={onCreate} />)

    expect(screen.getByAltText('Product Logo')).toHaveAttribute('src', '/logo.png')
    expect(screen.getByText('Photo Delivery')).toBeInTheDocument()
    expect(screen.getByText('Khoa Nguyen')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /đăng xuất/i })).toHaveAttribute('href', '/api/auth/signout')
  })

  it('calls onCreateClick when primary "+ Tạo album" CTA is clicked if handler provided', () => {
    const onCreate = vi.fn()
    render(<TopNav userName="Khoa" onCreateClick={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: /\+ tạo album/i }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('renders link to /albums/new if onCreateClick handler is not provided', () => {
    render(<TopNav userName="Khoa" />)

    expect(screen.getByRole('link', { name: /\+ tạo album/i })).toHaveAttribute('href', '/albums/new')
  })
})
