/**
 * useFolders Hook - Folders data fetching and management
 * 
 * TASK-071: Folders data fetching hook
 * 
 * Features:
 * - Fetches /api/folders for authenticated user
 * - CRUD operations (create, update, delete) plus clone and process-folder
 * - `summary: true` -> GET /api/folders?fields=summary: folder.flightPlans is only [{ id }]
 *   (the full plan rows come from useFlightPlans)
 * - `counts: true` -> GET /api/folders?fields=counts: no plan rows, `planCount` per folder plus
 *   `noFolderCount` (production list: the plans come page by page from useFolderPlans)
 * - Uses useAuth for authentication token
 * - Type-safe API responses
 * - Optimistic updates for immediate UI feedback
 */

import { useState, useCallback, useMemo } from 'react'
import { apiJson, getAuthToken } from '@/lib/api-client'
import { usePolling } from './usePolling'
import type { FlightPlan } from './useFlightPlans'

/** Folder row of ?fields=summary: plans reduced to their ids. */
export type FolderSummary = Omit<Folder, 'flightPlans'> & { flightPlans: { id: number }[] }
/** Folder without any plan data: what the folder actions need (FolderSummary and FolderCounts are both one). */
export type FolderRef = Omit<Folder, 'flightPlans'>
/** Folder row of ?fields=counts: how many plans it holds, no plan rows. */
export type FolderCounts = FolderRef & { planCount: number }

/**
 * Folder data structure
 */
export interface Folder {
  id: number
  name: string
  userId: number
  minScheduledAt: string | null
  maxScheduledAt: string | null
  flightPlans: FlightPlan[]
  createdAt: string
  updatedAt: string
}

/**
 * Folder create data
 */
export interface FolderCreateData {
  name: string
  minScheduledAt?: string | null
  maxScheduledAt?: string | null
}

/**
 * Folder update data
 */
export interface FolderUpdateData {
  name?: string
  minScheduledAt?: string | null
  maxScheduledAt?: string | null
}

interface UseFoldersOptions {
  /** Polling interval in milliseconds (default: 0 = disabled) */
  pollingInterval?: number
  /** Whether polling is enabled (default: false) */
  pollingEnabled?: boolean
  /** Fetch ?fields=summary: rows are FolderSummary (default: false) */
  summary?: boolean
  /** Fetch ?fields=counts: rows are FolderCounts and `noFolderCount` is filled (default: false) */
  counts?: boolean
}

export interface UseFoldersReturn<TFolder = Folder> {
  /** Array of folders */
  folders: TFolder[]
  /** Plans without folder (only with `counts: true`, else 0) */
  noFolderCount: number
  /** Loading state for initial fetch */
  loading: boolean
  /** Error from the last fetch attempt */
  error: Error | null
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
  /** Whether polling is currently active */
  isPolling: boolean
  /** Start polling */
  startPolling: () => void
  /** Stop polling */
  stopPolling: () => void
  /** Create a new folder */
  createFolder: (data: FolderCreateData) => Promise<Folder | null>
  /** Update a folder (with optimistic update) */
  updateFolder: (id: number, data: FolderUpdateData) => Promise<Folder | null>
  /**
   * Delete a folder (with optimistic update). DELETE /api/folders/[id]. With `planIds` (Dev recipe)
   * the plans are deleted first with DELETE /api/flightPlans { ids } (that route cancels approved
   * plans at FAS). The caller refreshes useFlightPlans afterwards.
   */
  deleteFolder: (id: number, planIds?: number[]) => Promise<boolean>
  /** POST /api/folders/[id]/clone: copies the folder and its plans. Returns null on failure. */
  cloneFolder: (id: number) => Promise<{ folder: Folder; flightPlans: FlightPlan[] } | null>
  /**
   * PUT /api/flightPlans { ids, data: { status: 'en cola' } } for the folder's plans
   * (`planIds`, or the ids the loaded folder carries). Returns the updated count, null on failure.
   * The caller refreshes useFlightPlans afterwards.
   */
  processFolder: (id: number, planIds?: number[]) => Promise<{ count: number } | null>
  /** Get a folder by ID */
  getFolder: (id: number) => TFolder | undefined
  /** Optimistically update a folder in local state */
  optimisticUpdate(id: number, data: Partial<TFolder>): void
  /** Optimistically remove a folder from local state */
  optimisticRemove: (id: number) => void
}

type AnyFolder = Folder | FolderSummary | FolderCounts
interface FoldersPayload {
  folders: AnyFolder[]
  noFolderCount: number
}

/**
 * Fetch all folders from the API
 */
async function fetchFolders(mode: 'full' | 'summary' | 'counts'): Promise<FoldersPayload> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  if (mode === 'counts') return apiJson<FoldersPayload>('/api/folders?fields=counts')
  const folders = await apiJson<AnyFolder[]>(mode === 'summary' ? '/api/folders?fields=summary' : '/api/folders')
  return { folders, noFolderCount: 0 }
}

/**
 * Hook for managing folders data with CRUD operations
 * 
 * @param options - Configuration options
 * @returns Folders state and operations
 * 
 * @example
 * ```tsx
 * const { folders, loading, createFolder, updateFolder, deleteFolder } = useFolders()
 * 
 * // Create a new folder
 * await createFolder({ name: 'My Folder' })
 * 
 * // Rename a folder
 * await updateFolder(folderId, { name: 'New Name' })
 * 
 * // Delete a folder
 * await deleteFolder(folderId)
 * ```
 */
export function useFolders(options: UseFoldersOptions & { counts: true }): UseFoldersReturn<FolderCounts>
export function useFolders(options: UseFoldersOptions & { summary: true }): UseFoldersReturn<FolderSummary>
export function useFolders(options?: UseFoldersOptions): UseFoldersReturn<Folder>
export function useFolders(options: UseFoldersOptions = {}): UseFoldersReturn<AnyFolder> {
  const {
    pollingInterval = 0,
    pollingEnabled = false,
    summary = false,
    counts = false,
  } = options

  // Local state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<Map<number, Partial<Folder>>>(new Map())
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())

  // Use polling hook for data fetching (polling disabled by default for folders)
  const {
    data: payload,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
  } = usePolling<FoldersPayload>(() => fetchFolders(counts ? 'counts' : summary ? 'summary' : 'full'), {
    interval: pollingInterval,
    enabled: pollingEnabled,
  })

  const serverData = payload?.folders

  // Merge server data with optimistic updates
  const folders = useMemo(() => {
    if (!serverData) return []

    return serverData
      .filter(folder => !removedIds.has(folder.id))
      .map(folder => {
        const optimistic = optimisticState.get(folder.id)
        return optimistic ? { ...folder, ...optimistic } : folder
      })
  }, [serverData, optimisticState, removedIds])

  /**
   * Optimistically update a folder in local state
   */
  const optimisticUpdate = useCallback((id: number, data: Partial<AnyFolder>) => {
    setOptimisticState(prev => {
      const next = new Map(prev)
      const existing = next.get(id) || {}
      next.set(id, { ...existing, ...data } as Partial<Folder>)
      return next
    })
  }, [])

  /**
   * Optimistically remove a folder from local state
   */
  const optimisticRemove = useCallback((id: number) => {
    setRemovedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  /**
   * Clear optimistic state for an ID (after server confirms)
   */
  const clearOptimistic = useCallback((id: number) => {
    setOptimisticState(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setRemovedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  /**
   * Create a new folder
   */
  const createFolder = useCallback(async (data: FolderCreateData): Promise<Folder | null> => {
    try {
      const created = await apiJson<Folder>('/api/folders', { method: 'POST', body: data })
      // Refresh to get the new folder in the list
      await refresh()
      return created
    } catch (err) {
      console.error('Error creating folder:', err)
      return null
    }
  }, [refresh])

  /**
   * Update a folder with optimistic update
   */
  const updateFolder = useCallback(async (
    id: number,
    data: FolderUpdateData
  ): Promise<Folder | null> => {
    // Apply optimistic update immediately
    optimisticUpdate(id, data as Partial<Folder>)

    try {
      const updated = await apiJson<Folder>(`/api/folders/${id}`, { method: 'PUT', body: data })

      // Clear optimistic state after successful update
      clearOptimistic(id)
      // Refresh to sync with server
      await refresh()

      return updated
    } catch (err) {
      console.error('Error updating folder:', err)
      // Revert optimistic update on error
      clearOptimistic(id)
      await refresh()
      return null
    }
  }, [optimisticUpdate, clearOptimistic, refresh])

  /**
   * Delete a folder with optimistic update
   */
  const deleteFolder = useCallback(async (id: number, planIds?: number[]): Promise<boolean> => {
    // Apply optimistic removal immediately
    optimisticRemove(id)

    try {
      if (planIds && planIds.length > 0) {
        await apiJson('/api/flightPlans', { method: 'DELETE', body: { ids: planIds } })
      }
      await apiJson(`/api/folders/${id}`, { method: 'DELETE' })

      // Clear optimistic state after successful delete
      clearOptimistic(id)
      // Refresh to sync with server
      await refresh()

      return true
    } catch (err) {
      console.error('Error deleting folder:', err)
      // Revert optimistic removal on error
      clearOptimistic(id)
      await refresh()
      return false
    }
  }, [optimisticRemove, clearOptimistic, refresh])

  /**
   * Clone a folder with its plans
   */
  const cloneFolder = useCallback(async (id: number) => {
    try {
      const cloned = await apiJson<{ folder: Folder; flightPlans: FlightPlan[] }>(
        `/api/folders/${id}/clone`,
        { method: 'POST' }
      )
      await refresh()
      return cloned
    } catch (err) {
      console.error('Error cloning folder:', err)
      return null
    }
  }, [refresh])

  /**
   * Queue every plan of a folder for processing (one bulk PUT)
   */
  const processFolder = useCallback(async (id: number, planIds?: number[]) => {
    const found = serverData?.find(f => f.id === id)
    const ids = planIds ?? (found && 'flightPlans' in found ? found.flightPlans.map(p => p.id) : [])
    if (ids.length === 0) return { count: 0 }
    try {
      return await apiJson<{ count: number }>('/api/flightPlans', {
        method: 'PUT',
        body: { ids, data: { status: 'en cola' } },
      })
    } catch (err) {
      console.error('Error processing folder:', err)
      return null
    }
  }, [serverData])

  /**
   * Get a folder by ID
   */
  const getFolder = useCallback((id: number): AnyFolder | undefined => {
    return folders.find(folder => folder.id === id)
  }, [folders])

  return {
    folders,
    noFolderCount: payload?.noFolderCount ?? 0,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
    createFolder,
    updateFolder,
    deleteFolder,
    cloneFolder,
    processFolder,
    getFolder,
    optimisticUpdate,
    optimisticRemove,
  }
}

export default useFolders
