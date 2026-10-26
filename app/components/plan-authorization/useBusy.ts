'use client'

import { useCallback, useState } from 'react'

export type BusyKind = 'process' | 'auth' | 'reset' | 'delete' | 'rename' | 'move' | 'download' | 'viewer' | 'schedule'

/** Per-plan "operation in flight" flags, so rows can show spinners and disable their buttons. */
export function useBusy() {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())

  const is = useCallback((kind: BusyKind, id: number) => busy.has(`${kind}:${id}`), [busy])
  const any = useCallback((id: number) => [...busy].some((k) => k.endsWith(`:${id}`)), [busy])

  const run = useCallback(async <T,>(kind: BusyKind, id: number, fn: () => Promise<T>): Promise<T> => {
    const key = `${kind}:${id}`
    setBusy((prev) => new Set(prev).add(key))
    try {
      return await fn()
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [])

  return { is, any, run }
}

export type Busy = ReturnType<typeof useBusy>
