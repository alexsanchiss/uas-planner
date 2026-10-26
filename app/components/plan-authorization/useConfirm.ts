'use client'

import { useCallback, useState } from 'react'

export interface ConfirmSpec {
  title: string
  message: string
  warning?: string
  confirmLabel: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => unknown
}

/** One confirmation dialog for every destructive / FAS-sensitive action: `ask(spec)`, rendered by ConfirmHost. */
export function useConfirm() {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null)
  const [open, setOpen] = useState(false)

  const ask = useCallback((next: ConfirmSpec) => {
    setSpec(next)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  // The dialog closes first, then the action runs (its progress shows on the rows / in toasts).
  const confirm = useCallback(async () => {
    setOpen(false)
    await spec?.onConfirm()
  }, [spec])

  return { spec, open, ask, close, confirm }
}

export type Confirm = ReturnType<typeof useConfirm>
