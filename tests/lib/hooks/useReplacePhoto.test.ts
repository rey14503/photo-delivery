import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { useReplacePhoto } from '@/lib/hooks/useReplacePhoto'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

function fakeChangeEvent(files: File[]) {
  return { target: { files } } as unknown as ChangeEvent<HTMLInputElement>
}

describe('useReplacePhoto', () => {
  it('uploads the selected file and refreshes on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as never)
    const { result } = renderHook(() => useReplacePhoto('photo_1'))
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    await act(async () => {
      await result.current.handleFileChange(fakeChangeEvent([file]))
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/photos/photo_1/replace',
      expect.objectContaining({ method: 'POST' })
    )
    expect(refreshMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('does nothing when no file is selected', async () => {
    const { result } = renderHook(() => useReplacePhoto('photo_1'))

    await act(async () => {
      await result.current.handleFileChange(fakeChangeEvent([]))
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sets an error message and does not refresh when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File too large' }),
    } as never)
    const { result } = renderHook(() => useReplacePhoto('photo_1'))
    const file = new File(['bytes'], 'new.jpg', { type: 'image/jpeg' })

    await act(async () => {
      await result.current.handleFileChange(fakeChangeEvent([file]))
    })

    expect(result.current.error).toBe('File too large')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('does not throw when triggerFileSelect is called before the input is mounted', () => {
    const { result } = renderHook(() => useReplacePhoto('photo_1'))

    expect(() => result.current.triggerFileSelect()).not.toThrow()
  })
})
