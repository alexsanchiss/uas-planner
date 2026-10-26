'use client'

import { useState } from 'react'
import { interpolate, useI18n } from '@/app/i18n'
import { ActionMenu } from './ActionMenu'
import { authPhase, isScheduleLocked, planPhase, type PlanRow } from './lib'
import { PlanName } from './PlanName'
import { PrimaryAction } from './PrimaryAction'
import { planMenuEntries, type RowCtx } from './rowActions'
import { PlanSchedulePopover } from './SchedulePopover'
import { AuthStatusBadge, PlanStatusBadge } from './StatusBadge'

interface Props {
  plan: PlanRow
  ctx: RowCtx
  focused: boolean
  selected: boolean
  selectable: boolean
  onToggleSelect: (id: number) => void
  onFocusPlan: (id: number) => void
}

/** Mobile (< lg) version of a plan row: same data and the same single primary action + More menu. */
export function PlanCard({ plan, ctx, focused, selected, selectable, onToggleSelect, onFocusPlan }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.row
  const [editing, setEditing] = useState(false)
  const entries = planMenuEntries(plan, ctx, () => setEditing(true))

  return (
    <article
      aria-label={plan.customName}
      className={`rounded-lg border p-3 ${focused ? 'border-brand-ring bg-info-soft' : selected ? 'border-line-2 bg-subtle' : 'border-line bg-surface'}`}
    >
      <div className="flex items-start gap-2">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(plan.id)}
            aria-label={interpolate(pa.selectPlan, { name: plan.customName })}
            className="mt-2.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
          />
        )}
        <div className="min-w-0 flex-1">
          <PlanName
            plan={plan}
            focused={focused}
            editing={editing}
            onEditingChange={setEditing}
            onFocusPlan={() => onFocusPlan(plan.id)}
            onRename={(name) => ctx.a.rename(plan, name)}
          />
        </div>
        <ActionMenu label={interpolate(pa.menuFor, { name: plan.customName })} entries={entries} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <PlanStatusBadge phase={planPhase(plan)} />
        <AuthStatusBadge phase={authPhase(plan)} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <PlanSchedulePopover plan={plan} locked={isScheduleLocked(plan)} variant="cell" onSchedule={(iso) => ctx.a.schedule(plan, iso)} />
        <PrimaryAction plan={plan} ctx={ctx} />
      </div>
    </article>
  )
}
