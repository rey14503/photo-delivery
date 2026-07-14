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
        studioName: 'Chủ Studio (PRO)',
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
    render(<UserAccountMenu userName="Khoa Nguyễn" userEmail="khoa@example.com" studioName="Chủ Studio (PRO)" />)

    const toggleBtn = screen.getByRole('button', { name: /open user menu/i })
    expect(toggleBtn).toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(screen.getByText('Chủ Studio (PRO)')).toBeInTheDocument()
    expect(screen.getByText('Chỉnh sửa thông tin / Quản lý Studio')).toBeInTheDocument()
  })

  it('opens EditProfileModal when clicking edit profile option', () => {
    render(<UserAccountMenu userName="Khoa Nguyễn" userEmail="khoa@example.com" studioName="Chủ Studio (PRO)" />)

    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByText('Chỉnh sửa thông tin / Quản lý Studio'))

    expect(screen.getByText('Chỉnh sửa thông tin cá nhân')).toBeInTheDocument()
    expect(screen.getByLabelText(/họ và tên/i)).toHaveValue('Khoa Nguyễn')
    expect(screen.getByLabelText(/tên studio \/ danh xưng/i)).toHaveValue('Chủ Studio (PRO)')
  })
})
