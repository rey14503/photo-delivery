import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserAccountMenu } from '@/components/UserAccountMenu'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
  useSession: () => ({
    data: {
      user: {
        id: 'user_1',
        name: 'Khoa Nguyễn',
        email: 'khoa@example.com',
        avatarUrl: null,
        studioName: 'PRO Studio',
      },
    },
    update: vi.fn(),
  }),
}))

describe('UserAccountMenu Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders user button and opens popover menu on click', () => {
    render(<UserAccountMenu userName="Khoa Nguyễn" userEmail="khoa@example.com" studioName="PRO Studio" />)

    const toggleBtn = screen.getByRole('button', { name: /open user menu/i })
    expect(toggleBtn).toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(screen.getByText('Photographer')).toBeInTheDocument()
    expect(screen.getByText('PRO Studio')).toBeInTheDocument()
    expect(screen.getByText('Edit Profile / Studio')).toBeInTheDocument()
  })

  it('opens EditProfileModal when clicking edit profile option', () => {
    render(<UserAccountMenu userName="Khoa Nguyễn" userEmail="khoa@example.com" studioName="PRO Studio" />)

    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByText('Edit Profile / Studio'))

    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Khoa Nguyễn')
    expect(screen.getByLabelText(/^Nickname$/i)).toHaveValue('PRO Studio')
  })
})
