'use client'

import { useSyncExternalStore } from 'react'

/**
 * Live `window.matchMedia(query).matches`. `serverValue` is what SSR and the hydration pass see
 * (React re-renders with the real value right after hydrating, so there is no mismatch).
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}
