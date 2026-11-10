'use client'

import { Wind } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { simulationOf } from '@/lib/simulation'
import type { PlanRow } from './lib'
import { simulationShort, simulationSummary } from './simulationText'

/** Small muted line of the lists ("Fixed wing · 8 m/s") for plans whose settings are not the default; nothing otherwise. */
export function SimulationLine({ plan, className = '' }: { plan: PlanRow; className?: string }) {
  const { t, language } = useI18n()
  const sim = simulationOf(plan)
  const text = simulationShort(sim, t.planAuth.sim, language)
  if (!text) return null
  return (
    <p className={`truncate text-xs text-muted ${className}`} title={simulationSummary(sim, t.planAuth.sim, language)}>
      {text}
    </p>
  )
}

/** Read-only chip with the full summary, next to the status badges (processing started or finished). */
export function SimulationChip({ plan }: { plan: PlanRow }) {
  const { t, language } = useI18n()
  const text = simulationSummary(simulationOf(plan), t.planAuth.sim, language)
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-subtle px-2 py-0.5 text-xs font-medium text-fg-2"
      title={`${t.planAuth.sim.title}: ${text}`}
    >
      <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </span>
  )
}
