/**
 * usePolling Hook - Reusable polling logic
 * 
 * TASK-072: Generic hook for periodic data fetching
 * TASK-073: Implements 5-second polling interval for processing status updates
 * 
 * Features:
 * - Generic hook accepting any fetch function
 * - Configurable polling interval (default 5000ms)
 * - Enable/disable control
 * - Automatic cleanup on unmount
 * - Error handling with retry logic
 * - Pauses while the tab is hidden and refreshes immediately when it becomes visible again
 * - Manual pauseSync/resumeSync plus lastSyncedAt / isSyncing / syncError for sync indicators
 */

import { useEffect, useRef, useCallback, useState } from 'react'

interface UsePollingOptions<T> {
  /**
   * Polling interval in milliseconds (default: 5000). A function receives the latest data
   * and returns the interval, so callers can poll faster while something is in progress.
   */
  interval?: number | ((data: T | null) => number)
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean
  /** Called when fetch fails */
  onError?: (error: Error) => void
  /** Maximum consecutive errors before stopping polling (default: 3) */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelay?: number
}

interface UsePollingReturn<T> {
  /** The fetched data */
  data: T | null
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
  /** Number of consecutive errors */
  errorCount: number
  /** When the last fetch succeeded (null until the first one) */
  lastSyncedAt: Date | null
  /** Whether any fetch (initial, background or manual) is in flight */
  isSyncing: boolean
  /** Error of the last fetch (cleared by the next success); same value as `error` */
  syncError: Error | null
  /** Whether sync was paused with pauseSync() (tab visibility pauses are automatic and not reported here) */
  isPaused: boolean
  /** Pause automatic refreshes until resumeSync() */
  pauseSync: () => void
  /** Resume automatic refreshes and refresh right away */
  resumeSync: () => void
  /** Start polling */
  startPolling: () => void
  /** Stop polling */
  stopPolling: () => void
  /** Reset error count and resume polling after errors */
  resetErrors: () => void
}

/**
 * Generic polling hook for periodic data fetching
 * 
 * @param fetchFn - Async function that fetches data
 * @param options - Polling configuration options
 * @returns Polling state and control functions
 * 
 * @example
 * ```tsx
 * const { data, loading, refresh } = usePolling(
 *   () => fetchFlightPlans(),
 *   { interval: 5000, enabled: true }
 * )
 * ```
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: UsePollingOptions<T> = {}
): UsePollingReturn<T> {
  const {
    interval = 5000,
    enabled = true,
    immediate = true,
    onError,
    maxRetries = 3,
    retryDelay = 1000,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isPolling, setIsPolling] = useState(enabled)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)

  // Stable reference to the fetch function
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  /**
   * Execute the fetch function with error handling and retry logic
   */
  const executeFetch = useCallback(async (isBackgroundRefresh = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return
    
    fetchingRef.current = true
    if (mountedRef.current) {
      setIsSyncing(true)
      if (isBackgroundRefresh) setIsRefreshing(true)
    }
    
    try {
      const result = await fetchFnRef.current()
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setData(result)
        setError(null)
        setErrorCount(0) // Reset error count on success
        setLastSyncedAt(new Date())
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        setErrorCount(prev => {
          const newCount = prev + 1
          // Stop polling after max consecutive errors
          if (newCount >= maxRetries) {
            console.warn(`Polling stopped after ${maxRetries} consecutive errors`)
            setIsPolling(false)
          }
          return newCount
        })
        onErrorRef.current?.(error)
      }
    } finally {
      fetchingRef.current = false
      if (mountedRef.current) {
        setLoading(false)
        setIsRefreshing(false)
        setIsSyncing(false)
      }
    }
  }, [maxRetries])

  /**
   * Manually trigger a data refresh
   */
  const refresh = useCallback(async () => {
    await executeFetch()
  }, [executeFetch])

  /**
   * Start the polling interval
   */
  const startPolling = useCallback(() => {
    setIsPolling(true)
  }, [])

  /**
   * Stop the polling interval
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  /**
   * Reset error count and resume polling after errors
   */
  const resetErrors = useCallback(() => {
    setErrorCount(0)
    setError(null)
    setIsPolling(true)
  }, [])

  /** Pause / resume automatic refreshes (resume refreshes immediately) */
  const pauseSync = useCallback(() => setPaused(true), [])
  const resumeSync = useCallback(() => {
    setPaused(false)
    executeFetch(true)
  }, [executeFetch])

  // Refs so the visibility listener (registered once) sees the current polling state
  const canPollRef = useRef(false)
  const resolvedInterval = typeof interval === 'function' ? interval(data) : interval
  canPollRef.current = isPolling && !paused && resolvedInterval > 0

  // Pause while the tab is hidden; refresh immediately when it is visible again
  useEffect(() => {
    const onVisibility = () => {
      const isHidden = document.visibilityState === 'hidden'
      setHidden(isHidden)
      if (!isHidden && canPollRef.current) executeFetch(true)
    }
    setHidden(document.visibilityState === 'hidden') // initial state
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [executeFetch])

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true

    // Initial fetch if immediate is true
    if (immediate) {
      executeFetch(false) // Not a background refresh for initial fetch
    } else {
      setLoading(false)
    }

    return () => {
      mountedRef.current = false
    }
  }, [immediate])

  // Setup and cleanup polling interval
  useEffect(() => {
    // Setup polling interval with exponential backoff on errors
    if (isPolling && !paused && !hidden && resolvedInterval > 0) {
      // Calculate interval with backoff based on error count
      const effectiveInterval = errorCount > 0 
        ? Math.min(resolvedInterval * Math.pow(2, errorCount), 30000) // Max 30s
        : resolvedInterval
      
      intervalRef.current = setInterval(() => {
        executeFetch(true) // Background refresh
      }, effectiveInterval)
    }

    // Cleanup on unmount or when polling settings change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPolling, paused, hidden, resolvedInterval, errorCount])

  // Handle enabled option changes
  useEffect(() => {
    if (enabled && !isPolling && errorCount < maxRetries) {
      startPolling()
    } else if (!enabled && isPolling) {
      stopPolling()
    }
  }, [enabled, isPolling, startPolling, stopPolling, errorCount, maxRetries])

  return {
    data,
    loading,
    error,
    refresh,
    isPolling,
    isRefreshing,
    errorCount,
    lastSyncedAt,
    isSyncing,
    syncError: error,
    isPaused: paused,
    pauseSync,
    resumeSync,
    startPolling,
    stopPolling,
    resetErrors,
  }
}

export default usePolling
