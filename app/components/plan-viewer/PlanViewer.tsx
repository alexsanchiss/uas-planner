'use client'

/**
 * The ONE plan viewer (replaces the eleven viewer modals): header with the 2D | 3D toggle, layer chips (only the ones the
 * plan has data for), the map with its legend, the shared 4D time slider and the SCRS actions. 2D (Leaflet) is the default;
 * 3D (Cesium) loads on demand and lives only while it is shown. Altitude rules: lib/altitude.ts and lib/plan-view-model.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { FileText, Loader2, X } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { Modal } from '@/app/components/ui/modal'
import { useGeoawarenessWebSocket } from '@/app/hooks/useGeoawarenessWebSocket'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { apiJson } from '@/lib/api-client'
import { geoidNFor } from '@/lib/altitude'
import { buildPlanViewModel } from '@/lib/plan-view-model'
import { parseWaypointsFromPlan, uspaceOf, type AuthPhase, type PlanPhase } from '@/app/components/plan-authorization/lib'
import { AuthStatusBadge, PlanStatusBadge } from '@/app/components/plan-authorization/StatusBadge'
import { describeFeature } from './featureInfo'
import MapView2D from './MapView2D'
import type { Status3D } from './MapView3D'
import { DetailsPanel, InfoCard, Legend, TimeBar, type Warning } from './ViewerPanels'
import { initialLayers, LAYER_IDS, usePalette, zoneShown, type Layers, type LayerId, type Palette, type Preset } from './viewerStyle'

// Cesium (20 MB of assets) is only fetched when the user picks 3D.
const MapView3D = dynamic(() => import('./MapView3D'), { ssr: false })

/** What the opener read with its single GET /api/flightPlans/[id]. */
export interface ViewerDetail {
  fileContent: string | null
  /** Parsed U-plan. */
  uplan: unknown
  geoawarenessData: unknown
  authorizationMessage: string | null
  /** The plan has a processed trajectory (the CSV is only fetched when the Trajectory layer is on). */
  hasCsv: boolean
}

export interface PlanViewerProps {
  preset: Preset
  planId: number
  planName: string
  plan: PlanPhase
  auth: AuthPhase
  detail: ViewerDetail
  onClose: () => void
  /** "Accept alternative" is running. */
  accepting: boolean
  onAcceptScrs: () => void
}

type CsvState = { text: string | null; status: 'idle' | 'loading' | 'ready' | 'error' }

/** Trajectory CSV, fetched the first time its layer is switched on. */
function useTrajectoryCsv(planId: number, enabled: boolean) {
  const [state, setState] = useState<CsvState>({ text: null, status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const loaded = useRef(false)
  useEffect(() => {
    if (!enabled || loaded.current) return
    let dead = false
    setState({ text: null, status: 'loading' })
    apiJson<{ csvResult?: string }>(`/api/csvResult?id=${planId}`)
      .then((r) => {
        if (dead) return
        loaded.current = true
        setState({ text: r.csvResult ?? '', status: 'ready' })
      })
      .catch(() => !dead && setState({ text: null, status: 'error' }))
    return () => {
      dead = true
    }
  }, [enabled, planId, attempt])
  return { ...state, retry: () => setAttempt((a) => a + 1) }
}

const CHIP_COLOR: Record<LayerId, keyof Palette> = { waypoints: 'info', trajectory: 'accent', volumes: 'info', zones: 'warning', result: 'danger', scrs: 'success' }

export default function PlanViewer({ preset, planId, planName, plan, auth, detail, onClose, accepting, onAcceptScrs }: PlanViewerProps) {
  const { t } = useI18n()
  const vt = t.planAuth.viewer
  const palette = usePalette()
  const wide = useMediaQuery('(min-width: 640px)')

  const [view, setView] = useState<'2d' | '3d'>('2d')
  const waypoints = useMemo(() => parseWaypointsFromPlan(detail.fileContent), [detail.fileContent])
  const uspaceId = useMemo(() => uspaceOf(detail.geoawarenessData), [detail.geoawarenessData])
  const authStatus = auth === 'approved' ? 'approved' : auth === 'denied' ? 'denied' : auth === 'withdrawn' ? 'withdrawn' : null
  const liveSpace = !!uspaceId && uspaceId !== 'GLOBAL_U_SPACE'

  // What the plan has (decides the chips and the initial layers): the model without the lazy data
  const base = useMemo(
    () => buildPlanViewModel({ waypoints, uplan: detail.uplan, csv: null, authorizationMessage: detail.authorizationMessage, authStatus, geoawarenessData: detail.geoawarenessData, liveZones: [], uspaceId }),
    [waypoints, detail, authStatus, uspaceId]
  )
  const has: Layers = {
    waypoints: base.waypoints.length > 0,
    trajectory: detail.hasCsv,
    volumes: base.volumes.length > 0,
    zones: liveSpace || base.zones.length > 0,
    result: !!base.result,
    scrs: !!base.scrs,
  }
  const [layers, setLayers] = useState<Layers>(() => initialLayers(preset, has))

  const csv = useTrajectoryCsv(planId, layers.trajectory && has.trajectory)
  // Live geozones: when the Geozones layer is on, and for the Result layer when FAS named conflicting geozones that
  // carry no geometry of their own (otherwise they could not be highlighted)
  const zonesForResult = layers.result && !!base.result && base.result.conflictingGeozones.some((g) => !base.zones.some((z) => z.id === g.id))
  const zonesOn = liveSpace && (layers.zones || zonesForResult)
  const geo = useGeoawarenessWebSocket({ uspaceId: zonesOn ? uspaceId : null, enabled: zonesOn, enableFallback: false, maxRetries: 3 })
  const liveZones = useMemo<unknown[]>(() => geo.data?.geozones_data ?? [], [geo.data])

  const model = useMemo(
    () => buildPlanViewModel({ waypoints, uplan: detail.uplan, csv: csv.text, authorizationMessage: detail.authorizationMessage, authStatus, geoawarenessData: detail.geoawarenessData, liveZones, uspaceId }),
    [waypoints, detail, csv.text, authStatus, liveZones, uspaceId]
  )

  // 4D slider: one clock for the lit volumes and the drone
  const timeline = model.timeline && model.timeline.endMs > model.timeline.startMs && (layers.volumes || layers.trajectory) ? model.timeline : null
  const [timeMs, setTimeMs] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const timeRef = useRef(timeMs)
  timeRef.current = timeMs
  const start = timeline?.startMs
  const end = timeline?.endMs
  useEffect(() => {
    if (start == null) setPlaying(false) // the slider went away (its layers were switched off)
  }, [start])
  useEffect(() => {
    if (!playing || start == null || end == null) return
    const id = setInterval(() => {
      const next = (timeRef.current ?? start) + 100 * speed
      if (next >= end) {
        setPlaying(false)
        setTimeMs(end)
      } else setTimeMs(next)
    }, 100)
    return () => clearInterval(id)
  }, [playing, speed, start, end])

  const [selected, setSelected] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState<boolean | null>(null)
  const [st3d, setSt3d] = useState<Status3D>({ terrainDown: false, skippedZones: 0 })
  const onStatus = useCallback((s: Status3D) => setSt3d(s), [])
  const info = describeFeature(selected, model, vt)

  const toggle = (id: LayerId) => setLayers((l) => ({ ...l, [id]: !l[id] }))

  // Warnings live in the legend block (visible even when the legend is collapsed)
  const warnings: Warning[] = []
  if (view === '3d') {
    if (st3d.terrainDown) warnings.push({ id: 'terrain', text: vt.warn.terrain })
    else if (st3d.skippedZones > 0) warnings.push({ id: 'skipped', text: interpolate(vt.warn.zonesSkipped, { n: st3d.skippedZones }) })
    const amsl = model.zones.some((z) => zoneShown(z, layers) && (z.lower.ref === 'AMSL' || z.upper.ref === 'AMSL'))
    if (amsl && geoidNFor(uspaceId) == null) warnings.push({ id: 'geoid', text: vt.warn.geoid })
  }
  if (zonesOn && !geo.data) {
    if (geo.status === 'error') warnings.push({ id: 'zones', text: vt.warn.zonesError, retry: geo.reconnect })
    else warnings.push({ id: 'zones', text: vt.warn.zonesLoading, busy: true })
  }
  if (layers.trajectory && has.trajectory) {
    if (csv.status === 'loading') warnings.push({ id: 'csv', text: vt.warn.trajectoryLoading, busy: true })
    else if (csv.status === 'error') warnings.push({ id: 'csv', text: vt.warn.trajectoryError, retry: csv.retry })
  }

  const seg = (on: boolean) =>
    `min-h-11 flex-1 rounded px-4 text-sm font-medium sm:min-h-9 sm:flex-none ${on ? 'bg-brand text-brand-fg' : 'text-fg-2 hover:bg-hover hover:text-fg'}`

  return (
    <Modal open onClose={onClose} title={interpolate(vt.title, { name: planName })} maxWidth="full" fullscreen>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <div className="order-1 min-w-0 flex-1 basis-40">
          <p className="truncate text-base font-semibold text-fg" title={planName}>
            {planName}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <PlanStatusBadge phase={plan} />
            <AuthStatusBadge phase={auth} />
          </div>
        </div>
        <div role="group" aria-label={vt.mode.label} className="order-3 flex basis-full gap-0.5 rounded-md border border-line-2 p-0.5 sm:order-2 sm:basis-auto">
          <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')} className={seg(view === '2d')}>
            {vt.mode.d2}
          </button>
          <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')} className={seg(view === '3d')}>
            {vt.mode.d3}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={vt.close}
          className="order-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg sm:order-3 sm:h-9 sm:w-9"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div role="group" aria-label={vt.layers.label} className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2">
        {LAYER_IDS.filter((id) => has[id]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={layers[id]}
            onClick={() => toggle(id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-medium sm:min-h-9 ${layers[id] ? 'border-info-line bg-info-soft text-info-text' : 'border-line-2 bg-surface text-fg-2 hover:bg-hover'}`}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[CHIP_COLOR[id]], opacity: layers[id] ? 1 : 0.45 }} />
            {vt.layers[id]}
            {id === 'trajectory' && layers.trajectory && csv.status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          </button>
        ))}
        {has.result && (
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((o) => !o)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line-2 bg-surface px-3 text-sm font-medium text-fg-2 hover:bg-hover sm:min-h-9"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {vt.details.title}
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 isolate">
          {view === '2d' ? (
            <MapView2D model={model} layers={layers} palette={palette} timeMs={timeMs} selected={selected} onSelect={setSelected} />
          ) : (
            <MapView3D model={model} layers={layers} palette={palette} timeMs={timeMs} onSelect={setSelected} onStatus={onStatus} />
          )}
        </div>
        {info && <InfoCard info={info} onClose={() => setSelected(null)} t={vt} />}
        <Legend model={model} layers={layers} palette={palette} warnings={warnings} open={legendOpen ?? wide} onToggle={() => setLegendOpen(!(legendOpen ?? wide))} t={vt} />
        {detailsOpen && <DetailsPanel model={model} onClose={() => setDetailsOpen(false)} t={vt} />}
      </div>

      {layers.scrs && model.scrs && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
          <p className="min-w-0 flex-1 basis-56 text-sm text-fg-2">{vt.scrs.hint}</p>
          <button
            type="button"
            onClick={() => toggle('scrs')}
            disabled={accepting}
            className="inline-flex min-h-11 items-center rounded-md border border-line-2 bg-surface px-4 text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
          >
            {vt.scrs.reject}
          </button>
          <button
            type="button"
            onClick={onAcceptScrs}
            disabled={accepting}
            aria-busy={accepting || undefined}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-success px-4 text-sm font-medium text-success-fg hover:bg-success-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
          >
            {accepting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {accepting ? vt.scrs.accepting : vt.scrs.accept}
          </button>
        </div>
      )}
      {timeline && (
        <div className="border-t border-line pb-[env(safe-area-inset-bottom)]">
          <TimeBar startMs={timeline.startMs} endMs={timeline.endMs} timeMs={timeMs} playing={playing} speed={speed} onTime={setTimeMs} onPlaying={setPlaying} onSpeed={setSpeed} t={vt} />
        </div>
      )}
    </Modal>
  )
}
