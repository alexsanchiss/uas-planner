'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { ActionMenu } from './ActionMenu'
import { authPhase, isScheduleLocked, planPhase, startPlanDrag, type PlanRow as Plan } from './lib'
import { PlanName } from './PlanName'
import { PrimaryAction } from './PrimaryAction'
import { planMenuEntries, type RowCtx } from './rowActions'
import { PlanSchedulePopover } from './SchedulePopover'
import { AuthStatusBadge, PlanStatusBadge } from './StatusBadge'

export type SortKey = 'name' | 'scheduled'
export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

interface RowProps {
  plan: Plan
  ctx: RowCtx
  focused: boolean
  selected: boolean
  selectable: boolean
  onToggleSelect: (id: number) => void
  onFocusPlan: (id: number) => void
}

function PlanTableRow({ plan, ctx, focused, selected, selectable, onToggleSelect, onFocusPlan }: RowProps) {
  const { t } = useI18n()
  const pa = t.planAuth.row
  const [editing, setEditing] = useState(false)
  const entries = planMenuEntries(plan, ctx, () => setEditing(true))

  return (
    <tr
      draggable={!editing}
      onDragStart={(e) => (editing ? e.preventDefault() : startPlanDrag(e, plan))}
      className={`align-middle ${focused ? 'bg-info-soft' : selected ? 'bg-subtle' : 'hover:bg-hover'}`}
    >
      {selectable && (
        <td className="w-10 py-2 pl-3 pr-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(plan.id)}
            aria-label={interpolate(pa.selectPlan, { name: plan.customName })}
            className="h-4 w-4 cursor-pointer accent-brand"
          />
        </td>
      )}
      <th scope="row" className="min-w-48 max-w-xs py-2 pl-3 pr-2 text-left font-normal">
        <div className="flex min-w-0 items-center gap-1">
          <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <PlanName
            plan={plan}
            focused={focused}
            editing={editing}
            onEditingChange={setEditing}
            onFocusPlan={() => onFocusPlan(plan.id)}
            onRename={(name) => ctx.a.rename(plan, name)}
          />
        </div>
      </th>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          <PlanStatusBadge phase={planPhase(plan)} />
          <AuthStatusBadge phase={authPhase(plan)} />
        </div>
      </td>
      <td className="px-2 py-2">
        <PlanSchedulePopover plan={plan} locked={isScheduleLocked(plan)} variant="cell" onSchedule={(iso) => ctx.a.schedule(plan, iso)} />
      </td>
      <td className="py-2 pl-2 pr-3">
        <div className="flex items-center justify-end gap-1">
          <PrimaryAction plan={plan} ctx={ctx} />
          <ActionMenu label={interpolate(pa.menuFor, { name: plan.customName })} entries={entries} />
        </div>
      </td>
    </tr>
  )
}

interface Props {
  plans: Plan[]
  ctx: RowCtx
  sort: SortState | null
  onSort: (key: SortKey) => void
  focusedId: number | null
  selectedIds: ReadonlySet<number>
  selectable: boolean
  onToggleSelect: (id: number) => void
  /** Select / deselect every row of the page. */
  onTogglePage: (select: boolean) => void
  onFocusPlan: (id: number) => void
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 items-center gap-1 rounded-md px-1 font-medium hover:text-fg">
      {label}
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

/** Desktop plan list as an accessible table (column scopes, aria-sort on the sortable columns). */
export function PlanTable({ plans, ctx, sort, onSort, focusedId, selectedIds, selectable, onToggleSelect, onTogglePage, onFocusPlan }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.table
  const allSelected = plans.length > 0 && plans.every((p) => selectedIds.has(p.id))
  const someSelected = plans.some((p) => selectedIds.has(p.id))
  const master = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (master.current) master.current.indeterminate = someSelected && !allSelected
  }, [someSelected, allSelected])

  const ariaSort = (key: SortKey) => (sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none')

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{pa.caption}</caption>
        <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-fg-2">
          <tr>
            {selectable && (
              <th scope="col" className="w-10 py-2 pl-3 pr-1 text-left">
                <input
                  ref={master}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onTogglePage(e.target.checked)}
                  aria-label={pa.selectPage}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
              </th>
            )}
            <th scope="col" aria-sort={ariaSort('name')} className="py-1 pl-3 pr-2 text-left">
              <SortHeader label={pa.name} active={sort?.key === 'name'} dir={sort?.dir ?? 'asc'} onClick={() => onSort('name')} />
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {pa.status}
            </th>
            <th scope="col" aria-sort={ariaSort('scheduled')} className="px-2 py-1 text-left">
              <SortHeader label={pa.scheduled} active={sort?.key === 'scheduled'} dir={sort?.dir ?? 'asc'} onClick={() => onSort('scheduled')} />
            </th>
            <th scope="col" className="py-2 pl-2 pr-3 text-right font-medium">
              {pa.actions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {plans.map((plan) => (
            <PlanTableRow
              key={plan.id}
              plan={plan}
              ctx={ctx}
              focused={focusedId === plan.id}
              selected={selectedIds.has(plan.id)}
              selectable={selectable}
              onToggleSelect={onToggleSelect}
              onFocusPlan={onFocusPlan}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
