import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NameGate } from '@/components/NameGate'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('NameGate', () => {
  it('submits the name and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as never)

    render(<NameGate />)
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Jane Doe' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/share/identify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Jane Doe' }),
      })
    )
  })

  it('shows an error message when the name is rejected', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A valid name is required' }),
    } as never)

    render(<NameGate />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A valid name is required')
  })
})
