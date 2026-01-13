/**
 * useFlightPlans Hook - Flight plans data fetching and management
 * 
 * TASK-070: Flight plans data fetching hook
 * TASK-073: Uses 5-second polling for processing status updates
 * TASK-074: Provides optimistic update functions for immediate UI feedback
 * 
 * Features:
 * - Fetches /api/flightPlans for authenticated user
 * - 5-second polling for real-time status updates
 * - Optimistic updates for immediate UI feedback
 * - CRUD operations (create, update, delete)
 * - Type-safe API responses
 */

import { useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { usePolling } from './usePolling'

// Auth token key (same as useAuth)
const AUTH_TOKEN_KEY = 'authToken'

/**
 * Flight plan status types
 */
export type FlightPlanStatus = 'sin procesar' | 'en cola' | 'procesando' | 'procesado' | 'error'
export type AuthorizationStatus = 'sin autorización' | 'pendiente' | 'aprobado' | 'denegado'

/**
 * Flight plan folder reference
 */
export interface FlightPlanFolder {
  id: number
  name: string
  userId: number
  minScheduledAt: string | null
  maxScheduledAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Flight plan data structure
 */
export interface FlightPlan {
  id: number
  customName: string
  status: FlightPlanStatus
  fileContent: string
  userId: number
  folderId: number | null
  folder?: FlightPlanFolder | null
  uplan: string | null
  scheduledAt: string | null
  csvResult: number | null
  machineAssignedId: number | null
  externalResponseNumber: number | null
  authorizationStatus: AuthorizationStatus | null
  authorizationMessage: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Flight plan update data
 */
export interface FlightPlanUpdateData {
  customName?: string
  status?: FlightPlanStatus
  fileContent?: string
  folderId?: number | null
  uplan?: unknown
  scheduledAt?: string | null
  authorizationStatus?: AuthorizationStatus | null
  authorizationMessage?: string | null
  csvResult?: number | null
  machineAssignedId?: number | null
}

/**
 * Flight plan create data
 */
export interface FlightPlanCreateData {
  customName: string
  status: FlightPlanStatus
  fileContent: string
  folderId?: number | null
  uplan?: unknown
  scheduledAt?: string | null
}

interface UseFlightPlansOptions {
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number
  /** Whether polling is enabled (default: true) */
  pollingEnabled?: boolean
}

interface UseFlightPlansReturn {
  /** Array of flight plans */
  flightPlans: FlightPlan[]
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
  /** Create a new flight plan */
  createFlightPlan: (data: FlightPlanCreateData) => Promise<FlightPlan | null>
  /** Create multiple flight plans */
  createFlightPlans: (items: FlightPlanCreateData[]) => Promise<{ createdCount: number; items: FlightPlan[] } | null>
  /** Update a flight plan (with optimistic update) */
  updateFlightPlan: (id: number, data: FlightPlanUpdateData) => Promise<FlightPlan | null>
  /** Update multiple flight plans */
  updateFlightPlans: (ids: number[], data: FlightPlanUpdateData) => Promise<{ count: number } | null>
  /** Delete a flight plan (with optimistic update) */
  deleteFlightPlan: (id: number) => Promise<boolean>
  /** Delete multiple flight plans */
  deleteFlightPlans: (ids: number[]) => Promise<{ deletedPlans: number; deletedCsvs: number } | null>
  /** Optimistically update a flight plan in local state */
  optimisticUpdate: (id: number, data: Partial<FlightPlan>) => void
  /** Optimistically remove a flight plan from local state */
  optimisticRemove: (id: number) => void
  /** Get flight plans by folder */
  getByFolder: (folderId: number | null) => FlightPlan[]
  /** Get flight plans by status */
  getByStatus: (status: FlightPlanStatus) => FlightPlan[]
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
 * Fetch all flight plans from the API
 */
async function fetchFlightPlans(): Promise<FlightPlan[]> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await axios.get<FlightPlan[]>('/api/flightPlans', {
    headers: getAuthHeaders(),
  })

  return response.data
}

/**
 * Hook for managing flight plans data with polling and optimistic updates
 * 
 * @param options - Configuration options
 * @returns Flight plans state and operations
 * 
 * @example
 * ```tsx
 * const { flightPlans, loading, updateFlightPlan } = useFlightPlans({
 *   pollingInterval: 5000,
 *   pollingEnabled: true,
 * })
 * ```
 */
export function useFlightPlans(options: UseFlightPlansOptions = {}): UseFlightPlansReturn {
  const {
    pollingInterval = 5000,
    pollingEnabled = true,
  } = options

  // Local state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<Map<number, Partial<FlightPlan>>>(new Map())
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())

  // Use polling hook for data fetching
  const {
    data: serverData,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
  } = usePolling<FlightPlan[]>(fetchFlightPlans, {
    interval: pollingInterval,
    enabled: pollingEnabled,
  })

  // Merge server data with optimistic updates
  const flightPlans = useMemo(() => {
    if (!serverData) return []

    return serverData
      .filter(plan => !removedIds.has(plan.id))
      .map(plan => {
        const optimistic = optimisticState.get(plan.id)
        return optimistic ? { ...plan, ...optimistic } : plan
      })
  }, [serverData, optimisticState, removedIds])

  /**
   * Optimistically update a flight plan in local state
   */
  const optimisticUpdate = useCallback((id: number, data: Partial<FlightPlan>) => {
    setOptimisticState(prev => {
      const next = new Map(prev)
      const existing = next.get(id) || {}
      next.set(id, { ...existing, ...data })
      return next
    })
  }, [])

  /**
   * Optimistically remove a flight plan from local state
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
   * Create a new flight plan
   */
  const createFlightPlan = useCallback(async (data: FlightPlanCreateData): Promise<FlightPlan | null> => {
    try {
      const response = await axios.post<FlightPlan>('/api/flightPlans', data, {
        headers: getAuthHeaders(),
      })
      // Refresh to get the new plan in the list
      await refresh()
      return response.data
    } catch (err) {
      console.error('Error creating flight plan:', err)
      return null
    }
  }, [refresh])

  /**
   * Create multiple flight plans
   */
  const createFlightPlans = useCallback(async (
    items: FlightPlanCreateData[]
  ): Promise<{ createdCount: number; items: FlightPlan[] } | null> => {
    try {
      const response = await axios.post<{ createdCount: number; items: FlightPlan[] }>(
        '/api/flightPlans',
        { items },
        { headers: getAuthHeaders() }
      )
      // Refresh to get the new plans in the list
      await refresh()
      return response.data
    } catch (err) {
      console.error('Error creating flight plans:', err)
      return null
    }
  }, [refresh])

  /**
   * Update a flight plan with optimistic update
   */
  const updateFlightPlan = useCallback(async (
    id: number,
    data: FlightPlanUpdateData
  ): Promise<FlightPlan | null> => {
    // Apply optimistic update immediately
    optimisticUpdate(id, data as Partial<FlightPlan>)

    try {
      const response = await axios.put<FlightPlan>('/api/flightPlans', {
        id,
        data,
      }, {
        headers: getAuthHeaders(),
      })

      // Clear optimistic state after successful update
      clearOptimistic(id)
      // Refresh to sync with server
      await refresh()
      
      return response.data
    } catch (err) {
      console.error('Error updating flight plan:', err)
      // Revert optimistic update on error
      clearOptimistic(id)
      await refresh()
      return null
    }
  }, [optimisticUpdate, clearOptimistic, refresh])

  /**
   * Update multiple flight plans with the same data
   */
  const updateFlightPlans = useCallback(async (
    ids: number[],
    data: FlightPlanUpdateData
  ): Promise<{ count: number } | null> => {
    // Apply optimistic updates
    ids.forEach(id => optimisticUpdate(id, data as Partial<FlightPlan>))

    try {
      const response = await axios.put<{ count: number }>('/api/flightPlans', {
        ids,
        data,
      }, {
        headers: getAuthHeaders(),
      })

      // Clear optimistic states
      ids.forEach(id => clearOptimistic(id))
      // Refresh to sync with server
      await refresh()

      return response.data
    } catch (err) {
      console.error('Error updating flight plans:', err)
      // Revert optimistic updates on error
      ids.forEach(id => clearOptimistic(id))
      await refresh()
      return null
    }
  }, [optimisticUpdate, clearOptimistic, refresh])

  /**
   * Delete a flight plan with optimistic update
   */
  const deleteFlightPlan = useCallback(async (id: number): Promise<boolean> => {
    // Apply optimistic removal immediately
    optimisticRemove(id)

    try {
      await axios.delete('/api/flightPlans', {
        data: { id },
        headers: getAuthHeaders(),
      })

      // Clear optimistic state after successful delete
      clearOptimistic(id)
      // Refresh to sync with server
      await refresh()

      return true
    } catch (err) {
      console.error('Error deleting flight plan:', err)
      // Revert optimistic removal on error
      clearOptimistic(id)
      await refresh()
      return false
    }
  }, [optimisticRemove, clearOptimistic, refresh])

  /**
   * Delete multiple flight plans
   */
  const deleteFlightPlans = useCallback(async (
    ids: number[]
  ): Promise<{ deletedPlans: number; deletedCsvs: number } | null> => {
    // Apply optimistic removals
    ids.forEach(id => optimisticRemove(id))

    try {
      const response = await axios.delete<{
        deletedPlans: number
        deletedCsvs: number
        totalDeleted: number
        message: string
      }>('/api/flightPlans', {
        data: { ids },
        headers: getAuthHeaders(),
      })

      // Clear optimistic states
      ids.forEach(id => clearOptimistic(id))
      // Refresh to sync with server
      await refresh()

      return {
        deletedPlans: response.data.deletedPlans,
        deletedCsvs: response.data.deletedCsvs,
      }
    } catch (err) {
      console.error('Error deleting flight plans:', err)
      // Revert optimistic removals on error
      ids.forEach(id => clearOptimistic(id))
      await refresh()
      return null
    }
  }, [optimisticRemove, clearOptimistic, refresh])

  /**
   * Get flight plans by folder ID
   */
  const getByFolder = useCallback((folderId: number | null): FlightPlan[] => {
    return flightPlans.filter(plan => plan.folderId === folderId)
  }, [flightPlans])

  /**
   * Get flight plans by status
   */
  const getByStatus = useCallback((status: FlightPlanStatus): FlightPlan[] => {
    return flightPlans.filter(plan => plan.status === status)
  }, [flightPlans])

  return {
    flightPlans,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
    createFlightPlan,
    createFlightPlans,
    updateFlightPlan,
    updateFlightPlans,
    deleteFlightPlan,
    deleteFlightPlans,
    optimisticUpdate,
    optimisticRemove,
    getByFolder,
    getByStatus,
  }
}

export default useFlightPlans
