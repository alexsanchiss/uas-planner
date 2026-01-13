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
 */

import { useEffect, useRef, useCallback, useState } from 'react'

interface UsePollingOptions {
  /** Polling interval in milliseconds (default: 5000) */
  interval?: number
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean
  /** Called when fetch fails */
  onError?: (error: Error) => void
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
  /** Start polling */
  startPolling: () => void
  /** Stop polling */
  stopPolling: () => void
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
  options: UsePollingOptions = {}
): UsePollingReturn<T> {
  const {
    interval = 5000,
    enabled = true,
    immediate = true,
    onError,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isPolling, setIsPolling] = useState(enabled)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)

  // Stable reference to the fetch function
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  /**
   * Execute the fetch function with error handling
   */
  const executeFetch = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return
    
    fetchingRef.current = true
    
    try {
      const result = await fetchFnRef.current()
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        onErrorRef.current?.(error)
      }
    } finally {
      fetchingRef.current = false
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

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

  // Setup and cleanup polling interval
  useEffect(() => {
    mountedRef.current = true

    // Initial fetch if immediate is true
    if (immediate) {
      executeFetch()
    } else {
      setLoading(false)
    }

    // Setup polling interval
    if (isPolling && interval > 0) {
      intervalRef.current = setInterval(() => {
        executeFetch()
      }, interval)
    }

    // Cleanup on unmount or when polling settings change
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPolling, interval, immediate, executeFetch])

  // Handle enabled option changes
  useEffect(() => {
    if (enabled && !isPolling) {
      startPolling()
    } else if (!enabled && isPolling) {
      stopPolling()
    }
  }, [enabled, isPolling, startPolling, stopPolling])

  return {
    data,
    loading,
    error,
    refresh,
    isPolling,
    startPolling,
    stopPolling,
  }
}

export default usePolling
