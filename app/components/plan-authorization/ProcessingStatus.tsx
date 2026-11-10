'use client'

import { useEffect, useState } from 'react'
import { interpolate, useI18n } from '@/app/i18n'
import { parseProcessingError } from '@/lib/simulation'
import { planPhase, type PlanRow } from './lib'
import { remainingText } from './simulationText'

interface Props {
  plan: PlanRow
  /** compact: list rows (relies on polling). full: workspace / detail (the countdown ticks every second). */
  variant: 'compact' | 'full'
  className?: string
}

/**
 * What the runner is doing with a plan: queue position, a progress bar with the time left (indeterminate until the
 * first progress arrives) or the processing error with its message. Renders nothing for the other statuses.
 */
export function ProcessingStatus({ plan, variant, className = '' }: Props) {
  const { t } = useI18n()
  const s = t.planAuth.processing
  const phase = planPhase(plan)
  const full = variant === 'full'

  // One interval for the countdown of the full variant, cleared when it stops being needed / unmounts
  const ticking = full && phase === 'processing' && !!plan.processingEta
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [ticking])

  if (phase === 'queued') {
    const text = plan.queuePosition && plan.queueLength ? interpolate(s.queuedAt, { n: plan.queuePosition, total: plan.queueLength }) : s.queued
    return <span className={`block ${full ? 'text-sm' : 'text-xs'} text-fg-2 ${className}`}>{text}</span>
  }

  if (phase === 'processing') {
    const label = interpolate(s.barLabel, { name: plan.customName })
    const pct = plan.progress === null || plan.progress === undefined ? null : Math.min(100, Math.max(0, Math.round(plan.progress)))
    const track = `block ${full ? 'h-2' : 'h-1.5'} overflow-hidden rounded-full bg-subtle`
    if (pct === null) {
      return (
        <span className={`block ${className}`}>
          <span role="progressbar" aria-label={label} aria-valuetext={s.preparing} className={track}>
            <span className="progress-indeterminate block h-full rounded-full bg-brand" />
          </span>
          <span className={`mt-1 block ${full ? 'text-sm' : 'text-xs'} text-fg-2`}>{s.preparing}</span>
        </span>
      )
    }
    const eta = plan.processingEta ? Date.parse(plan.processingEta) : NaN
    const remaining = Number.isFinite(eta) ? remainingText(eta - Date.now(), s) : null
    const percent = interpolate(s.percent, { n: pct })
    return (
      <span className={`block ${className}`}>
        <span
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={remaining ? `${percent}, ${remaining}` : percent}
          className={track}
        >
          <span
            className="block h-full origin-left rounded-full bg-brand transition-transform duration-700 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </span>
        <span className={`mt-1 flex items-baseline justify-between gap-3 ${full ? 'text-sm' : 'text-xs'} text-fg-2`}>
          <span className="font-medium tabular-nums text-fg">{percent}</span>
          {remaining && <span className="truncate tabular-nums">{remaining}</span>}
        </span>
      </span>
    )
  }

  if (phase === 'error') {
    const err = parseProcessingError(plan.processingError)
    if (!err) return null
    const message = err.code ? s.errors[err.code] : s.errors.unknown
    if (!full) {
      return (
        <span className={`block truncate text-xs text-danger-text ${className}`} title={err.detail || undefined}>
          {message}
        </span>
      )
    }
    return (
      <span className={`block rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-danger-text ${className}`}>
        <span className="block text-sm font-medium">{message}</span>
        {err.detail && <span className="mt-0.5 block break-words text-xs">{err.detail}</span>}
      </span>
    )
  }

  return null
}
