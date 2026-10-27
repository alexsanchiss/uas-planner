'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
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

/** Plan name: a button that focuses the plan, with an inline rename (Enter saves, Escape cancels). */
export function PlanName({ plan, focused, editing, onEditingChange, onFocusPlan, onRename }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.row
  const [draft, setDraft] = useState(plan.customName)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const errId = useId()

  useEffect(() => {
    if (editing) {
      setDraft(plan.customName)
      setError('')
      input.current?.focus()
      input.current?.select()
    }
  }, [editing, plan.customName])

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return setError(t.planAuth.row.nameEmpty)
    if (name.length > 100) return setError(t.planAuth.row.nameTooLong)
    if (name === plan.customName) return onEditingChange(false)
    setSaving(true)
    const ok = await onRename(name)
    setSaving(false)
    if (ok) onEditingChange(false)
  }

  return (
    <form onSubmit={submit} className="min-w-0">
      <div className="flex items-center gap-1">
        <input
          ref={input}
          value={draft}
          disabled={saving}
          aria-label={pa.nameLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onEditingChange(false)
          }}
          className="min-w-0 flex-1 rounded-md border border-input bg-input px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring"
        />
        <button type="submit" className={ICON_BTN} disabled={saving} aria-label={t.common.save}>
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={ICON_BTN} disabled={saving} aria-label={t.common.cancel} onClick={() => onEditingChange(false)}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p id={errId} role="alert" className="mt-1 text-xs text-danger-text">
          {error}
        </p>
      )}
    </form>
  )
}
