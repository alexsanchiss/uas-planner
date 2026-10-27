/**
 * Pure helpers of the plan-authorization tree: status mapping, filters, the workflow state
 * machine (moved here from flight-plans/ProcessingWorkflow so the tree owns it), JSON parsing
 * and the .plan waypoint extraction. No React runtime, no network.
 */

import type { DragEvent } from 'react'
import type { FlightPlanSummary } from '@/app/hooks/useFlightPlans'
import { parseScrsAlternative } from '@/lib/scrs'

export type Mode = 'dev' | 'prod'
/** Row of the summary listing (no fileContent / uplan; see hasFileContent / hasUplan). */
export type PlanRow = FlightPlanSummary

/** MIME of the plan drag-and-drop payload (kept from the old prod uploader). */
export const PLAN_DRAG_TYPE = 'application/x-flight-plan'
export interface PlanDragData {
  planId: number
  planName: string
  sourceFolderId: number | null
}

/** HTML5 drag payload of a plan (dropped on a folder, or on "plans without folder"). */
export function startPlanDrag(e: DragEvent, plan: Pick<PlanRow, 'id' | 'customName' | 'folderId'>) {
  const data: PlanDragData = { planId: plan.id, planName: plan.customName, sourceFolderId: plan.folderId }
  e.dataTransfer.setData(PLAN_DRAG_TYPE, JSON.stringify(data))
  e.dataTransfer.setData('text/plain', plan.customName)
  e.dataTransfer.effectAllowed = 'move'
}

/** Client-side page size of the plan list (old Dev value). */
export const PAGE_SIZE = 25

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  type?: 'takeoff' | 'cruise' | 'landing'
}

// ---- Status mapping -------------------------------------------------------------------

export type PlanPhase = 'idle' | 'queued' | 'processing' | 'done' | 'error'
export type AuthPhase = 'none' | 'pending' | 'approved' | 'denied' | 'withdrawn'

export function planPhase(p: Pick<PlanRow, 'status'>): PlanPhase {
  switch (p.status) {
    case 'en cola':
      return 'queued'
    case 'procesando':
      return 'processing'
    case 'procesado':
      return 'done'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

/** 'procesando autorización' is the Dev bulk marker; it counts as pending. */
export function authPhase(p: Pick<PlanRow, 'authorizationStatus'>): AuthPhase {
  const s = p.authorizationStatus as string | null
  if (s === 'pendiente' || s === 'procesando autorización') return 'pending'
  if (s === 'aprobado') return 'approved'
  if (s === 'denegado') return 'denied'
  if (s === 'withdrawn') return 'withdrawn'
  return 'none'
}

/** Text of an authorizationMessage that may be stored as string or as parsed JSON. */
export function messageText(message: unknown): string | null {
  if (typeof message === 'string') return message || null
  return message != null ? JSON.stringify(message) : null
}

export function hasScrsAlternative(p: Pick<PlanRow, 'authorizationMessage'>): boolean {
  const text = messageText(p.authorizationMessage)
  return text ? parseScrsAlternative(text) !== null : false
}

/** Hidden flag the accept-alternative route writes (plan goes back to 'sin procesar'). */
export const ACCEPTED_ALTERNATIVE = 'ACCEPTED_ALTERNATIVE'

// ---- Status chips / filters ----------------------------------------------------------

export type StatusFilter =
  | 'unprocessed'
  | 'queued'
  | 'processing'
  | 'processed'
  | 'error'
  | 'authorized'
  | 'denied'
  | 'alternatives'

export const STATUS_FILTERS: StatusFilter[] = [
  'unprocessed',
  'queued',
  'processing',
  'processed',
  'error',
  'authorized',
  'denied',
  'alternatives',
]

export function matchesFilter(p: PlanRow, f: StatusFilter): boolean {
  switch (f) {
    case 'unprocessed':
      return planPhase(p) === 'idle'
    case 'queued':
      return planPhase(p) === 'queued'
    case 'processing':
      return planPhase(p) === 'processing'
    case 'processed':
      return planPhase(p) === 'done'
    case 'error':
      return planPhase(p) === 'error'
    case 'authorized':
      return authPhase(p) === 'approved'
    case 'denied': {
      const a = authPhase(p)
      return a === 'denied' || a === 'withdrawn'
    }
    case 'alternatives':
      return hasScrsAlternative(p)
  }
}

export function countFilters(plans: PlanRow[]): Record<StatusFilter, number> {
  const out = Object.fromEntries(STATUS_FILTERS.map((f) => [f, 0])) as Record<StatusFilter, number>
  for (const p of plans) for (const f of STATUS_FILTERS) if (matchesFilter(p, f)) out[f]++
  return out
}

/** "Select by status" options of the Dev toolbar (P-21): the chip filters minus alternatives, plus 'noauth'. */
export type SelectKey = 'all' | 'noauth' | Exclude<StatusFilter, 'alternatives'>
export const SELECT_KEYS: SelectKey[] = [
  'all',
  'unprocessed',
  'queued',
  'processing',
  'processed',
  'error',
  'noauth',
  'authorized',
  'denied',
]

export function matchesSelectKey(p: PlanRow, k: SelectKey): boolean {
  if (k === 'all') return true
  if (k === 'noauth') return authPhase(p) === 'none'
  return matchesFilter(p, k)
}

// ---- Workflow state machine ----------------------------------------------------------

export type WorkflowState =
  | 'unprocessed'
  | 'processing'
  | 'processed'
  | 'authorizing'
  | 'authorized'
  | 'denied'
  | 'error'

export type WorkflowStep = 'select' | 'datetime' | 'process' | 'geoawareness' | 'authorize'
export const WORKFLOW_STEPS: WorkflowStep[] = ['select', 'datetime', 'process', 'geoawareness', 'authorize']

/** Same mapping as the old getWorkflowState (en cola / procesando = processing); withdrawn counts as denied. */
export function getWorkflowState(p: PlanRow): WorkflowState {
  const phase = planPhase(p)
  if (phase === 'error') return 'error'
  if (phase === 'done') {
    switch (authPhase(p)) {
      case 'approved':
        return 'authorized'
      case 'denied':
      case 'withdrawn':
        return 'denied'
      case 'pending':
        return 'authorizing'
      default:
        return 'processed'
    }
  }
  if (phase === 'queued' || phase === 'processing') return 'processing'
  return 'unprocessed'
}

/** Processing has started (or an alternative was accepted): scheduledAt is locked (P-36). */
export function isScheduleLocked(p: PlanRow): boolean {
  const acceptedAlternative = planPhase(p) === 'idle' && p.authorizationMessage === ACCEPTED_ALTERNATIVE
  return getWorkflowState(p) !== 'unprocessed' || acceptedAlternative
}

/** Current step of the 5-step guide (old getCurrentStep). */
export function currentStep(p: PlanRow | null): WorkflowStep {
  if (!p) return 'select'
  const phase = planPhase(p)
  // Where the plan is, whatever its scheduledAt (an imported U-plan is processed without one): the stepper, the
  // list rows and the mobile progress bar all read this (planProgress below maps it to 1..5).
  if (phase === 'queued' || phase === 'processing') return 'process'
  if (phase === 'done') {
    const a = authPhase(p)
    return a === 'none' ? 'geoawareness' : a === 'pending' ? 'authorize' : 'select'
  }
  if (!p.scheduledAt) return 'datetime'
  return phase === 'idle' ? 'process' : 'select'
}

/** Completed steps of the 5-step guide (old getCompletedSteps). */
export function completedSteps(p: PlanRow | null): WorkflowStep[] {
  if (!p) return []
  const done: WorkflowStep[] = ['select']
  const phase = planPhase(p)
  const a = authPhase(p)
  if (p.scheduledAt) done.push('datetime')
  if (phase === 'done' || phase === 'queued' || phase === 'processing') done.push('process')
  if (phase === 'done' && a !== 'none') done.push('geoawareness')
  if (a === 'approved' || a === 'denied' || a === 'withdrawn') done.push('authorize')
  return done
}

export type PrimaryId = 'schedule' | 'process' | 'processing' | 'reset' | 'requestAuth' | 'awaitingFas' | 'viewResult'

/** The ONE contextual primary action of a row: the next step of the workflow. */
export function primaryActionId(p: PlanRow): PrimaryId | null {
  switch (getWorkflowState(p)) {
    case 'unprocessed':
      if (!p.hasFileContent) return null
      return p.scheduledAt ? 'process' : 'schedule'
    case 'processing':
      return 'processing'
    case 'error':
      return 'reset'
    case 'processed':
      return 'requestAuth'
    case 'authorizing':
      return 'awaitingFas'
    case 'authorized':
    case 'denied':
      return 'viewResult'
  }
}

/** The user can act on this plan now (set a time, process, request authorization, reset). */
export function needsAction(p: PlanRow): boolean {
  const id = primaryActionId(p)
  return id === 'schedule' || id === 'process' || id === 'requestAuth' || id === 'reset'
}

export type ProgressKind = 'noFile' | 'step' | 'processing' | 'authorizing' | 'approved' | 'denied' | 'withdrawn' | 'error'
export interface PlanProgress {
  kind: ProgressKind
  /** Position in the 5-step guide (1..5). */
  step: 1 | 2 | 3 | 4 | 5
}

/** Where the plan is in the guide, for the list rows and the mobile progress bar (production workspace). */
export function planProgress(p: PlanRow): PlanProgress {
  switch (getWorkflowState(p)) {
    case 'unprocessed':
      if (!p.hasFileContent) return { kind: 'noFile', step: 1 }
      return { kind: 'step', step: currentStep(p) === 'datetime' ? 2 : 3 }
    case 'processing':
      return { kind: 'processing', step: 3 }
    case 'processed':
      return { kind: 'step', step: 4 }
    case 'authorizing':
      return { kind: 'authorizing', step: 5 }
    case 'authorized':
      return { kind: 'approved', step: 5 }
    case 'denied':
      return { kind: authPhase(p) === 'withdrawn' ? 'withdrawn' : 'denied', step: 5 }
    case 'error':
      return { kind: 'error', step: 3 }
  }
}

// ---- JSON / waypoints ----------------------------------------------------------------

/** Parse a value that may be an object or a (possibly double-encoded) JSON string. */
export function parseJson<T = Record<string, unknown>>(value: unknown): T | null {
  let v = value
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  return v && typeof v === 'object' ? (v as T) : null
}

export type UplanData = { operationVolumes?: unknown[]; [key: string]: unknown }

export function hasVolumes(uplan: UplanData | null): boolean {
  return Array.isArray(uplan?.operationVolumes) && uplan.operationVolumes.length > 0
}

/** Waypoints of a QGC .plan (mission items with >= 7 params), as the old card preview parsed them. */
export function parseWaypointsFromPlan(fileContent?: string | null): Waypoint[] {
  if (!fileContent) return []
  try {
    const plan = JSON.parse(fileContent)
    const items: { params?: number[]; Altitude?: number }[] = plan?.mission?.items || []
    return items
      .filter((item) => item.params && item.params.length >= 7)
      .map((item, idx, arr) => ({
        lat: item.params![4],
        lng: item.params![5],
        alt: item.params![6] || item.Altitude || 0,
        type: (idx === 0 ? 'takeoff' : idx === arr.length - 1 ? 'landing' : 'cruise') as Waypoint['type'],
      }))
      .filter((wp) => wp.lat && wp.lng && !isNaN(wp.lat) && !isNaN(wp.lng))
  } catch {
    return []
  }
}

type GeoPoint = { type: string; coordinates: [number, number, number] }

/** Current route of a U-plan (GeoJSON points [lon, lat, alt]) for the SCRS comparison map. */
export function uplanWaypoints(uplan: unknown): { lat: number; lon: number; alt?: number }[] {
  const wps = (uplan as { flightDetails?: { waypoints?: GeoPoint[] } } | null)?.flightDetails?.waypoints ?? []
  return wps
    .filter((wp) => wp.type === 'Point' && Array.isArray(wp.coordinates))
    .map((wp) => ({ lat: wp.coordinates[1], lon: wp.coordinates[0], alt: wp.coordinates[2] }))
}

export function uspaceOf(geoawarenessData: unknown): string | null {
  if (geoawarenessData && typeof geoawarenessData === 'object' && 'uspace_identifier' in geoawarenessData) {
    const id = (geoawarenessData as { uspace_identifier: unknown }).uspace_identifier
    return typeof id === 'string' && id ? id : null
  }
  return null
}

// ---- Date helpers --------------------------------------------------------------------

/** UTC ISO -> "YYYY-MM-DDTHH:mm" in local time (datetime-local value). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (local) -> UTC ISO, or '' when empty/invalid. */
export function fromLocalInput(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

export function formatDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

/** "28 Oct, 10:00": compact date and time for list rows and badges. */
export function formatShortDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Random instants inside [min, max] (ms), one per id: Dev's per-folder "Randomize". */
export function randomTimes(count: number, minIso: string, maxIso: string): string[] | null {
  const min = new Date(minIso).getTime()
  const max = new Date(maxIso).getTime()
  if (isNaN(min) || isNaN(max) || min >= max) return null
  return Array.from({ length: count }, () => new Date(min + Math.random() * (max - min)).toISOString())
}
