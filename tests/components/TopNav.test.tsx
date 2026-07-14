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

    expect(screen.getByAltText('BK Media Box Logo')).toHaveAttribute('src', '/logo.png')
    expect(screen.getByText(/BK/)).toBeInTheDocument()
    expect(screen.getByText(/Media Box/)).toBeInTheDocument()
    expect(screen.getByText('Khoa Nguyen')).toBeInTheDocument()

    const triggerBtn = screen.getByRole('button', { name: /open user menu/i })
    fireEvent.click(triggerBtn)

    const signOutBtn = screen.getByText(/Đăng xuất/i)
    fireEvent.click(signOutBtn)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('calls onCreateClick when primary "+ Create album" CTA is clicked if handler provided', () => {
    const onCreate = vi.fn()
    render(<TopNav userName="Khoa" onCreateClick={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: /\+ create album/i }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('renders link to /albums/new if onCreateClick handler is not provided', () => {
    render(<TopNav userName="Khoa" />)

    expect(screen.getByRole('link', { name: /\+ create album/i })).toHaveAttribute('href', '/albums/new')
  })
})
