'use client'

import { useId, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { CalendarClock, Loader2, Lock } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { formatDateTime, fromLocalInput, toLocalInput, type PlanRow } from './lib'

export const POPUP =
  'w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface-elevated p-4 text-fg shadow-theme-md outline-none'
export const INPUT =
  'w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-60'
const BTN =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_PRIMARY = `${BTN} bg-brand text-brand-fg hover:bg-brand-hover`
export const BTN_SECONDARY = `${BTN} border border-line-2 bg-surface text-fg hover:bg-hover`

function nowLocal(): string {
  return toLocalInput(new Date().toISOString())
}

export function TimezoneHint() {
  const { t } = useI18n()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return <p className="mt-1 text-xs text-muted">{interpolate(t.planAuth.schedule.timezone, { tz })}</p>
}

interface FieldProps {
  value: string | null
  label: string
  disabled?: boolean
  /** Saves the new UTC ISO instant (null = clear). */
  onSave: (iso: string | null) => Promise<boolean | void> | boolean | void
  onPastError?: (message: string) => void
}

/** datetime-local input with explicit Save / Clear (no autosave while typing). Past instants are rejected. */
export function ScheduleField({ value, label, disabled, onSave, onPastError }: FieldProps) {
  const { t } = useI18n()
  const pa = t.planAuth.schedule
  const id = useId()
  const [draft, setDraft] = useState(toLocalInput(value))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const run = async (iso: string | null) => {
    setSaving(true)
    try {
      await onSave(iso)
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    const iso = fromLocalInput(draft)
    if (!iso) {
      setError(pa.required)
      return
    }
    if (new Date(iso) < new Date()) {
      setError(pa.pastError)
      onPastError?.(pa.pastError)
      return
    }
    setError('')
    void run(iso)
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg-2">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={draft}
        min={nowLocal()}
        disabled={disabled || saving}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => {
          setDraft(e.target.value)
          setError('')
        }}
        className={INPUT}
      />
      <TimezoneHint />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger-text">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={disabled || saving || !draft} onClick={save}>
          {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {pa.save}
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={disabled || saving || !value}
          onClick={() => {
            setDraft('')
            setError('')
            void run(null)
          }}
        >
          {pa.clear}
        </button>
      </div>
    </div>
  )
}

interface PlanProps {
  plan: PlanRow
  locked: boolean
  /** 'primary' = the row's contextual primary action (set a time); 'cell' = the scheduled-time cell. */
  variant: 'primary' | 'cell'
  onSchedule: (iso: string | null) => Promise<boolean>
  onPastError?: (message: string) => void
}

/** Schedule one plan from a popover. Locked once processing started (shows the time as plain text). */
export function PlanSchedulePopover({ plan, locked, variant, onSchedule, onPastError }: PlanProps) {
  const { t, language } = useI18n()
  const pa = t.planAuth.schedule
  const [open, setOpen] = useState(false)
  const when = formatDateTime(plan.scheduledAt, language)

  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-fg-2" title={pa.locked}>
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {when || '-'}
      </span>
    )
  }

  const trigger =
    variant === 'primary'
      ? `${BTN_PRIMARY} whitespace-nowrap`
      : 'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-fg-2 hover:bg-hover hover:text-fg'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={trigger} aria-label={interpolate(pa.editFor, { name: plan.customName })}>
        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
        {variant === 'primary' ? pa.setTime : when || pa.setTime}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-40" sideOffset={4} align="end">
          <Popover.Popup className={POPUP}>
            <Popover.Title className="mb-3 text-sm font-semibold">{pa.title}</Popover.Title>
            <ScheduleField
              value={plan.scheduledAt}
              label={pa.label}
              onPastError={onPastError}
              onSave={async (iso) => {
                if (await onSchedule(iso)) setOpen(false)
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
