'use client'

import { useState, type CSSProperties, type UIEvent } from 'react'
import { CircleCheck, CircleDashed, CircleX, Clock, Loader2, Route, ShieldCheck, ShieldX, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { STATUS_FILTERS, type StatusFilter } from './lib'

const ICONS: Record<StatusFilter, LucideIcon> = {
  unprocessed: CircleDashed,
  queued: Clock,
  processing: Loader2,
  processed: CircleCheck,
  error: CircleX,
  authorized: ShieldCheck,
  denied: ShieldX,
  alternatives: Route,
}

interface Props {
  counts: Record<StatusFilter, number>
  active: StatusFilter | null
  onChange: (next: StatusFilter | null) => void
}

/**
 * The 8 global status counters, as toggle filters (icon + text + count). One row that scrolls sideways on phones,
 * with a fade on each edge that still has chips beyond it; wraps from sm up.
 */
export function StatusChips({ counts, active, onChange }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth
  const [more, setMore] = useState({ left: false, right: true })
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }))
  }
  return (
    <div
      role="group"
      aria-label={pa.filters.label}
      onScroll={onScroll}
      style={{ '--fade-l': more.left ? '2rem' : '0px', '--fade-r': more.right ? '2rem' : '0px' } as CSSProperties}
      className="-mx-4 overflow-x-auto px-4 pb-1 max-sm:[mask-image:linear-gradient(to_right,transparent,#000_var(--fade-l),#000_calc(100%-var(--fade-r)),transparent)] sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const Icon = ICONS[f]
          const on = active === f
          return (
            <li key={f}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? null : f)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                  on ? 'border-brand-ring bg-info-soft text-info-text' : 'border-line bg-surface text-fg-2 hover:bg-hover'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{pa.filters[f]}</span>
                <span className="font-semibold tabular-nums text-fg">{counts[f]}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
