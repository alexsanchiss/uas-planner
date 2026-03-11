'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface FieldHelpProps {
  text: string
}

export function FieldHelp({ text }: FieldHelpProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY - 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        tooltipRef.current && !tooltipRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(!open) }}
        className="ml-1 w-4 h-4 rounded-full bg-[var(--surface-tertiary)] border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[10px] font-bold leading-none transition-colors flex-shrink-0"
        aria-label="Help"
        tabIndex={-1}
      >
        ?
      </button>
      {open && pos && createPortal(
        <div
          ref={tooltipRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
          className="z-[9999] w-64 px-3 py-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg pointer-events-auto"
        >
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 rotate-45 bg-[var(--surface-primary)] border-r border-b border-[var(--border-primary)]" />
          </div>
          {text}
        </div>,
        document.body
      )}
    </>
  )
}
