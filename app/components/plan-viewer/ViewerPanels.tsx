'use client'

import { useId } from 'react'
import { ChevronDown, ChevronUp, Loader2, Pause, Play, TriangleAlert, X } from 'lucide-react'
import { interpolate } from '@/app/i18n'
import { labelAltRange, type Alt } from '@/lib/altitude'
import type { PlanViewModel } from '@/lib/plan-view-model'
import { isConflicting } from '@/lib/plan-view-model'
import type { FeatureInfo, ViewerT } from './featureInfo'
import { clock, type Layers, type Palette } from './viewerStyle'

// ---- Legend ------------------------------------------------------------------------------

export interface Warning {
  id: string
  text: string
  busy?: boolean
  retry?: () => void
}

function range(alts: Alt[]): [Alt, Alt] | null {
  if (alts.length === 0) return null
  const sorted = [...alts].sort((a, b) => a.meters - b.meters)
  return [sorted[0], sorted[sorted.length - 1]]
}

/** One line per visible layer that carries heights, each with its reference ("10-122 m AGL"). */
function heightLines(model: PlanViewModel, layers: Layers, t: ViewerT): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = []
  const add = (id: string, name: string, alts: Alt[]) => {
    const r = range(alts)
    if (r) out.push({ id, text: `${name}: ${labelAltRange(r[0], r[1], t.alt)}` })
  }
  if (layers.waypoints) add('waypoints', t.layers.waypoints, model.waypoints.map((w) => w.alt))
  if (layers.trajectory) add('trajectory', t.layers.trajectory, model.trajectory.map((w) => w.alt))
  if (layers.volumes) add('volumes', t.layers.volumes, model.volumes.flatMap((v) => [v.min, v.max].filter((a): a is Alt => !!a)))
  if (layers.zones && model.zones.length > 0) out.push({ id: 'zones', text: `${t.layers.zones}: ${t.legend.zonesNote}` })
  return out
}

function Swatch({ color, line, dashed }: { color: string; line?: boolean; dashed?: boolean }) {
  return line ? (
    <span aria-hidden="true" className="inline-block w-4 shrink-0 border-t-[3px]" style={{ borderColor: color, borderTopStyle: dashed ? 'dashed' : 'solid' }} />
  ) : (
    <span aria-hidden="true" className="inline-block h-3 w-4 shrink-0 rounded-sm border" style={{ backgroundColor: color, borderColor: color }} />
  )
}

interface LegendProps {
  model: PlanViewModel
  layers: Layers
  palette: Palette
  warnings: Warning[]
  open: boolean
  onToggle: () => void
  t: ViewerT
}

/** Bottom-left of the map: swatches of the visible layers, the height reference of each, and the warnings (always visible). */
export function Legend({ model, layers, palette: p, warnings, open, onToggle, t }: LegendProps) {
  const bodyId = useId()
  const l = t.legend
  const rows: { key: string; color: string; label: string; line?: boolean; dashed?: boolean }[] = []
  if (layers.waypoints && model.waypoints.length > 0) rows.push({ key: 'takeoff', color: p.success, label: l.takeoff }, { key: 'wp', color: p.info, label: l.waypoint }, { key: 'landing', color: p.danger, label: l.landing })
  if (layers.trajectory && model.trajectory.length > 0) rows.push({ key: 'traj', color: p.accent, label: l.trajectory, line: true }, { key: 'drone', color: p.warning, label: l.drone })
  if (layers.volumes && model.volumes.length > 0) {
    if (layers.result && model.result) {
      if (model.result.status === 'approved') rows.push({ key: 'auth', color: p.success, label: l.authorized })
      else {
        if (model.volumes.some((v) => isConflicting(model.result, v))) rows.push({ key: 'conf', color: p.danger, label: l.conflicting })
        if (model.volumes.some((v) => !isConflicting(model.result, v))) rows.push({ key: 'ok', color: p.info, label: l.volume })
      }
    } else rows.push({ key: 'vol', color: p.info, label: l.volume })
  }
  if (model.zones.some((z) => layers.zones || (layers.result && z.conflicting))) rows.push({ key: 'zone', color: p.muted, label: l.zone })
  if (layers.result && model.zones.some((z) => z.conflicting)) rows.push({ key: 'zconf', color: p.danger, label: l.zoneConflicting, dashed: true })
  if (layers.scrs && model.scrs) rows.push({ key: 'cur', color: p.muted, label: l.currentRoute, line: true, dashed: true }, { key: 'alt', color: p.success, label: l.alternative, line: true })
  const heights = heightLines(model, layers, t)

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-2 sm:max-w-sm">
      {warnings.map((w) => (
        <div key={w.id} role="status" className="pointer-events-auto flex items-start gap-2 rounded-md border border-warning-line bg-surface p-2 text-xs text-warning-text shadow-theme-md">
          {w.busy ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 flex-1">{w.text}</span>
          {w.retry && (
            <button type="button" onClick={w.retry} className="-my-1 min-h-11 shrink-0 rounded px-2 font-medium text-brand-text hover:underline sm:min-h-8">
              {t.warn.retry}
            </button>
          )}
        </div>
      ))}
      {(rows.length > 0 || heights.length > 0) && (
        <section aria-label={l.title} className="pointer-events-auto rounded-md border border-line bg-surface text-xs text-fg-2 shadow-theme-md">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggle}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 font-medium text-fg hover:bg-hover sm:min-h-8"
          >
            <span>{l.title}</span>
            {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
            <span className="sr-only">{open ? l.hide : l.show}</span>
          </button>
          {open && (
            <div id={bodyId} className="max-h-[40dvh] space-y-2 overflow-y-auto border-t border-line px-3 py-2">
              <ul className="space-y-1">
                {rows.map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <Swatch color={r.color} line={r.line} dashed={r.dashed} />
                    {r.label}
                  </li>
                ))}
              </ul>
              {heights.length > 0 && (
                <div>
                  <p className="font-semibold text-fg">{l.heights}</p>
                  <ul className="mt-1 space-y-0.5">
                    {heights.map((h) => (
                      <li key={h.id}>{h.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ---- Selected feature --------------------------------------------------------------------

export function InfoCard({ info, onClose, t }: { info: FeatureInfo; onClose: () => void; t: ViewerT }) {
  return (
    <section aria-label={info.title} className="absolute right-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)] rounded-md border border-line bg-surface p-3 text-sm text-fg-2 shadow-theme-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold text-fg">{info.title}</h3>
        <button type="button" onClick={onClose} aria-label={t.info.close} className="-m-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg sm:h-8 sm:w-8">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {info.rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---- 4D time slider ----------------------------------------------------------------------

const SPEEDS = [1, 2, 5, 10]

interface TimeBarProps {
  startMs: number
  endMs: number
  timeMs: number | null
  playing: boolean
  speed: number
  onTime: (ms: number | null) => void
  onPlaying: (on: boolean) => void
  onSpeed: (s: number) => void
  t: ViewerT
}

/** Shared by 2D and 3D: lights the volumes active at that moment and moves the drone along the trajectory. */
export function TimeBar({ startMs, endMs, timeMs, playing, speed, onTime, onPlaying, onSpeed, t }: TimeBarProps) {
  const id = useId()
  const total = endMs - startMs
  const pos = timeMs == null ? 0 : Math.round(((timeMs - startMs) / total) * 1000)
  const btn = 'inline-flex min-h-11 items-center justify-center rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover sm:min-h-9'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {t.time.label}
      </label>
      <button
        type="button"
        onClick={() => {
          if (!playing && (timeMs == null || timeMs >= endMs)) onTime(startMs)
          onPlaying(!playing)
        }}
        aria-label={playing ? t.time.pause : t.time.play}
        className={`${btn} w-11 sm:w-9 sm:px-0`}
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
      <input
        id={id}
        type="range"
        min={0}
        max={1000}
        step={1}
        value={pos}
        onChange={(e) => onTime(startMs + (Number(e.target.value) / 1000) * total)}
        aria-valuetext={timeMs == null ? t.time.all : interpolate(t.time.elapsed, { t: clock(timeMs - startMs), total: clock(total) })}
        className="h-11 min-w-32 flex-1 accent-[var(--color-primary)] sm:h-9"
      />
      <span className="min-w-[8ch] text-sm tabular-nums text-fg-2">{timeMs == null ? t.time.all : interpolate(t.time.elapsed, { t: clock(timeMs - startMs), total: clock(total) })}</span>
      <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))} aria-label={t.time.speed} className="min-h-11 rounded-md border border-line-2 bg-input px-2 text-sm text-fg sm:min-h-9">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
      {timeMs != null && (
        <button type="button" onClick={() => (onPlaying(false), onTime(null))} className={btn}>
          {t.time.showAll}
        </button>
      )}
    </div>
  )
}

// ---- Details (raw FAS answer) ------------------------------------------------------------

/** The FAS message indented when it is JSON, as received otherwise. */
function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function DetailsPanel({ model, onClose, t }: { model: PlanViewModel; onClose: () => void; t: ViewerT }) {
  const r = model.result
  if (!r) return null
  const total = model.volumes.length
  const conflicts = model.volumes.filter((v) => isConflicting(r, v)).length
  const d = t.details
  const summary = r.status === 'approved' ? interpolate(d.summaryApproved, { n: total }) : r.withdrawnReason ? r.withdrawnReason : conflicts > 0 && conflicts < total ? interpolate(d.summaryConflicts, { n: conflicts, total }) : interpolate(d.summaryDenied, { n: total })
  const tone = r.status === 'approved' ? 'border-success-line bg-success-soft text-success-text' : 'border-danger-line bg-danger-soft text-danger-text'
  return (
    <section aria-label={d.title} className="absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto border-t border-line bg-surface p-4 text-sm text-fg-2 shadow-theme-lg">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-fg">{d.title}</h3>
        <button type="button" onClick={onClose} aria-label={d.hide} className="-m-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg sm:h-9 sm:w-9">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className={`mt-2 rounded-md border px-3 py-2 font-medium ${tone}`}>{summary}</p>
      {r.conflictingGeozones.length > 0 && (
        <div className="mt-3">
          <h4 className="font-semibold text-fg">{interpolate(d.conflictingZones, { n: r.conflictingGeozones.length })}</h4>
          <ul className="mt-1 space-y-1">
            {r.conflictingGeozones.map((g, i) => (
              <li key={`${g.id}-${i}`} className="rounded-md border border-line bg-subtle p-2 text-xs">
                <span className="font-mono font-semibold text-fg">{g.id}</span>
                {g.type && <span className="ml-2 text-muted">{g.type}</span>}
                {g.info && <p className="mt-0.5">{g.info}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-3 rounded-md border border-line p-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-fg sm:min-h-6">{d.rawFas}</summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-subtle p-3 font-mono text-xs text-fg">{r.text ? pretty(r.text) : d.noMessage}</pre>
      </details>
    </section>
  )
}

