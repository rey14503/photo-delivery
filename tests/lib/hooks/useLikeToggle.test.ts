import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLikeToggle } from '@/lib/hooks/useLikeToggle'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('useLikeToggle', () => {
  it('posts to the like endpoint and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ liked: true }),
    } as never)

    const { result } = renderHook(() => useLikeToggle('photo_1'))

    await act(async () => {
      await result.current.toggle()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/photos/photo_1/like', { method: 'POST' })
    expect(refreshMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('sets an error message and does not refresh when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    } as never)

    const { result } = renderHook(() => useLikeToggle('photo_1'))

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.error).toBe('Forbidden')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('sets a generic network error message when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useLikeToggle('photo_1'))

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.error).toBe('Network error \u2014 please try again.')
  })

  it('tracks submitting state across the toggle call', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }) as never
    )

    const { result } = renderHook(() => useLikeToggle('photo_1'))
    expect(result.current.submitting).toBe(false)

    let togglePromise!: Promise<void>
    act(() => {
      togglePromise = result.current.toggle()
    })
    expect(result.current.submitting).toBe(true)

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({}) })
      await togglePromise
    })
    expect(result.current.submitting).toBe(false)
  })
})
