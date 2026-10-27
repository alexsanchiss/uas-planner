'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
const DIALOGS = '[role="dialog"],[role="alertdialog"]'

/**
 * Keyboard behaviour for overlays that are not built on the Modal primitive (the Leaflet / Cesium viewers and the
 * U-plan form): Escape closes, focus moves into the dialog on open and Tab wraps inside it, focus returns to the
 * opener on close. Put the returned ref on the element that carries role="dialog" aria-modal and tabIndex={-1}.
 * With dialogs stacked (e.g. the SCRS comparison over the result modal) only the topmost one reacts.
 */
export function useDialogA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!el.contains(document.activeElement)) el.focus()

    const onKey = (e: KeyboardEvent) => {
      const all = document.querySelectorAll(DIALOGS)
      if (all[all.length - 1] !== el) return
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.getClientRects().length > 0)
      if (items.length === 0) {
        e.preventDefault()
        el.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open])

  return ref
}
