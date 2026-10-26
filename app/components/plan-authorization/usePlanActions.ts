'use client'

/**
 * Single-plan actions and the viewers they open (PARITY P-35..P-54, P-57). Every call goes
 * through the useFlightPlans hook (same endpoints and payloads as the old uploaders); heavy
 * columns (uplan, fileContent) are read on demand with fetchPlanDetail.
 */

import { useCallback, useRef, useState } from 'react'
import { ApiError } from '@/lib/api-client'
import { parseScrsAlternative } from '@/lib/scrs'
import { shouldGenerateRandomUplan } from '@/lib/uplan/random-data'
import { isUplanComplete } from '@/lib/validators/uplan-validator'
import { interpolate, useI18n } from '@/app/i18n'
import type { UseFlightPlansReturn } from '@/app/hooks/useFlightPlans'
import type { useToast } from '@/app/hooks/useToast'
import { saveText } from './files'
import {
  authPhase,
  hasVolumes,
  messageText,
  parseJson,
  parseWaypointsFromPlan,
  planPhase,
  uplanWaypoints,
  uspaceOf,

  type PlanRow,
  type UplanData,
} from './lib'
import type { Busy } from './useBusy'
import type { Confirm } from './useConfirm'
import type { ScrsState, ViewerState } from './ViewerHost'

/** Message of a failed call: the server's `{ error }` text when there is one. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.serverMessage
  return e instanceof Error && e.message ? e.message : fallback
}

interface Deps {
  plans: PlanRow[]
  fp: UseFlightPlansReturn<PlanRow>
  toast: ReturnType<typeof useToast>
  confirm: Confirm
  busy: Busy
}

export function usePlanActions({ plans, fp, toast, confirm, busy }: Deps) {
  const { t } = useI18n()
  const pa = t.planAuth
  const plansRef = useRef(plans)
  plansRef.current = plans

  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [scrs, setScrs] = useState<ScrsState | null>(null)
  const [acceptingScrs, setAcceptingScrs] = useState(false)

  const closeViewer = useCallback(() => setViewer(null), [])
  const closeScrs = useCallback(() => setScrs(null), [])

  /** U-plan of a plan with its operation volumes: generated (and saved by the server) when missing. */
  const uplanWithVolumes = useCallback(
    async (id: number, uplanRaw: unknown, hasTrajectory: boolean): Promise<UplanData | null> => {
      let uplan = parseJson<UplanData>(uplanRaw)
      if (!hasVolumes(uplan) && hasTrajectory) {
        const res = await fp.generateVolumes(id)
        uplan = parseJson<UplanData>(res.uplan)
        toast.success(interpolate(pa.toast.volumesGenerated, { n: res.volumesGenerated }))
      }
      return uplan
    },
    [fp, toast, pa]
  )

  /** Run a viewer opener with the plan's "viewer" spinner and one error toast. */
  const open = useCallback(
    (plan: PlanRow, fn: () => Promise<unknown>) =>
      busy.run('viewer', plan.id, async () => {
        try {
          await fn()
        } catch (e) {
          toast.error(errorMessage(e, pa.toast.viewerError))
        }
      }),
    [busy, toast, pa]
  )

  // ---- Viewers ---------------------------------------------------------------------

  const openWaypoints = useCallback(
    (plan: PlanRow) =>
      open(plan, async () => {
        const d = await fp.fetchPlanDetail(plan.id)
        const waypoints = parseWaypointsFromPlan(d.fileContent)
        if (waypoints.length === 0) {
          toast.warning(pa.toast.noWaypoints)
          return
        }
        setViewer({ kind: 'waypoints', planName: plan.customName, waypoints })
      }),
    [open, fp, toast, pa]
  )

  const openTrajectory2d = useCallback(
    (plan: PlanRow) => {
      if (!plan.csvResult) return toast.warning(pa.toast.noTrajectory)
      setViewer({ kind: 'trajectory2d', planId: plan.id, planName: plan.customName })
    },
    [toast, pa]
  )

  const openTrajectory3d = useCallback(
    (plan: PlanRow) => {
      if (!plan.csvResult) return toast.warning(pa.toast.noTrajectory)
      setViewer({ kind: 'trajectory3d', planId: plan.id, planName: plan.customName })
    },
    [toast, pa]
  )

  const openUplan3d = useCallback(
    (plan: PlanRow) =>
      open(plan, async () => {
        const d = await fp.fetchPlanDetail(plan.id)
        const uplan = await uplanWithVolumes(plan.id, d.uplan, !!d.csvResult)
        if (!uplan || !hasVolumes(uplan)) {
          toast.warning(pa.toast.noVolumes)
          return
        }
        setViewer({ kind: 'uplan3d', uplanData: uplan })
      }),
    [open, fp, uplanWithVolumes, toast, pa]
  )

  const openUplan2d = useCallback(
    (plan: PlanRow) =>
      open(plan, async () => {
        const d = await fp.fetchPlanDetail(plan.id)
        const uplan = await uplanWithVolumes(plan.id, d.uplan, !!d.csvResult)
        setViewer({ kind: 'uplan2d', name: plan.customName, uplan, fileContent: d.fileContent ?? null })
      }),
    [open, fp, uplanWithVolumes]
  )

  const openGeo3d = useCallback(
    (plan: PlanRow) => {
      const uspaceId = uspaceOf(plan.geoawarenessData)
      if (!uspaceId) return toast.error(pa.toast.noUspace)
      return open(plan, async () => {
        const d = await fp.fetchPlanDetail(plan.id)
        const uplan = await uplanWithVolumes(plan.id, d.uplan, !!d.csvResult)
        setViewer({ kind: 'geo3d', planId: plan.id, uspaceId, uplanData: uplan })
      })
    },
    [open, fp, uplanWithVolumes, toast, pa]
  )

  const openResult = useCallback(
    (plan: PlanRow) =>
      open(plan, async () => {
        const d = await fp.fetchPlanDetail(plan.id)
        const phase = authPhase(plan)
        setViewer({
          kind: 'result',
          planId: plan.id,
          planName: plan.customName,
          status: phase === 'approved' ? 'aprobado' : phase === 'withdrawn' ? 'withdrawn' : 'denegado',
          reason: messageText(d.authorizationMessage),
          uplanData: parseJson<UplanData>(d.uplan),
          geoawarenessData: d.geoawarenessData ?? null,
        })
      }),
    [open, fp]
  )

  const openUplanForm = useCallback(
    (plan: PlanRow, extra?: { uplan?: unknown; missingFields?: string[]; fieldErrors?: Record<string, string> }) =>
      open(plan, async () => {
        const uplan = extra?.uplan ?? parseJson((await fp.fetchPlanDetail(plan.id)).uplan)
        setViewer({
          kind: 'uplanForm',
          planId: plan.id,
          planName: plan.customName,
          uplan,
          hasBeenProcessed: planPhase(plan) === 'done',
          hasCsvResult: !!plan.csvResult,
          hasScheduledAt: !!plan.scheduledAt,
          missingFields: extra?.missingFields,
          fieldErrors: extra?.fieldErrors,
        })
      }),
    [open, fp]
  )

  /** SCRS proposal vs the current route (from the plan menu / panel). */
  const openScrs = useCallback(
    (plan: PlanRow) =>
      open(plan, async () => {
        const d = await fp.fetchPlanDetail(plan.id)
        const text = messageText(d.authorizationMessage)
        const alternative = text ? parseScrsAlternative(text) : null
        if (!alternative) return toast.warning(pa.toast.noAlternative)
        setScrs({ planId: plan.id, current: uplanWaypoints(parseJson(d.uplan)), alternative: alternative.flatWaypoints })
      }),
    [open, fp, toast, pa]
  )

  /** SCRS proposal opened from the result modal (both routes come from that modal). */
  const openScrsFromResult = useCallback(
    (current: ScrsState['current'], alternative: ScrsState['alternative']) => {
      if (viewer?.kind === 'result') setScrs({ planId: viewer.planId, current, alternative })
    },
    [viewer]
  )

  const acceptScrs = useCallback(async () => {
    if (!scrs) return
    setAcceptingScrs(true)
    try {
      await fp.acceptAlternative(scrs.planId)
      setScrs(null)
      setViewer(null)
      toast.success(pa.toast.alternativeAccepted)
    } catch (e) {
      toast.error(errorMessage(e, pa.toast.alternativeError))
    } finally {
      setAcceptingScrs(false)
    }
  }, [scrs, fp, toast, pa])

  // ---- Downloads -------------------------------------------------------------------

  /** U-plan JSON of one plan; the volumes are generated (and saved) first when missing. */
  const downloadUplanJson = useCallback(
    (plan: PlanRow) =>
      busy.run('download', plan.id, async () => {
        try {
          const d = await fp.fetchPlanDetail(plan.id)
          let uplan = parseJson<UplanData>(d.uplan)
          if (!hasVolumes(uplan)) {
            const res = await fp.generateVolumes(plan.id)
            uplan = parseJson<UplanData>(res.uplan)
            toast.success(interpolate(pa.toast.volumesGenerated, { n: res.volumesGenerated }))
          }
          saveText(JSON.stringify(uplan, null, 2), 'application/json', `uplan_${plan.customName.replace(/[^a-zA-Z0-9]/g, '_')}.json`)
        } catch (e) {
          toast.error(errorMessage(e, pa.toast.uplanDownloadError))
        }
      }),
    [busy, fp, toast, pa]
  )

  /** Trajectory CSV of one processed plan (Dev). The CSV id is the plan id. */
  const downloadCsv = useCallback(
    (plan: PlanRow) =>
      busy.run('download', plan.id, async () => {
        try {
          saveText(await fp.fetchCsvResult(plan.id), 'text/csv', `${plan.customName}.csv`)
        } catch (e) {
          toast.error(errorMessage(e, pa.toast.csvError))
        }
      }),
    [busy, fp, toast, pa]
  )

  // ---- Mutations -------------------------------------------------------------------

  const schedule = useCallback(
    (plan: PlanRow, iso: string | null) =>
      busy.run('schedule', plan.id, async () => {
        const ok = !!(await fp.scheduleFlightPlan(plan.id, iso))
        if (ok) toast.success(pa.toast.dateUpdated)
        else toast.error(pa.toast.dateError)
        return ok
      }),
    [busy, fp, toast, pa]
  )

  const rename = useCallback(
    (plan: PlanRow, name: string) =>
      busy.run('rename', plan.id, async () => {
        const ok = !!(await fp.renameFlightPlan(plan.id, name))
        if (ok) toast.success(pa.toast.nameUpdated)
        else toast.error(pa.toast.nameError)
        return ok
      }),
    [busy, fp, toast, pa]
  )

  const move = useCallback(
    (plan: PlanRow, folderId: number | null) =>
      busy.run('move', plan.id, async () => {
        if (await fp.moveFlightPlan(plan.id, folderId)) toast.success(pa.toast.planMoved)
        else toast.error(pa.toast.planMoveError)
      }),
    [busy, fp, toast, pa]
  )

  const processPlan = useCallback(
    (plan: PlanRow) => {
      if (!plan.scheduledAt) return toast.warning(pa.toast.selectDateFirst)
      confirm.ask({
        title: pa.confirm.processTitle,
        message: interpolate(pa.confirm.processMessage, { name: plan.customName }),
        confirmLabel: pa.confirm.processConfirm,
        variant: 'warning',
        onConfirm: () =>
          busy.run('process', plan.id, async () => {
            if (!(await fp.processFlightPlan(plan.id))) toast.error(pa.toast.processError)
          }),
      })
    },
    [confirm, busy, fp, toast, pa]
  )

  const remove = useCallback(
    (plan: PlanRow) =>
      confirm.ask({
        title: pa.confirm.deletePlanTitle,
        message: interpolate(pa.confirm.deletePlanMessage, { name: plan.customName }),
        confirmLabel: pa.confirm.deletePlanConfirm,
        variant: 'danger',
        onConfirm: () =>
          busy.run('delete', plan.id, async () => {
            if (await fp.deleteFlightPlan(plan.id)) toast.success(pa.toast.planDeleted)
            else toast.error(pa.toast.planDeleteError)
          }),
      }),
    [confirm, busy, fp, toast, pa]
  )

  const reset = useCallback(
    (plan: PlanRow) =>
      confirm.ask({
        title: pa.confirm.resetTitle,
        message: interpolate(pa.confirm.resetMessage, { name: plan.customName }),
        warning: authPhase(plan) === 'approved' ? pa.confirm.resetApprovedWarning : undefined,
        confirmLabel: pa.confirm.resetConfirm,
        variant: 'danger',
        onConfirm: () =>
          busy.run('reset', plan.id, async () => {
            try {
              await fp.resetFlightPlan(plan.id)
              toast.success(pa.toast.planReset)
            } catch (e) {
              const msg = errorMessage(e, pa.toast.planResetError)
              const external = msg === 'Cannot reset an externally uploaded plan'
              toast.error(external ? pa.toast.resetExternal : msg, external ? {} : { onRetry: () => reset(plan) })
            }
          }),
      }),
    [confirm, busy, fp, toast, pa]
  )

  /**
   * Submit one plan to FAS (after the confirmation). Same recipe as the old prod uploader:
   * read the U-plan, generate the volumes when there is none, validate it unless random data is on
   * (an incomplete one opens the form with the missing fields), POST /uplan.
   */
  const submitAuth = useCallback(
    (id: number): Promise<unknown> =>
      busy.run('auth', id, async () => {
        const plan = plansRef.current.find((p) => p.id === id)
        if (!plan || planPhase(plan) !== 'done') return toast.warning(pa.toast.processFirst)
        try {
          const d = await fp.fetchPlanDetail(id)
          let uplan = parseJson<UplanData>(d.uplan)
          if (!uplan && plan.csvResult) {
            toast.info(pa.toast.generatingVolumes)
            const res = await fp.generateVolumes(id)
            uplan = parseJson<UplanData>(res.uplan)
            toast.success(interpolate(pa.toast.volumesGenerated, { n: res.volumesGenerated }))
          }
          if (!shouldGenerateRandomUplan()) {
            if (!uplan) return toast.error(pa.toast.uplanMissing)
            const check = isUplanComplete(uplan)
            if (!check.isComplete) {
              const list = check.missingFields.slice(0, 3).join(', ')
              const more = check.missingFields.length - 3
              toast.error(interpolate(pa.toast.completeFields, { fields: more > 0 ? interpolate(pa.toast.andMore, { fields: list, n: more }) : list }))
              void openUplanForm(plan, { uplan, missingFields: check.missingFields, fieldErrors: check.fieldErrors })
              return
            }
          }
          await fp.requestAuthorization(id)
          toast.success(pa.toast.authSent)
        } catch (e) {
          const msg = e instanceof ApiError && e.status === 503 ? pa.toast.fasUnavailable : errorMessage(e, pa.toast.authError)
          toast.error(msg, { onRetry: () => void submitAuth(id) })
        }
      }),
    [busy, fp, toast, pa, openUplanForm]
  )

  const requestAuth = useCallback(
    (plan: PlanRow) => {
      if (planPhase(plan) !== 'done') return toast.warning(pa.toast.processFirst)
      confirm.ask({
        title: pa.confirm.authTitle,
        message: interpolate(pa.confirm.authMessage, { name: plan.customName }),
        confirmLabel: pa.confirm.authConfirm,
        variant: 'warning',
        onConfirm: () => submitAuth(plan.id),
      })
    },
    [confirm, toast, pa, submitAuth]
  )

  /** "Save & request authorization" from the U-plan form: same confirmation as the button. */
  const requestAuthById = useCallback(
    (id: number) => {
      const plan = plansRef.current.find((p) => p.id === id)
      if (plan) requestAuth(plan)
    },
    [requestAuth]
  )

  return {
    viewer,
    closeViewer,
    setViewer,
    scrs,
    closeScrs,
    acceptingScrs,
    acceptScrs,
    openScrsFromResult,
    openWaypoints,
    openTrajectory2d,
    openTrajectory3d,
    openUplan3d,
    openUplan2d,
    openGeo3d,
    openResult,
    openUplanForm,
    openScrs,
    downloadUplanJson,
    downloadCsv,
    schedule,
    rename,
    move,
    processPlan,
    remove,
    reset,
    requestAuth,
    requestAuthById,
  }
}

export type PlanActions = ReturnType<typeof usePlanActions>
