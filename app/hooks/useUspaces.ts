/**
 * useUspaces Hook - U-space data fetching
 * 
 * TASK-040: Hook for loading the list of available U-spaces from the
 * geoawareness service.
 * 
 * Features:
 * - Fetches /api/geoawareness/uspaces for available U-spaces
 * - Provides loading, error, and refetch states
 * - Type-safe API responses
 * - Caches data to avoid unnecessary refetches
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import axios, { AxiosError } from 'axios'

/**
 * U-Space boundary point
 */
export interface USpaceBoundaryPoint {
  latitude: number
  longitude: number
}

/**
 * U-Space data structure
 */
export interface USpace {
  /** Human-readable name of the U-space */
  name: string
  /** Unique identifier for the U-space */
  id: string
  /** Boundary polygon as array of lat/lon points */
  boundary: USpaceBoundaryPoint[]
}

/**
 * API response from /api/geoawareness/uspaces
 */
interface USpacesApiResponse {
  success: boolean
  uspaces: USpace[]
  count: number
  error?: string
}

/**
 * Return type of the useUspaces hook
 */
interface UseUspacesReturn {
  /** Array of available U-spaces */
  uspaces: USpace[]
  /** Loading state for initial fetch */
  loading: boolean
  /** Error from the last fetch attempt */
  error: Error | null
  /** Manually trigger a refresh */
  refetch: () => Promise<void>
  /** Whether a refetch is currently in progress */
  isRefetching: boolean
  /** Check if a specific U-space exists by ID */
  getUspaceById: (id: string) => USpace | undefined
  /** Calculate the center point of a U-space boundary */
  getUspaceCenter: (uspace: USpace) => { lat: number; lon: number }
  /** Calculate the bounding box of a U-space */
  getUspaceBounds: (uspace: USpace) => {
    north: number
    south: number
    east: number
    west: number
  }
}

/**
 * Hook for fetching and managing U-space data
 * 
 * @returns U-spaces state and utility functions
 * 
 * @example
 * ```tsx
 * const { uspaces, loading, error, refetch } = useUspaces()
 * 
 * if (loading) return <Spinner />
 * if (error) return <Error message={error.message} />
 * 
 * return (
 *   <UspaceSelector 
 *     uspaces={uspaces} 
 *     onSelect={handleSelect} 
 *   />
 * )
 * ```
 */
export function useUspaces(): UseUspacesReturn {
  const [uspaces, setUspaces] = useState<USpace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRefetching, setIsRefetching] = useState(false)
  
  // Track if the hook is mounted to avoid state updates after unmount
  const mountedRef = useRef(true)
  // Track if we've already fetched to avoid duplicate calls
  const fetchedRef = useRef(false)

  /**
   * Fetch U-spaces from the API
   */
  const fetchUspaces = useCallback(async (isRefetch = false) => {
    if (isRefetch) {
      setIsRefetching(true)
    }

    try {
      const response = await axios.get<USpacesApiResponse>('/api/geoawareness/uspaces')

      if (!mountedRef.current) return

      if (response.data.success && response.data.uspaces) {
        setUspaces(response.data.uspaces)
        setError(null)
      } else {
        throw new Error(response.data.error || 'Failed to fetch U-spaces')
      }
    } catch (err) {
      if (!mountedRef.current) return

      let errorMessage = 'Failed to fetch U-spaces'
      
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ error?: string }>
        if (axiosError.response?.status === 503) {
          errorMessage = 'Geoawareness service is not configured or unavailable'
        } else if (axiosError.response?.status === 504) {
          errorMessage = 'Geoawareness service timeout'
        } else if (axiosError.response?.data?.error) {
          errorMessage = axiosError.response.data.error
        }
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      setError(new Error(errorMessage))
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setIsRefetching(false)
      }
    }
  }, [])

  /**
   * Manually trigger a refetch of U-spaces
   */
  const refetch = useCallback(async () => {
    await fetchUspaces(true)
  }, [fetchUspaces])

  /**
   * Get a U-space by its ID
   */
  const getUspaceById = useCallback((id: string): USpace | undefined => {
    return uspaces.find(uspace => uspace.id === id)
  }, [uspaces])

  /**
   * Calculate the center point of a U-space boundary
   */
  const getUspaceCenter = useCallback((uspace: USpace): { lat: number; lon: number } => {
    if (!uspace.boundary || uspace.boundary.length === 0) {
      return { lat: 0, lon: 0 }
    }

    // Calculate centroid using average of all points
    const sum = uspace.boundary.reduce(
      (acc, point) => ({
        lat: acc.lat + point.latitude,
        lon: acc.lon + point.longitude,
      }),
      { lat: 0, lon: 0 }
    )

    return {
      lat: sum.lat / uspace.boundary.length,
      lon: sum.lon / uspace.boundary.length,
    }
  }, [])

  /**
   * Calculate the bounding box of a U-space
   */
  const getUspaceBounds = useCallback((uspace: USpace): {
    north: number
    south: number
    east: number
    west: number
  } => {
    if (!uspace.boundary || uspace.boundary.length === 0) {
      return { north: 0, south: 0, east: 0, west: 0 }
    }

    const lats = uspace.boundary.map(p => p.latitude)
    const lons = uspace.boundary.map(p => p.longitude)

    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lons),
      west: Math.min(...lons),
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true

    // Only fetch once on mount
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchUspaces(false)
    }

    return () => {
      mountedRef.current = false
    }
  }, [fetchUspaces])

  return {
    uspaces,
    loading,
    error,
    refetch,
    isRefetching,
    getUspaceById,
    getUspaceCenter,
    getUspaceBounds,
  }
}

export default useUspaces
