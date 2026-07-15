import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardToolbar } from '@/components/DashboardToolbar'

describe('DashboardToolbar', () => {
  it('renders dashboard title and correct metric counters', () => {
    render(<DashboardToolbar albumCount={5} photoCount={128} />)

    expect(screen.getByText('Albums')).toBeInTheDocument()
    expect(screen.getByText('Total albums: 5')).toBeInTheDocument()
    expect(screen.getByText('Total photos: 128')).toBeInTheDocument()
  })
})
