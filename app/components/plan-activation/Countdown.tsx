'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { interpolate } from '@/app/i18n'

/** "2h 14m", "5m 03s", "45s". Unit letters are the same in en/es. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

/**
 * Coarse value for the screen-reader live region, so it is not read out every second:
 * 30 min steps above 1 h, 1 min steps above 1 min, 10 s steps below.
 */
export function coarseSeconds(totalSeconds: number): number {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s >= 3600) return Math.floor(s / 1800) * 1800
  if (s >= 60) return Math.floor(s / 60) * 60
  return Math.ceil(s / 10) * 10
}

interface CountdownProps {
  /** Remaining seconds. */
  seconds: number
  /** Template with a {time} placeholder, e.g. "Window opens in {time}". */
  template: string
  icon: LucideIcon
  className?: string
}

/** Countdown as text + icon (never colour alone). Ticks visibly every second; announces coarsely via aria-live. */
export function Countdown({ seconds, template, icon: Icon, className = '' }: CountdownProps) {
  return (
    <div className={className}>
      <p aria-hidden="true" className="flex items-center gap-2 text-sm font-medium tabular-nums">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{interpolate(template, { time: formatDuration(seconds) })}</span>
      </p>
      <span role="status" aria-live="polite" className="sr-only">
        {interpolate(template, { time: formatDuration(coarseSeconds(seconds)) })}
      </span>
    </div>
  )
}
