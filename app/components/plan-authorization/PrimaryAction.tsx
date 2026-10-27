'use client'

import { Loader2 } from 'lucide-react'
import { isScheduleLocked, type PlanRow } from './lib'
import { primaryView, type RowCtx } from './rowActions'
import { PlanSchedulePopover } from './SchedulePopover'

const TONE = {
  brand: 'bg-brand text-brand-fg hover:bg-brand-hover',
  success: 'bg-success text-success-fg hover:bg-success-hover',
  neutral: 'border border-line-2 bg-surface text-fg hover:bg-hover',
} as const

interface Props {
  plan: PlanRow
  ctx: RowCtx
  /** Touch-sized (44 px) below lg. */
  touch?: boolean
  className?: string
}

/** The row's single contextual action: Set time, Process, Request authorization or View result (or its waiting state). */
export function PrimaryAction({ plan, ctx, touch, className = '' }: Props) {
  const view = primaryView(plan, ctx)
  if (!view) return null

  if (view.id === 'schedule') {
    return (
      <PlanSchedulePopover
        plan={plan}
        locked={isScheduleLocked(plan)}
        variant="primary"
        onSchedule={(iso) => ctx.a.schedule(plan, iso)}
      />
    )
  }

  const Icon = view.icon
  return (
    <button
      type="button"
      disabled={view.disabled || view.loading}
      onClick={view.run}
      aria-busy={view.loading || undefined}
      className={`inline-flex ${touch ? 'min-h-11 lg:min-h-10' : 'min-h-9'} items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70 ${TONE[view.tone]} ${className}`}
    >
      {view.loading ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {view.label}
    </button>
  )
}
