import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSyncAlbum } from '@/lib/hooks/useAutoSyncAlbum'

describe('useAutoSyncAlbum Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('automatically triggers POST /api/albums/[albumId]/sync on mount and returns sync results', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        synced: true,
        addedCount: 2,
        deletedCount: 0,
        totalPhotos: 10,
      }),
    } as any))

    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      useAutoSyncAlbum({ albumId: 'alb_1', enabled: true, onSyncSuccess: onSuccess })
    )

    // Wait for async syncNow triggered on mount
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/albums/alb_1/sync', { method: 'POST' })
    expect(onSuccess).toHaveBeenCalledWith({
      synced: true,
      addedCount: 2,
      deletedCount: 0,
      totalPhotos: 10,
    })
    expect(result.current.lastSyncedAt).not.toBeNull()
    expect(result.current.error).toBeNull()

    fetchMock.mockRestore()
  })

  it('allows manual trigger via syncNow', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        synced: true,
        addedCount: 0,
        deletedCount: 1,
        totalPhotos: 9,
      }),
    } as any))

    const { result } = renderHook(() =>
      useAutoSyncAlbum({ albumId: 'alb_1', enabled: false })
    )

    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.syncNow()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.lastSyncedAt).not.toBeNull()

    fetchMock.mockRestore()
  })
})
