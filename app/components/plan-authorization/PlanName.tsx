'use client'

import { Pencil } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { InlineNameForm } from './InlineNameForm'
import type { PlanRow } from './lib'

interface Props {
  plan: PlanRow
  focused: boolean
  editing: boolean
  onEditingChange: (editing: boolean) => void
  /** Click on the name: focus the plan (detail panel). */
  onFocusPlan: () => void
  /** Resolves true when saved. */
  onRename: (name: string) => Promise<boolean>
}

const ICON_BTN = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg disabled:opacity-50'

/** Plan name (Dev table / cards): a button that focuses the plan, with an inline rename (Enter saves, Escape cancels). */
export function PlanName({ plan, focused, editing, onEditingChange, onFocusPlan, onRename }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.row

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-pressed={focused}
          title={pa.openDetails}
          onClick={onFocusPlan}
          className={`min-w-0 truncate rounded-md px-1 py-1 text-left text-sm font-medium hover:text-brand-text ${focused ? 'text-brand-text' : 'text-fg'}`}
        >
          {plan.customName}
        </button>
        <button type="button" className={ICON_BTN} aria-label={interpolate(pa.renameFor, { name: plan.customName })} onClick={() => onEditingChange(true)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <InlineNameForm
      initial={plan.customName}
      label={pa.nameLabel}
      validate={(name) => (!name ? pa.nameEmpty : name.length > 100 ? pa.nameTooLong : null)}
      onSubmit={onRename}
      onClose={() => onEditingChange(false)}
    />
  )
}
