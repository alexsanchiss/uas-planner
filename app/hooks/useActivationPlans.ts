/**
 * useActivationPlans Hook - Flight plan activation management
 *
 * T19: Fetches and manages flight plans for the Plan Activation page.
 *
 * Features:
 * - Polls GET /api/flightPlans/active every 30 seconds
 * - Exposes `now: Date` updated every second for activation window evaluation
 * - `activate(planId, termsAccepted)` POSTs to /api/flightPlans/[id]/activate
 * - `refresh()` triggers an immediate re-fetch
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// Auth token key — same constant used throughout the project
const AUTH_TOKEN_KEY = 'authToken'

/** Get the JWT access token from localStorage (SSR-safe) */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ActivationPlan {
  id: number
  customName: string
  status: string
  authorizationStatus: string
  scheduledAt: string | null       // ISO string
  activationStatus: string
  activatedAt: string | null
  activationMessage: string | null
  termsAcceptedAt: string | null
  externalResponseNumber: string | null
  uplan: unknown
  fileContent: string | null
}

export interface ActivateResult {
  ok: boolean
  message?: string
  error?: string
  retryAt?: string
  flightPlan?: ActivationPlan
}

export interface UseActivationPlansReturn {
  plans: ActivationPlan[]
  loading: boolean
  error: string | null
  now: Date
  refresh: () => void
  activate: (planId: number, termsAccepted: boolean) => Promise<ActivateResult>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000
const TICK_INTERVAL_MS = 1_000

export function useActivationPlans(): UseActivationPlansReturn {
  const [plans, setPlans] = useState<ActivationPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())

  // Use a ref to track mount state for safe async state updates
  const mountedRef = useRef(true)
  // Allows triggering an immediate re-fetch without restarting the interval
  const refreshCountRef = useRef(0)

  // -------------------------------------------------------------------------
  // Fetch helper
  // -------------------------------------------------------------------------
  const fetchPlans = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      if (mountedRef.current) {
        setError('Unauthorized')
        setLoading(false)
      }
      return
    }

    try {
      const res = await fetch('/api/flightPlans/active', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!mountedRef.current) return

      if (res.status === 401) {
        setError('Unauthorized')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? `Error ${res.status}`)
        setLoading(false)
        return
      }

      const body = await res.json()
      setPlans(Array.isArray(body) ? body : (body.plans ?? []))
      setError(null)
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Network error')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Polling — 30-second interval, also re-runs when refreshCountRef changes
  // -------------------------------------------------------------------------
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => {
    setRefreshTick(prev => prev + 1)
  }, [])

  useEffect(() => {
    mountedRef.current = true

    // Immediate fetch on mount or manual refresh
    fetchPlans()

    const intervalId = setInterval(() => {
      fetchPlans()
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]) // re-runs (and resets the 30s clock) on manual refresh

  // -------------------------------------------------------------------------
  // 1-second tick for `now`
  // -------------------------------------------------------------------------
  useEffect(() => {
    const tickId = setInterval(() => {
      if (mountedRef.current) {
        setNow(new Date())
      }
    }, TICK_INTERVAL_MS)

    return () => {
      clearInterval(tickId)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // -------------------------------------------------------------------------
  // Activate
  // -------------------------------------------------------------------------
  const activate = useCallback(
    async (planId: number, termsAccepted: boolean): Promise<ActivateResult> => {
      const token = getAuthToken()
      if (!token) {
        return { ok: false, error: 'Unauthorized' }
      }

      try {
        const res = await fetch(`/api/flightPlans/${planId}/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ termsAccepted }),
        })

        if (res.status === 401) {
          return { ok: false, error: 'Unauthorized' }
        }

        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
          return {
            ok: false,
            error: (body as { error?: string }).error ?? `Error ${res.status}`,
            retryAt: (body as { retryAt?: string }).retryAt,
          }
        }

        // Trigger a re-fetch so the list reflects the new activation status
        refresh()

        return {
          ok: true,
          message: (body as { message?: string }).message,
          flightPlan: (body as { flightPlan?: ActivationPlan }).flightPlan,
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Network error',
        }
      }
    },
    [refresh],
  )

  return { plans, loading, error, now, refresh, activate }
}

export default useActivationPlans
