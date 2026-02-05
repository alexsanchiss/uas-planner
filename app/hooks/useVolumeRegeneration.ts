/**
 * useVolumeRegeneration Hook
 * 
 * Provides volume regeneration functionality for processed flight plans.
 * 
 * NOTE: Automatic polling is DISABLED by default. Volumes are now generated
 * on-demand when needed. The hook is kept available for future manual use.
 * To re-enable automatic polling, set isPaused to false via setIsPaused(false).
 */

import { useEffect, useRef, useState } from 'react'

interface RegenerationStatus {
  lastCheck: Date | null
  plansChecked: number
  plansRegenerated: number
  errors: string[]
}

export function useVolumeRegeneration(enabled: boolean = true) {
  const [status, setStatus] = useState<RegenerationStatus>({
    lastCheck: null,
    plansChecked: 0,
    plansRegenerated: 0,
    errors: []
  })
  
  // DISABLED: Automatic polling is paused by default - volumes are generated on-demand
  const [isPaused, setIsPaused] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isCheckingRef = useRef(false)

  useEffect(() => {
    // Clean up any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Don't create interval if disabled or paused
    if (!enabled || isPaused) {
      return
    }

    async function checkAndRegenerateVolumes() {
      if (isCheckingRef.current) {
        // console.log('[VolumeRegeneration] Check already in progress, skipping...')
        return
      }

      isCheckingRef.current = true
      const startTime = Date.now()
      
      try {
        // console.log('[VolumeRegeneration] Starting volume check...')
        
        const token = localStorage.getItem('authToken')
        if (!token) {
          // console.log('[VolumeRegeneration] No auth token, skipping check')
          return
        }

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        // Call the regeneration endpoint
        const response = await fetch('/api/flightPlans/regenerate-volumes', {
          method: 'POST',
          headers
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        
        setStatus({
          lastCheck: new Date(),
          plansChecked: result.plansChecked || 0,
          plansRegenerated: result.plansRegenerated || 0,
          errors: result.errors || []
        })

        const elapsed = Date.now() - startTime
        
        if (result.plansRegenerated > 0) {
          // console.log(
            // `[VolumeRegeneration] ✅ Regenerated ${result.plansRegenerated} plan(s) ` +
            // `(checked ${result.plansChecked} plans in ${elapsed}ms)`
          // )
        } else {
          // console.log(
            // `[VolumeRegeneration] ℹ️ No plans needed regeneration ` +
            // `(checked ${result.plansChecked} plans in ${elapsed}ms)`
          // )
        }

        if (result.errors && result.errors.length > 0) {
          console.warn('[VolumeRegeneration] Errors:', result.errors)
        }
      } catch (error) {
        console.error('[VolumeRegeneration] Failed to check volumes:', error)
        setStatus(prev => ({
          ...prev,
          lastCheck: new Date(),
          errors: [...prev.errors, error instanceof Error ? error.message : 'Unknown error']
        }))
      } finally {
        isCheckingRef.current = false
      }
    }

    // Create interval and run initial check
    checkAndRegenerateVolumes()
    intervalRef.current = setInterval(() => {
      checkAndRegenerateVolumes()
    }, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, isPaused])

  return { status, setIsPaused } // Expose setIsPaused to toggle pause state
}
