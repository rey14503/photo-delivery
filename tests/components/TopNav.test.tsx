import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopNav } from '@/components/TopNav'

const signOutMock = vi.fn()

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

describe('TopNav', () => {
  it('renders logo, title, user name, and sign out button calling signOut', () => {
    const onCreate = vi.fn()
    render(<TopNav userName="Khoa Nguyen" userEmail="khoa@example.com" onCreateClick={onCreate} />)

    expect(screen.getByAltText('Product Logo')).toHaveAttribute('src', '/logo.png')
    expect(screen.getByText('Photo Delivery')).toBeInTheDocument()
    expect(screen.getByText('Khoa Nguyen')).toBeInTheDocument()

    const signOutBtn = screen.getByRole('button', { name: /đăng xuất/i })
    fireEvent.click(signOutBtn)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/login' })
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
