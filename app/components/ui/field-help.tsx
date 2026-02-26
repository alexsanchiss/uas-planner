'use client'

import { useState, useRef, useEffect } from 'react'

interface FieldHelpProps {
  text: string
}

export function FieldHelp({ text }: FieldHelpProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(!open) }}
        className="ml-1 w-4 h-4 rounded-full bg-[var(--surface-tertiary)] border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[10px] font-bold leading-none transition-colors flex-shrink-0"
        aria-label="Help"
        tabIndex={-1}
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg">
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 rotate-45 bg-[var(--surface-primary)] border-r border-b border-[var(--border-primary)]" />
          </div>
          {text}
        </div>
      )}
    </div>
  )
}
