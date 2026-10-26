'use client'

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

/** The 8 global status counters, as toggle filters (icon + text + count; one row, scrolls sideways on phones). */
export function StatusChips({ counts, active, onChange }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth
  return (
    <div role="group" aria-label={pa.filters.label} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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
