/**
 * What a plan row offers: the ONE contextual primary action (next step of the workflow) and the
 * "More" menu. Shared by the desktop row, the mobile card and the detail panel so they can never disagree.
 */

import {
  CalendarClock,
  Box,
  Download,
  FileJson,
  FolderInput,
  Globe,
  Hourglass,
  Layers,
  Loader2,
  Map as MapIcon,
  MapPinned,
  Pencil,
  Play,
  RotateCcw,
  Route,
  Send,
  ShieldCheck,
  Table2,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { Translations } from '@/app/i18n'
import type { FolderSummary } from '@/app/hooks/useFolders'
import type { MenuEntry } from './ActionMenu'
import {
  authPhase,
  hasScrsAlternative,
  planPhase,
  primaryActionId,
  uspaceOf,
  type Mode,
  type PlanRow,
  type PrimaryId,
} from './lib'
import type { Busy } from './useBusy'
import type { PlanActions } from './usePlanActions'

export interface RowCtx {
  mode: Mode
  a: PlanActions
  busy: Busy
  folders: FolderSummary[]
  pa: Translations['planAuth']
}

export interface PrimaryView {
  id: PrimaryId
  label: string
  icon: LucideIcon
  run?: () => void
  disabled?: boolean
  loading?: boolean
  tone: 'brand' | 'neutral' | 'success'
}

/** The next step of the workflow for this plan, as a button (Set time -> Process -> Request authorization -> View result). */
export function primaryView(plan: PlanRow, { a, busy, pa }: RowCtx): PrimaryView | null {
  const id = primaryActionId(plan)
  if (!id) return null
  const l = pa.actions
  switch (id) {
    case 'schedule':
      return { id, label: l.setTime, icon: CalendarClock, tone: 'brand' }
    case 'process':
      return { id, label: l.process, icon: Play, run: () => a.processPlan(plan), loading: busy.is('process', plan.id), tone: 'brand' }
    case 'processing':
      return { id, label: planPhase(plan) === 'queued' ? pa.status.plan.queued : pa.status.plan.processing, icon: Loader2, disabled: true, loading: true, tone: 'neutral' }
    case 'reset':
      return { id, label: l.reset, icon: RotateCcw, run: () => a.reset(plan), loading: busy.is('reset', plan.id), tone: 'neutral' }
    case 'requestAuth':
      return { id, label: l.requestAuth, icon: Send, run: () => a.requestAuth(plan), loading: busy.is('auth', plan.id), tone: 'brand' }
    case 'awaitingFas':
      return { id, label: l.awaitingFas, icon: Hourglass, disabled: true, loading: true, tone: 'neutral' }
    case 'viewResult':
      return { id, label: l.viewResult, icon: ShieldCheck, run: () => a.openResult(plan), loading: busy.is('viewer', plan.id), tone: 'success' }
  }
}

/** The "More" menu of a plan: views, edit, downloads, move, reset, delete. Disabled entries carry their reason. */
export function planMenuEntries(plan: PlanRow, ctx: RowCtx, startRename: () => void): MenuEntry[] {
  const { a, busy, mode, folders, pa } = ctx
  const l = pa.actions
  const r = pa.actions.reasons
  const phase = planPhase(plan)
  const auth = authPhase(plan)
  const processed = phase === 'done'
  const hasTrajectory = processed && !!plan.csvResult
  const viewing = busy.is('viewer', plan.id)
  const downloading = busy.is('download', plan.id)
  const hasData = plan.hasFileContent || plan.hasUplan
  const decided = auth === 'approved' || auth === 'denied' || auth === 'withdrawn'
  const editable = auth === 'none'

  const entries: MenuEntry[] = [
    { id: 'rename', label: l.rename, icon: Pencil, onSelect: startRename },
    {
      id: 'waypoints',
      label: l.viewWaypoints,
      icon: MapPinned,
      disabled: !plan.hasFileContent,
      reason: r.noPlanFile,
      loading: viewing,
      onSelect: () => a.openWaypoints(plan),
    },
    {
      id: 'trajectory2d',
      label: l.viewTrajectory2d,
      icon: MapIcon,
      disabled: !hasTrajectory,
      reason: processed ? r.noTrajectory : r.processFirst,
      onSelect: () => a.openTrajectory2d(plan),
    },
    {
      id: 'trajectory3d',
      label: l.viewTrajectory3d,
      icon: Route,
      disabled: !hasTrajectory,
      reason: processed ? r.noTrajectory : r.processFirst,
      onSelect: () => a.openTrajectory3d(plan),
    },
    {
      id: 'uplan3d',
      label: l.viewUplan3d,
      icon: Box,
      disabled: !hasData,
      reason: r.noUplan,
      loading: viewing,
      onSelect: () => a.openUplan3d(plan),
    },
    {
      id: 'uplan2d',
      label: l.viewUplan2d,
      icon: Layers,
      disabled: !plan.hasUplan,
      reason: r.noUplan,
      loading: viewing,
      onSelect: () => a.openUplan2d(plan),
    },
    {
      id: 'geo3d',
      label: l.viewGeo3d,
      icon: Globe,
      disabled: !uspaceOf(plan.geoawarenessData),
      reason: r.noGeoawareness,
      loading: viewing,
      onSelect: () => a.openGeo3d(plan),
    },
  ]

  if (decided) {
    entries.push({ id: 'result', label: l.viewResult, icon: ShieldCheck, loading: viewing, separatorBefore: true, onSelect: () => a.openResult(plan) })
  }
  if (auth === 'denied' && hasScrsAlternative(plan)) {
    entries.push({ id: 'scrs', label: l.viewAlternative, icon: Route, loading: viewing, onSelect: () => a.openScrs(plan) })
  }

  entries.push(
    {
      id: 'editUplan',
      label: l.editUplan,
      icon: FileJson,
      separatorBefore: true,
      // Dev edits the U-plan any time before authorization (as the old Dev did); prod only once processed.
      disabled: (mode === 'prod' && !processed) || !editable,
      reason: editable ? r.processFirst : auth === 'pending' ? r.fasProcessing : r.alreadyDecided,
      loading: viewing,
      onSelect: () => a.openUplanForm(plan),
    },
    {
      id: 'downloadUplan',
      label: l.downloadUplan,
      icon: Download,
      disabled: !plan.csvResult,
      reason: r.noTrajectory,
      loading: downloading,
      onSelect: () => a.downloadUplanJson(plan),
    }
  )
  if (mode === 'dev') {
    entries.push({
      id: 'downloadCsv',
      label: l.downloadCsv,
      icon: Table2,
      disabled: !hasTrajectory,
      reason: processed ? r.noTrajectory : r.processFirst,
      loading: downloading,
      onSelect: () => a.downloadCsv(plan),
    })
  }

  const targets: MenuEntry[] = folders
    .filter((f) => f.id !== plan.folderId)
    .map((f) => ({ id: `move-${f.id}`, label: f.name, onSelect: () => a.move(plan, f.id) }))
  if (plan.folderId !== null) targets.push({ id: 'move-none', label: l.noFolder, separatorBefore: targets.length > 0, onSelect: () => a.move(plan, null) })
  if (targets.length > 0) entries.push({ id: 'move', label: l.moveTo, icon: FolderInput, children: targets, separatorBefore: true })

  entries.push(
    {
      id: 'reset',
      label: l.reset,
      icon: RotateCcw,
      separatorBefore: targets.length === 0,
      disabled: phase === 'idle',
      reason: r.nothingToReset,
      onSelect: () => a.reset(plan),
    },
    { id: 'delete', label: l.delete, icon: Trash2, tone: 'danger', onSelect: () => a.remove(plan) }
  )
  return entries
}
