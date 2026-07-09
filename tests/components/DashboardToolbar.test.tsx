import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardToolbar } from '@/components/DashboardToolbar'

describe('DashboardToolbar', () => {
  it('renders dashboard title and correct metric counters', () => {
    render(<DashboardToolbar albumCount={5} photoCount={128} />)

    expect(screen.getByText('Bảng điều khiển')).toBeInTheDocument()
    expect(screen.getByText('Tổng số album: 5')).toBeInTheDocument()
    expect(screen.getByText('Tổng số ảnh: 128')).toBeInTheDocument()
  })
})
