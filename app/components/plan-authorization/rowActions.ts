/**
 * What a plan offers: the ONE contextual primary action (next step of the workflow), the VIEW / FILE entries
 * (planViewEntries: tiles of the production workspace, menu items in Dev) and the MANAGEMENT entries
 * (planManageEntries: rename, move, reset, delete). Dev's table / card menu is both lists (planMenuEntries),
 * so every surface reads the same rules and can never disagree.
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
import type { FolderRef } from '@/app/hooks/useFolders'
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
  folders: FolderRef[]
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

/** What state-dependent facts the entries share. */
function facts(plan: PlanRow, ctx: RowCtx) {
  const { busy, mode } = ctx
  const phase = planPhase(plan)
  const auth = authPhase(plan)
  const hasTrajectory = phase === 'done' && !!plan.csvResult
  // The U-plan gates do not depend on a trajectory: an imported external U-plan is `procesado` with csvResult 0.
  const hasStoredUplan = phase === 'done' && plan.hasUplan
  return {
    phase,
    auth,
    hasTrajectory,
    hasStoredUplan,
    viewing: busy.is('viewer', plan.id),
    downloading: busy.is('download', plan.id),
    decided: auth === 'approved' || auth === 'denied' || auth === 'withdrawn',
    // Dev edits the U-plan any time before authorization (as the old Dev did); prod only once it was generated.
    canEditUplan: auth === 'none' && (mode === 'dev' || hasStoredUplan),
  }
}

/**
 * The views and files of a plan (waypoints, trajectory, U-plan, geoawareness, review / edit, downloads, result,
 * SCRS alternative). Only what applies to the plan's current state is listed (nothing greyed out): before
 * processing a plan has waypoints only; trajectory, U-plan and geoawareness appear once processing produced them.
 * Menu order; `separatorBefore` only matters to menus.
 */
export function planViewEntries(plan: PlanRow, ctx: RowCtx): MenuEntry[] {
  const { a, mode, pa } = ctx
  const l = pa.actions
  const { auth, phase, hasTrajectory, hasStoredUplan, viewing, downloading, decided, canEditUplan } = facts(plan, ctx)

  const views: (MenuEntry | false)[] = [
    plan.hasFileContent && { id: 'waypoints', label: l.viewWaypoints, icon: MapPinned, loading: viewing, onSelect: () => a.openWaypoints(plan) },
    hasTrajectory && { id: 'trajectory2d', label: l.viewTrajectory2d, icon: MapIcon, onSelect: () => a.openTrajectory2d(plan) },
    hasTrajectory && { id: 'trajectory3d', label: l.viewTrajectory3d, icon: Route, onSelect: () => a.openTrajectory3d(plan) },
    hasStoredUplan && { id: 'uplan3d', label: l.viewUplan3d, icon: Box, loading: viewing, onSelect: () => a.openUplan3d(plan) },
    hasStoredUplan && { id: 'uplan2d', label: l.viewUplan2d, icon: Layers, loading: viewing, onSelect: () => a.openUplan2d(plan) },
    phase === 'done' && !!uspaceOf(plan.geoawarenessData) && { id: 'geo3d', label: l.viewGeo3d, icon: Globe, loading: viewing, onSelect: () => a.openGeo3d(plan) },
  ]
  const entries: MenuEntry[] = views.filter((e): e is MenuEntry => !!e)

  if (decided) {
    entries.push({ id: 'result', label: l.viewResult, icon: ShieldCheck, loading: viewing, separatorBefore: true, onSelect: () => a.openResult(plan) })
  }
  if (auth === 'denied' && hasScrsAlternative(plan)) {
    entries.push({ id: 'scrs', label: l.viewAlternative, icon: Route, loading: viewing, onSelect: () => a.openScrs(plan) })
  }

  const fileEntries: (MenuEntry | false)[] = [
    canEditUplan && { id: 'editUplan', label: l.editUplan, icon: FileJson, loading: viewing, onSelect: () => a.openUplanForm(plan) },
    (hasTrajectory || hasStoredUplan) && { id: 'downloadUplan', label: l.downloadUplan, icon: Download, loading: downloading, onSelect: () => a.downloadUplanJson(plan) },
    mode === 'dev' && hasTrajectory && { id: 'downloadCsv', label: l.downloadCsv, icon: Table2, loading: downloading, onSelect: () => a.downloadCsv(plan) },
  ]
  fileEntries.filter((e): e is MenuEntry => !!e).forEach((e, i) => entries.push(i === 0 ? { ...e, separatorBefore: true } : e))
  return entries
}

function renameEntry({ pa }: RowCtx, startRename: () => void): MenuEntry {
  return { id: 'rename', label: pa.actions.rename, icon: Pencil, onSelect: startRename }
}

/** Move, reset (once the plan left "unprocessed") and delete. */
function manageTail(plan: PlanRow, ctx: RowCtx): MenuEntry[] {
  const { a, folders, pa } = ctx
  const l = pa.actions
  const { phase } = facts(plan, ctx)
  const entries: MenuEntry[] = []

  const targets: MenuEntry[] = folders
    .filter((f) => f.id !== plan.folderId)
    .map((f) => ({ id: `move-${f.id}`, label: f.name, onSelect: () => a.move(plan, f.id) }))
  if (plan.folderId !== null) targets.push({ id: 'move-none', label: l.noFolder, separatorBefore: targets.length > 0, onSelect: () => a.move(plan, null) })
  if (targets.length > 0) entries.push({ id: 'move', label: l.moveTo, icon: FolderInput, children: targets, separatorBefore: true })

  if (phase !== 'idle') {
    entries.push({ id: 'reset', label: l.reset, icon: RotateCcw, separatorBefore: targets.length === 0, onSelect: () => a.reset(plan) })
  }
  entries.push({ id: 'delete', label: l.delete, icon: Trash2, tone: 'danger', separatorBefore: targets.length === 0 && phase === 'idle', onSelect: () => a.remove(plan) })
  return entries
}

/** Management only (production "..." menu): rename, move to folder, reset when it applies, delete. */
export function planManageEntries(plan: PlanRow, ctx: RowCtx, startRename: () => void): MenuEntry[] {
  return [renameEntry(ctx, startRename), ...manageTail(plan, ctx)]
}

/** Dev's "More" menu (table row and card): rename, every view / file, then move, reset, delete. */
export function planMenuEntries(plan: PlanRow, ctx: RowCtx, startRename: () => void): MenuEntry[] {
  return [renameEntry(ctx, startRename), ...planViewEntries(plan, ctx), ...manageTail(plan, ctx)]
}
