'use client'

import { useId, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { DecimalInput } from '@/app/components/ui/decimal-input'
import { interpolate, useI18n } from '@/app/i18n'
import { WIND_GUST_MAX, WIND_SPEED_MAX, type Airframe, type SimulationSettings } from '@/lib/simulation'
import { INPUT } from './SchedulePopover'

type Num = number | ''
type Errors = { speed?: string; direction?: string; gust?: string }

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10'
const OPTION = 'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-ring'
const optionTone = (on: boolean) => (on ? 'border-brand-ring bg-info-soft' : 'border-line bg-surface hover:bg-hover')

interface Props {
  initial: SimulationSettings
  /** Saves the settings; resolves true when saved (the caller closes the form), false to keep it open. */
  onSubmit: (settings: SimulationSettings) => Promise<boolean>
  onCancel: () => void
}

/** Aircraft (two radio options) and wind (none / with wind: speed, direction, optional gust) of the trajectory simulation. */
export function SimulationSettingsForm({ initial, onSubmit, onCancel }: Props) {
  const { t } = useI18n()
  const s = t.planAuth.sim
  const uid = useId()
  const [airframe, setAirframe] = useState<Airframe>(initial.airframe)
  const [windy, setWindy] = useState(!!initial.wind)
  const [speed, setSpeed] = useState<Num>(initial.wind?.speed ?? '')
  const [direction, setDirection] = useState<Num>(initial.wind?.direction ?? '')
  const [gust, setGust] = useState<Num>(initial.wind?.gust ?? '')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors: Errors = {}
  if (windy) {
    if (speed === '' || !(speed > 0) || speed > WIND_SPEED_MAX) errors.speed = interpolate(s.errors.speed, { max: WIND_SPEED_MAX })
    if (direction === '' || direction < 0 || direction >= 360) errors.direction = s.errors.direction
    if (gust !== '' && (speed === '' || gust < speed || gust > WIND_GUST_MAX)) errors.gust = interpolate(s.errors.gust, { max: WIND_GUST_MAX })
  }
  const shown: Errors = attempted ? errors : {}

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    const first = Object.keys(errors)[0]
    if (first) document.getElementById(`${uid}-${first}`)?.focus() // first invalid field
    if (first || saving) return
    setSaving(true)
    try {
      const wind = windy && speed !== '' && direction !== '' ? { speed, direction, gust: gust === '' ? null : gust } : null
      await onSubmit({ airframe, wind })
    } finally {
      setSaving(false)
    }
  }

  const radio = (name: string, value: string, checked: boolean, onChange: () => void) => ({
    type: 'radio' as const,
    name: `${uid}-${name}`,
    value,
    checked,
    onChange,
    disabled: saving,
    className: 'mt-0.5 h-4 w-4 shrink-0 accent-brand',
  })

  const field = (key: keyof Errors, label: string, hint: string, value: Num, onValue: (v: Num) => void) => {
    const id = `${uid}-${key}`
    const describedBy = [`${id}-hint`, shown[key] ? `${id}-err` : null].filter(Boolean).join(' ')
    return (
      <div key={key}>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg-2">
          {label}
        </label>
        <DecimalInput
          id={id}
          name={key}
          value={value}
          onValue={onValue}
          disabled={saving}
          aria-invalid={shown[key] ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT} min-h-11 sm:min-h-0`}
        />
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
        {shown[key] && (
          <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger-text">
            {shown[key]}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={saving} className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium text-fg-2">{s.airframeLabel}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['multirotor', 'fixedwing'] as const).map((a) => (
            <label key={a} className={`${OPTION} ${optionTone(airframe === a)}`}>
              <input {...radio('airframe', a, airframe === a, () => setAirframe(a))} />
              <span>
                <span className="block font-medium text-fg">{s[a]}</span>
                <span className="block text-xs text-fg-2">{s[`${a}Hint`]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={saving} className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium text-fg-2">{s.windLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {([false, true] as const).map((on) => (
            <label key={String(on)} className={`${OPTION} min-h-11 items-center sm:min-h-0 ${optionTone(windy === on)}`}>
              <input {...radio('wind', String(on), windy === on, () => setWindy(on))} className="h-4 w-4 shrink-0 accent-brand" />
              <span className="font-medium text-fg">{on ? s.withWind : s.noWind}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {windy && (
        <div className="grid gap-3 sm:grid-cols-3">
          {field('speed', s.speed, interpolate(s.speedHint, { max: WIND_SPEED_MAX }), speed, setSpeed)}
          {field('direction', s.direction, s.directionHint, direction, setDirection)}
          {field('gust', s.gust, interpolate(s.gustHint, { max: WIND_GUST_MAX }), gust, setGust)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={`${BTN} bg-brand text-brand-fg hover:bg-brand-hover`}>
          {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {saving ? s.saving : s.save}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className={`${BTN} border border-line-2 bg-surface text-fg hover:bg-hover`}>
          {s.cancel}
        </button>
      </div>
    </form>
  )
}
