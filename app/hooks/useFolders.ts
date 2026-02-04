/**
 * useFolders Hook - Folders data fetching and management
 * 
 * TASK-071: Folders data fetching hook
 * 
 * Features:
 * - Fetches /api/folders for authenticated user
 * - CRUD operations (create, update, delete)
 * - Uses useAuth for authentication token
 * - Type-safe API responses
 * - Optimistic updates for immediate UI feedback
 */

import { useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { usePolling } from './usePolling'
import type { FlightPlan } from './useFlightPlans'

// Auth token key (same as useAuth)
const AUTH_TOKEN_KEY = 'authToken'

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
}

interface UseFoldersReturn {
  /** Array of folders */
  folders: Folder[]
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
  /** Delete a folder (with optimistic update) */
  deleteFolder: (id: number) => Promise<boolean>
  /** Get a folder by ID */
  getFolder: (id: number) => Folder | undefined
  /** Optimistically update a folder in local state */
  optimisticUpdate: (id: number, data: Partial<Folder>) => void
  /** Optimistically remove a folder from local state */
  optimisticRemove: (id: number) => void
}

/**
 * Get the auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

/**
 * Create axios headers with auth token
 */
function getAuthHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Fetch all folders from the API
 */
async function fetchFolders(): Promise<Folder[]> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await axios.get<Folder[]>('/api/folders', {
    headers: getAuthHeaders(),
  })

  return response.data
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
export function useFolders(options: UseFoldersOptions = {}): UseFoldersReturn {
  const {
    pollingInterval = 0,
    pollingEnabled = false,
  } = options

  // Local state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<Map<number, Partial<Folder>>>(new Map())
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())

  // Use polling hook for data fetching (polling disabled by default for folders)
  const {
    data: serverData,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
  } = usePolling<Folder[]>(fetchFolders, {
    interval: pollingInterval,
    enabled: pollingEnabled,
  })

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
  const optimisticUpdate = useCallback((id: number, data: Partial<Folder>) => {
    setOptimisticState(prev => {
      const next = new Map(prev)
      const existing = next.get(id) || {}
      next.set(id, { ...existing, ...data })
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
      const response = await axios.post<Folder>('/api/folders', data, {
        headers: getAuthHeaders(),
      })
      // Refresh to get the new folder in the list
      await refresh()
      return response.data
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
      const response = await axios.put<Folder>(`/api/folders/${id}`, data, {
        headers: getAuthHeaders(),
      })

      // Clear optimistic state after successful update
      clearOptimistic(id)
      // Refresh to sync with server
      await refresh()

      return response.data
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
  const deleteFolder = useCallback(async (id: number): Promise<boolean> => {
    // Apply optimistic removal immediately
    optimisticRemove(id)

    try {
      await axios.delete(`/api/folders/${id}`, {
        headers: getAuthHeaders(),
      })

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
   * Get a folder by ID
   */
  const getFolder = useCallback((id: number): Folder | undefined => {
    return folders.find(folder => folder.id === id)
  }, [folders])

  return {
    folders,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolder,
    optimisticUpdate,
    optimisticRemove,
  }
}

export default useFolders
