'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useI18n } from '@/app/i18n'

interface Props {
  initial: string
  /** Accessible name of the input. */
  label: string
  /** Error text for an invalid (trimmed) name, null when it is fine. */
  validate: (name: string) => string | null
  /** Resolves true when saved. */
  onSubmit: (name: string) => Promise<boolean>
  /** Called after a save, an unchanged name or Escape / Cancel. */
  onClose: () => void
}

const ICON_BTN = 'inline-flex h-11 w-11 shrink-0 lg:h-9 lg:w-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg disabled:opacity-50'

/** Inline rename (plan and folder names): Enter saves, Escape cancels, the error is announced under the input. */
export function InlineNameForm({ initial, label, validate, onSubmit, onClose }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const errId = useId()

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.trim()
    const invalid = validate(name)
    if (invalid) return setError(invalid)
    if (name === initial) return onClose()
    setSaving(true)
    const ok = await onSubmit(name)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <form onSubmit={submit} className="min-w-0">
      <div className="flex items-center gap-1">
        <input
          ref={input}
          value={draft}
          disabled={saving}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
          }}
          className="min-w-0 flex-1 rounded-md border border-input bg-input px-2 py-1.5 text-base text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring sm:text-sm"
        />
        <button type="submit" className={ICON_BTN} disabled={saving} aria-label={t.common.save}>
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={ICON_BTN} disabled={saving} aria-label={t.common.cancel} onClick={onClose}>
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
