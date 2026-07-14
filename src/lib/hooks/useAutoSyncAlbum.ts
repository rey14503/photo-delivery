'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface SyncResult {
  synced: boolean
  addedCount?: number
  deletedCount?: number
  totalPhotos?: number
  error?: string
}

export interface UseAutoSyncAlbumOptions {
  albumId?: string
  enabled?: boolean
  intervalMs?: number
  onSyncSuccess?: (result: SyncResult) => void
}

export function useAutoSyncAlbum({
  albumId,
  enabled = true,
  intervalMs = 60000,
  onSyncSuccess,
}: UseAutoSyncAlbumOptions) {
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSyncingRef = useRef(false)

  const syncNow = useCallback(async () => {
    if (!albumId || isSyncingRef.current) return

    isSyncingRef.current = true
    setSyncing(true)
    setError(null)

    try {
      const res = await fetch(`/api/albums/${albumId}/sync`, {
        method: 'POST',
      })
      const data: SyncResult = await res.json()

      if (res.ok && data.synced) {
        setLastSyncedAt(new Date())
        if (onSyncSuccess) {
          onSyncSuccess(data)
        }
      } else {
        const msg = data.error || 'Sync failed'
        setError(msg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error during sync'
      setError(msg)
    } finally {
      setSyncing(false)
      isSyncingRef.current = false
    }
  }, [albumId, onSyncSuccess])

  // Initial sync on mount & periodic sync
  useEffect(() => {
    if (!enabled || !albumId) return

    syncNow()

    const interval = setInterval(() => {
      syncNow()
    }, intervalMs)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncNow()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [albumId, enabled, intervalMs, syncNow])

  return {
    syncNow,
    syncing,
    lastSyncedAt,
    error,
  }
}
