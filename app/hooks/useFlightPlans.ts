/**
 * useFlightPlans Hook - Flight plans data fetching and management
 * 
 * TASK-070: Flight plans data fetching hook
 * TASK-073: Uses 5-second polling for processing status updates
 * TASK-074: Provides optimistic update functions for immediate UI feedback
 * 
 * Features:
 * - Fetches /api/flightPlans for authenticated user (`summary: true` -> ?fields=summary, no
 *   fileContent/uplan; use fetchPlanDetail(id) when a viewer/form needs them)
 * - Adaptive polling: 3 s while a plan is queued/processing/awaiting FAS, 15 s otherwise,
 *   paused while the tab is hidden (see usePolling). `pollingInterval` forces a fixed interval.
 * - Optimistic updates for immediate UI feedback
 * - CRUD + the single/bulk actions the plan-authorization UI needs (schedule, process, reset,
 *   reset authorization, request authorization, accept alternative, move, rename...), each
 *   mapped 1:1 to the API calls the old uploaders make.
 *
 * Error convention: the PUT/DELETE based helpers (updateFlightPlan(s), deleteFlightPlan(s)...)
 * return null/false on failure, as before. The helpers that call a server action route
 * (reset, requestAuthorization, acceptAlternative, generateVolumes, checkGeoawareness,
 * saveUplan, fetchPlanDetail, fetchCsvResult(s), importExternalUplan) THROW, so the UI can show
 * the server's message (ApiError.serverMessage).
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { apiJson, getAuthToken, ApiError } from '@/lib/api-client'
import { usePolling } from './usePolling'

/**
 * Flight plan status types
 */
export type FlightPlanStatus = 'sin procesar' | 'en cola' | 'procesando' | 'procesado' | 'error'
export type AuthorizationStatus = 'sin autorización' | 'pendiente' | 'aprobado' | 'denegado' | 'withdrawn'

/** Poll every 3 s while any plan is in a transient state, every 15 s otherwise. */
export const POLL_FAST_MS = 3000
export const POLL_IDLE_MS = 15000

/** Queued / processing plans and plans waiting for FAS ('procesando autorización' is the Dev marker). */
export function isTransientPlan(p: { status: string; authorizationStatus?: string | null }): boolean {
  return (
    p.status === 'en cola' ||
    p.status === 'procesando' ||
    p.authorizationStatus === 'pendiente' ||
    p.authorizationStatus === 'procesando autorización'
  )
}

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
  geoawarenessData: unknown | null
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
 * Row of GET /api/flightPlans?fields=summary: no fileContent / uplan (read them with
 * fetchPlanDetail), but the booleans to gate buttons. authorizationMessage is still included.
 */
export type FlightPlanSummary = Omit<FlightPlan, 'fileContent' | 'uplan'> & {
  hasFileContent: boolean
  hasUplan: boolean
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
  authorizationStatus?: AuthorizationStatus | 'procesando autorización' | null
  authorizationMessage?: string | null
  externalResponseNumber?: null
  geoawarenessData?: unknown
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
  /** Fixed polling interval in ms. Omit for the adaptive 3 s / 15 s interval. */
  pollingInterval?: number
  /** Whether polling is enabled (default: true) */
  pollingEnabled?: boolean
  /** Fetch the light listing (?fields=summary): rows are FlightPlanSummary (default: false) */
  summary?: boolean
}

export interface UseFlightPlansReturn<TPlan = FlightPlan> {
  /** Array of flight plans */
  flightPlans: TPlan[]
  /** Loading state for initial fetch */
  loading: boolean
  /** Error from the last fetch attempt */
  error: Error | null
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
  /** Whether polling is currently active */
  isPolling: boolean
  /** Whether a background refresh is in progress */
  isRefreshing: boolean
  /** Number of consecutive polling errors */
  errorCount: number
  /** When the last fetch succeeded (null until the first one) */
  lastSyncedAt: Date | null
  /** Whether any fetch (initial, background or manual) is in flight */
  isSyncing: boolean
  /** Error of the last fetch (cleared by the next success) */
  syncError: Error | null
  /** Whether sync was paused with pauseSync() */
  isPaused: boolean
  /** Pause automatic refreshes until resumeSync() */
  pauseSync: () => void
  /** Resume automatic refreshes and refresh right away */
  resumeSync: () => void
  /** Start polling */
  startPolling: () => void
  /** Stop polling */
  stopPolling: () => void
  /** Reset errors and resume polling */
  resetErrors: () => void
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
  optimisticUpdate: (id: number, data: Partial<TPlan>) => void
  /** Optimistically remove a flight plan from local state */
  optimisticRemove: (id: number) => void
  /** Get flight plans by folder */
  getByFolder: (folderId: number | null) => TPlan[]
  /** Get flight plans by status */
  getByStatus: (status: FlightPlanStatus) => TPlan[]
  /** Import an external UPLAN into a folder (throws Error with the server's message on failure) */
  importExternalUplan: (uplan: object, folderId: number, customName: string) => Promise<FlightPlan | null>

  // ---- Detail / reads ----
  /** GET /api/flightPlans/[id]: the full row (fileContent, uplan...). Always hits the network. */
  fetchPlanDetail: (id: number) => Promise<FlightPlan>
  /** GET /api/csvResult?id= : trajectory CSV text of a processed plan (csv id == plan id) */
  fetchCsvResult: (id: number) => Promise<string>
  /** POST /api/csvResult { ids } in batches of 500 */
  fetchCsvResults: (ids: number[]) => Promise<{ id: number; customName: string; csvResult: string }[]>

  // ---- Single-plan helpers (PUT { id, data }, optimistic) ----
  /** PUT { id, data: { status: 'en cola' } } */
  processFlightPlan: (id: number) => Promise<FlightPlan | null>
  /** PUT { id, data: { scheduledAt } } */
  scheduleFlightPlan: (id: number, scheduledAt: string | null) => Promise<FlightPlan | null>
  /** PUT { id, data: { customName } } */
  renameFlightPlan: (id: number, customName: string) => Promise<FlightPlan | null>
  /** PUT { id, data: { folderId } } (drag and drop; null = no folder) */
  moveFlightPlan: (id: number, folderId: number | null) => Promise<FlightPlan | null>
  /** PUT { id, data: { geoawarenessData: { uspace_identifier } } } */
  setFlightPlanUspace: (id: number, uspaceId: string) => Promise<FlightPlan | null>
  /** PUT /api/flightPlans/[id] { uplan } (what UplanFormModal sends). Throws. */
  saveUplan: (id: number, uplan: unknown) => Promise<void>

  // ---- Bulk helpers (PUT { ids, data } / { items }, optimistic) ----
  /** PUT { ids, data: { status: 'en cola' } } */
  processFlightPlans: (ids: number[]) => Promise<{ count: number } | null>
  /** PUT { items: [{ id, data: { scheduledAt } }] } (per-folder randomize) */
  scheduleFlightPlans: (items: { id: number; scheduledAt: string | null }[]) => Promise<{ count: number } | null>
  /** PUT { ids, data: { authorizationStatus: 'sin autorización', authorizationMessage: null, externalResponseNumber: null } } */
  resetAuthorization: (ids: number[]) => Promise<{ count: number } | null>
  /** Dev bulk reset: DELETE /api/csvResult { ids } then PUT { ids, data: { status: 'sin procesar', csvResult: null, auth cleared } } */
  resetFlightPlans: (ids: number[]) => Promise<{ count: number } | null>

  // ---- Server action routes (throw ApiError on failure) ----
  /** POST /api/flightPlans/[id]/reset (prod single reset: also cancels FAS if approved) */
  resetFlightPlan: (id: number) => Promise<{ message: string; flightPlan: FlightPlan }>
  /** POST /api/flightPlans/[id]/generate-volumes */
  generateVolumes: (id: number) => Promise<{ success: boolean; volumesGenerated: number; randomDataGenerated: boolean; uplan: unknown }>
  /** POST /api/flightPlans/[id]/geoawareness */
  checkGeoawareness: (id: number) => Promise<{ success: boolean; uspaceIdentifier: string; wsUrl: string }>
  /** POST /api/flightPlans/[id]/uplan (submit to FAS). markProcessing = Dev recipe: PUT 'procesando autorización' first. */
  requestAuthorization: (id: number, opts?: { markProcessing?: boolean }) => Promise<unknown>
  /**
   * Bulk request (Dev): ascending id order, only plans 'procesado' with no authorization yet,
   * strictly sequential, `delayMs` (default 1000) after each one (commit acb2aac). Never throws:
   * one entry per attempted plan.
   */
  requestAuthorizations: (
    ids: number[],
    opts?: { delayMs?: number; markProcessing?: boolean }
  ) => Promise<{ id: number; ok: boolean; error?: string }[]>
  /** POST /api/flightPlans/[id]/accept-alternative */
  acceptAlternative: (id: number) => Promise<unknown>
  /** accept-alternative for each id, 5 at a time; never throws */
  acceptAlternatives: (ids: number[]) => Promise<{ accepted: number[]; failed: { id: number; error: string }[] }>
}

/** Message to show for a failed call: the server's `{ error }` or the generic text. */
const errorText = (e: unknown) => (e instanceof ApiError ? e.serverMessage : e instanceof Error ? e.message : 'Unknown error')

/**
 * Fetch all flight plans from the API
 */
async function fetchFlightPlans(summary: boolean): Promise<(FlightPlan | FlightPlanSummary)[]> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return apiJson<(FlightPlan | FlightPlanSummary)[]>(summary ? '/api/flightPlans?fields=summary' : '/api/flightPlans')
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
export function useFlightPlans(options: UseFlightPlansOptions & { summary: true }): UseFlightPlansReturn<FlightPlanSummary>
export function useFlightPlans(options?: UseFlightPlansOptions): UseFlightPlansReturn<FlightPlan>
export function useFlightPlans(
  options: UseFlightPlansOptions = {}
): UseFlightPlansReturn<FlightPlan | FlightPlanSummary> {
  const {
    pollingInterval,
    pollingEnabled = true,
    summary = false,
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
    isRefreshing,
    errorCount,
    startPolling,
    stopPolling,
    resetErrors,
    lastSyncedAt,
    isSyncing,
    syncError,
    isPaused,
    pauseSync,
    resumeSync,
  } = usePolling<(FlightPlan | FlightPlanSummary)[]>(() => fetchFlightPlans(summary), {
    // Adaptive unless the caller fixed it: fast while a visible plan is in a transient state
    interval:
      pollingInterval ??
      ((data) =>
        data?.some((p) => !removedIds.has(p.id) && isTransientPlan({ ...p, ...optimisticState.get(p.id) }))
          ? POLL_FAST_MS
          : POLL_IDLE_MS),
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
  const optimisticUpdate = useCallback((id: number, data: Partial<FlightPlan | FlightPlanSummary>) => {
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
      const created = await apiJson<FlightPlan>('/api/flightPlans', { method: 'POST', body: data })
      // Refresh to get the new plan in the list
      await refresh()
      return created
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
      const created = await apiJson<{ createdCount: number; items: FlightPlan[] }>(
        '/api/flightPlans',
        { method: 'POST', body: { items } }
      )
      // Refresh to get the new plans in the list
      await refresh()
      return created
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
      const updated = await apiJson<FlightPlan>('/api/flightPlans', {
        method: 'PUT',
        body: { id, data },
      })

      // Clear optimistic state after successful update
      clearOptimistic(id)
      // Refresh to sync with server
      await refresh()
      
      return updated
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
      const updated = await apiJson<{ count: number }>('/api/flightPlans', {
        method: 'PUT',
        body: { ids, data },
      })

      // Clear optimistic states
      ids.forEach(id => clearOptimistic(id))
      // Refresh to sync with server
      await refresh()

      return updated
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
      await apiJson('/api/flightPlans', { method: 'DELETE', body: { id } })

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
      const result = await apiJson<{
        deletedPlans: number
        deletedCsvs: number
        totalDeleted: number
        message: string
      }>('/api/flightPlans', { method: 'DELETE', body: { ids } })

      // Clear optimistic states
      ids.forEach(id => clearOptimistic(id))
      // Refresh to sync with server
      await refresh()

      return {
        deletedPlans: result.deletedPlans,
        deletedCsvs: result.deletedCsvs,
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
   * Import an external UPLAN into a folder
   */
  const importExternalUplan = useCallback(async (
    uplan: object,
    folderId: number,
    customName: string
  ): Promise<FlightPlan | null> => {
    try {
      const created = await apiJson<FlightPlan>('/api/flightPlans', {
        method: 'POST',
        body: { type: 'external_uplan', uplan, folderId, customName },
      })
      await refresh()
      return created
    } catch (err) {
      console.error('Error importing external UPLAN:', err)
      // The uploader toasts error.message: keep showing the server's text, not "status code N"
      throw new Error(errorText(err))
    }
  }, [refresh])

  // ---- Detail / reads ----

  const fetchPlanDetail = useCallback(
    (id: number) => apiJson<FlightPlan>(`/api/flightPlans/${id}`),
    []
  )

  const fetchCsvResult = useCallback(async (id: number): Promise<string> => {
    const res = await apiJson<{ csvResult: string }>(`/api/csvResult?id=${id}`)
    return res.csvResult
  }, [])

  const fetchCsvResults = useCallback(async (ids: number[]) => {
    const BATCH = 500
    const out: { id: number; customName: string; csvResult: string }[] = []
    for (let i = 0; i < ids.length; i += BATCH) {
      const res = await apiJson<{ items?: { id: number; customName: string; csvResult: string }[] }>(
        '/api/csvResult',
        { method: 'POST', body: { ids: ids.slice(i, i + BATCH) } }
      )
      out.push(...(res.items ?? []))
    }
    return out
  }, [])

  // ---- Single / bulk PUT helpers (same bodies as the old uploaders) ----

  const processFlightPlan = useCallback(
    (id: number) => updateFlightPlan(id, { status: 'en cola' }),
    [updateFlightPlan]
  )
  const scheduleFlightPlan = useCallback(
    (id: number, scheduledAt: string | null) => updateFlightPlan(id, { scheduledAt }),
    [updateFlightPlan]
  )
  const renameFlightPlan = useCallback(
    (id: number, customName: string) => updateFlightPlan(id, { customName }),
    [updateFlightPlan]
  )
  const moveFlightPlan = useCallback(
    (id: number, folderId: number | null) => updateFlightPlan(id, { folderId }),
    [updateFlightPlan]
  )
  const setFlightPlanUspace = useCallback(
    (id: number, uspaceId: string) => updateFlightPlan(id, { geoawarenessData: { uspace_identifier: uspaceId } }),
    [updateFlightPlan]
  )
  const processFlightPlans = useCallback(
    (ids: number[]) => updateFlightPlans(ids, { status: 'en cola' }),
    [updateFlightPlans]
  )
  const resetAuthorization = useCallback(
    (ids: number[]) =>
      updateFlightPlans(ids, {
        authorizationStatus: 'sin autorización',
        authorizationMessage: null,
        externalResponseNumber: null,
      }),
    [updateFlightPlans]
  )

  const scheduleFlightPlans = useCallback(async (
    items: { id: number; scheduledAt: string | null }[]
  ): Promise<{ count: number } | null> => {
    items.forEach(({ id, scheduledAt }) => optimisticUpdate(id, { scheduledAt }))
    try {
      return await apiJson<{ count: number }>('/api/flightPlans', {
        method: 'PUT',
        body: { items: items.map(({ id, scheduledAt }) => ({ id, data: { scheduledAt } })) },
      })
    } catch (err) {
      console.error('Error scheduling flight plans:', err)
      return null
    } finally {
      items.forEach(({ id }) => clearOptimistic(id))
      await refresh()
    }
  }, [optimisticUpdate, clearOptimistic, refresh])

  const resetFlightPlans = useCallback(async (ids: number[]): Promise<{ count: number } | null> => {
    try {
      await apiJson('/api/csvResult', { method: 'DELETE', body: { ids } })
    } catch (err) {
      console.error('Error deleting CSV results:', err)
      return null
    }
    return updateFlightPlans(ids, {
      status: 'sin procesar',
      csvResult: null,
      authorizationStatus: 'sin autorización',
      authorizationMessage: null,
      externalResponseNumber: null,
    })
  }, [updateFlightPlans])

  const saveUplan = useCallback(async (id: number, uplan: unknown): Promise<void> => {
    await apiJson(`/api/flightPlans/${id}`, { method: 'PUT', body: { uplan } })
    await refresh()
  }, [refresh])

  // ---- Server action routes (throw ApiError) ----

  /** POST to a plan action route, then refresh the list. */
  const planAction = useCallback(async <T,>(id: number, action: string): Promise<T> => {
    const res = await apiJson<T>(`/api/flightPlans/${id}/${action}`, { method: 'POST' })
    await refresh()
    return res
  }, [refresh])

  const resetFlightPlan = useCallback(
    (id: number) => planAction<{ message: string; flightPlan: FlightPlan }>(id, 'reset'),
    [planAction]
  )
  const generateVolumes = useCallback(
    (id: number) =>
      planAction<{ success: boolean; volumesGenerated: number; randomDataGenerated: boolean; uplan: unknown }>(id, 'generate-volumes'),
    [planAction]
  )
  const checkGeoawareness = useCallback(
    (id: number) => planAction<{ success: boolean; uspaceIdentifier: string; wsUrl: string }>(id, 'geoawareness'),
    [planAction]
  )
  const acceptAlternative = useCallback(
    (id: number) => planAction<unknown>(id, 'accept-alternative'),
    [planAction]
  )

  const requestAuthorization = useCallback(async (
    id: number,
    opts: { markProcessing?: boolean } = {}
  ): Promise<unknown> => {
    if (opts.markProcessing) {
      await apiJson('/api/flightPlans', {
        method: 'PUT',
        body: { id, data: { authorizationStatus: 'procesando autorización' } },
      })
    }
    return planAction<unknown>(id, 'uplan')
  }, [planAction])

  // Latest list for the bulk eligibility filter without re-creating the callbacks on every poll
  const plansRef = useRef<{ id: number; status: string; authorizationStatus: string | null }[]>([])
  plansRef.current = flightPlans

  const requestAuthorizations = useCallback(async (
    ids: number[],
    { delayMs = 1000, markProcessing = true }: { delayMs?: number; markProcessing?: boolean } = {}
  ) => {
    const results: { id: number; ok: boolean; error?: string }[] = []
    for (const id of [...ids].sort((a, b) => a - b)) {
      const plan = plansRef.current.find((p) => p.id === id)
      if (!plan || plan.status !== 'procesado' || (plan.authorizationStatus && plan.authorizationStatus !== 'sin autorización')) {
        continue
      }
      try {
        await requestAuthorization(id, { markProcessing })
        results.push({ id, ok: true })
      } catch (err) {
        results.push({ id, ok: false, error: errorText(err) })
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    return results
  }, [requestAuthorization])

  const acceptAlternatives = useCallback(async (ids: number[]) => {
    const CONCURRENCY = 5
    const accepted: number[] = []
    const failed: { id: number; error: string }[] = []
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY)
      const settled = await Promise.allSettled(
        chunk.map((id) => apiJson(`/api/flightPlans/${id}/accept-alternative`, { method: 'POST' }))
      )
      settled.forEach((r, k) =>
        r.status === 'fulfilled' ? accepted.push(chunk[k]) : failed.push({ id: chunk[k], error: errorText(r.reason) })
      )
    }
    await refresh()
    return { accepted, failed }
  }, [refresh])

  /**
   * Get flight plans by folder ID
   */
  const getByFolder = useCallback((folderId: number | null): (FlightPlan | FlightPlanSummary)[] => {
    return flightPlans.filter(plan => plan.folderId === folderId)
  }, [flightPlans])

  /**
   * Get flight plans by status
   */
  const getByStatus = useCallback((status: FlightPlanStatus): (FlightPlan | FlightPlanSummary)[] => {
    return flightPlans.filter(plan => plan.status === status)
  }, [flightPlans])

  return {
    flightPlans,
    loading,
    error,
    refresh,
    isPolling,
    isRefreshing,
    errorCount,
    lastSyncedAt,
    isSyncing,
    syncError,
    isPaused,
    pauseSync,
    resumeSync,
    startPolling,
    stopPolling,
    resetErrors,
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
    importExternalUplan,
    fetchPlanDetail,
    fetchCsvResult,
    fetchCsvResults,
    processFlightPlan,
    scheduleFlightPlan,
    renameFlightPlan,
    moveFlightPlan,
    setFlightPlanUspace,
    saveUplan,
    processFlightPlans,
    scheduleFlightPlans,
    resetAuthorization,
    resetFlightPlans,
    resetFlightPlan,
    generateVolumes,
    checkGeoawareness,
    requestAuthorization,
    requestAuthorizations,
    acceptAlternative,
    acceptAlternatives,
  }
}

export default useFlightPlans
