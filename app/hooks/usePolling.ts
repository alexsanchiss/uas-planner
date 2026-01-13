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
  options: UsePollingOptions = {}
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
    if (isBackgroundRefresh && mountedRef.current) {
      setIsRefreshing(true)
    }
    
    try {
      const result = await fetchFnRef.current()
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setData(result)
        setError(null)
        setErrorCount(0) // Reset error count on success
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

  // Setup and cleanup polling interval
  useEffect(() => {
    mountedRef.current = true

    // Initial fetch if immediate is true
    if (immediate) {
      executeFetch(false) // Not a background refresh for initial fetch
    } else {
      setLoading(false)
    }

    // Setup polling interval with exponential backoff on errors
    if (isPolling && interval > 0) {
      // Calculate interval with backoff based on error count
      const effectiveInterval = errorCount > 0 
        ? Math.min(interval * Math.pow(2, errorCount), 30000) // Max 30s
        : interval
      
      intervalRef.current = setInterval(() => {
        executeFetch(true) // Background refresh
      }, effectiveInterval)
    }

    // Cleanup on unmount or when polling settings change
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPolling, interval, immediate, executeFetch, errorCount])

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
    startPolling,
    stopPolling,
    resetErrors,
  }
}

export default usePolling
