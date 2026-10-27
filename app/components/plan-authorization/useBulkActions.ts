'use client'

/**
 * Dev: bulk actions of the ticked plans (PARITY C. Selection and bulk). Lives apart from useGroupActions and is
 * only called inside BulkActionBar, so it ships in that lazily loaded chunk and never reaches the production bundle.
 * Always acts on explicit ids (the selection), through the useFlightPlans hook.
 */

import { useCallback } from 'react'
import { interpolate, useI18n } from '@/app/i18n'
import type { UseFlightPlansReturn } from '@/app/hooks/useFlightPlans'
import type { useToast } from '@/app/hooks/useToast'
import { mapLimit, saveZips } from './files'
import { authPhase, hasScrsAlternative, parseJson, planPhase, type PlanRow, type UplanData } from './lib'
import { errorMessage } from './usePlanActions'
import type { Confirm } from './useConfirm'
import type { GroupActions } from './useGroupActions'
import type { ViewerState } from './ViewerHost'

export interface BulkDeps {
  fp: UseFlightPlansReturn<PlanRow>
  toast: ReturnType<typeof useToast>
  confirm: Confirm
  setViewer: (v: ViewerState | null) => void
  /** Folder-level actions: the selection, the busy flag and the helpers bulk shares with folders. */
  group: GroupActions
}

export function useBulkActions({ fp, toast, confirm, setViewer, group }: BulkDeps) {
  const { t } = useI18n()
  const pa = t.planAuth
  const { work, selectedPlans, viewTrajectories, downloadCsvs } = group
  const idsOf = (list: PlanRow[]) => list.map((p) => p.id)

  const processSelected = useCallback(
    () =>
      work('process', async () => {
        const res = await fp.processFlightPlans(idsOf(selectedPlans))
        if (res) toast.success(interpolate(pa.toast.queued, { n: res.count }))
        else toast.error(pa.toast.processError)
      }),
    [work, fp, selectedPlans, toast, pa]
  )

  const viewSelected = useCallback(() => viewTrajectories(selectedPlans, pa.viewers.selectedTrajectories), [viewTrajectories, selectedPlans, pa])
  const downloadSelectedCsv = useCallback(() => downloadCsvs(selectedPlans, 'selected_plans'), [downloadCsvs, selectedPlans])

  /** The summary listing has no fileContent: it is read plan by plan (5 at a time). */
  const downloadSelectedPlans = useCallback(
    () =>
      work('downloadPlans', async () => {
        const list = selectedPlans.filter((p) => p.hasFileContent)
        if (list.length === 0) return toast.warning(pa.toast.noPlanFiles)
        try {
          const details = await mapLimit(list, 5, (p) => fp.fetchPlanDetail(p.id))
          await saveZips(details.map((d) => ({ name: d.customName, content: d.fileContent })), 'plan', 'selected_original_plans')
        } catch (e) {
          toast.error(errorMessage(e, pa.toast.planFilesError))
        }
      }),
    [work, fp, selectedPlans, toast, pa]
  )

  /** Regenerates (and saves, server side) the U-plan of every processed, scheduled plan, 5 at a time. */
  const downloadSelectedUplans = useCallback(
    () =>
      work('downloadUplans', async () => {
        const list = selectedPlans.filter((p) => planPhase(p) === 'done' && p.scheduledAt)
        if (list.length === 0) return toast.warning(pa.toast.noScheduledProcessed)
        toast.info(pa.toast.regenerating)
        const entries = (
          await mapLimit(list, 5, async (p) => {
            try {
              const res = await fp.generateVolumes(p.id)
              return res.uplan ? { name: p.customName, content: JSON.stringify(res.uplan, null, 2) } : null
            } catch (e) {
              console.error(`Error regenerating U-plan for ${p.customName}:`, e)
              return null
            }
          })
        ).filter((e): e is { name: string; content: string } => e !== null)
        if (entries.length === 0) return toast.error(pa.toast.uplanDownloadError)
        await saveZips(entries, 'json', 'selected_uplans')
      }),
    [work, fp, selectedPlans, toast, pa]
  )

  const approvedInSelection = selectedPlans.filter((p) => authPhase(p) === 'approved').length

  // Reset auth / reset only clear the local state: an approved plan is NOT cancelled at FAS (the per-plan Reset is).
  const fasWarning = approvedInSelection > 0 ? interpolate(pa.confirm.bulkFasWarning, { n: approvedInSelection }) : undefined

  const resetAuthSelected = useCallback(() => {
    const ids = idsOf(selectedPlans)
    confirm.ask({
      title: pa.confirm.resetAuthTitle,
      message: interpolate(pa.confirm.resetAuthMessage, { n: ids.length }),
      warning: fasWarning,
      confirmLabel: pa.confirm.resetAuthConfirm,
      variant: 'danger',
      onConfirm: () =>
        work('resetAuth', async () => {
          if (await fp.resetAuthorization(ids)) toast.success(pa.toast.authReset)
          else toast.error(pa.toast.authResetError)
        }),
    })
  }, [confirm, selectedPlans, fasWarning, work, fp, toast, pa])

  const resetSelected = useCallback(() => {
    const ids = idsOf(selectedPlans)
    confirm.ask({
      title: pa.confirm.resetPlansTitle,
      message: interpolate(pa.confirm.resetPlansMessage, { n: ids.length }),
      warning: fasWarning,
      confirmLabel: pa.confirm.resetPlansConfirm,
      variant: 'danger',
      onConfirm: () =>
        work('reset', async () => {
          if (await fp.resetFlightPlans(ids)) toast.success(pa.toast.plansReset)
          else toast.error(pa.toast.plansResetError)
        }),
    })
  }, [confirm, selectedPlans, fasWarning, work, fp, toast, pa])

  const deleteSelected = useCallback(() => {
    const ids = idsOf(selectedPlans)
    confirm.ask({
      title: interpolate(pa.confirm.deleteSelectedTitle, { n: ids.length }),
      message: interpolate(pa.confirm.deleteSelectedMessage, { n: ids.length }),
      confirmLabel: interpolate(pa.confirm.deleteSelectedConfirm, { n: ids.length }),
      variant: 'danger',
      onConfirm: () =>
        work('delete', async () => {
          const res = await fp.deleteFlightPlans(ids)
          if (res) toast.success(interpolate(pa.toast.plansDeleted, { n: res.deletedPlans }))
          else toast.error(pa.toast.planDeleteError)
        }),
    })
  }, [confirm, selectedPlans, work, fp, toast, pa])

  /** Eligible = processed with no authorization yet (the hook filters the same way). Submits to FAS, one by one with 1 s between. */
  const requestAuthSelected = useCallback(() => {
    const ids = idsOf(selectedPlans.filter((p) => planPhase(p) === 'done' && authPhase(p) === 'none'))
    if (ids.length === 0) return toast.warning(pa.toast.noEligibleForAuth)
    confirm.ask({
      title: pa.confirm.bulkAuthTitle,
      message: interpolate(pa.confirm.bulkAuthMessage, { n: ids.length }),
      confirmLabel: interpolate(pa.confirm.bulkAuthConfirm, { n: ids.length }),
      variant: 'warning',
      onConfirm: () =>
        work('auth', async () => {
          const results = await fp.requestAuthorizations(ids, { delayMs: 1000, markProcessing: true })
          const failed = results.filter((r) => !r.ok)
          if (results.length - failed.length > 0) toast.success(interpolate(pa.toast.bulkAuthSent, { n: results.length - failed.length }))
          if (failed.length > 0) toast.error(interpolate(pa.toast.bulkAuthFailed, { n: failed.length, error: failed[0].error ?? '' }))
        }),
    })
  }, [confirm, selectedPlans, work, fp, toast, pa])

  /** Authorized U-plans of the selection on one map (the summary has no uplan: read plan by plan). */
  const viewAuthorizedUplans = useCallback(
    () =>
      work('viewUplans', async () => {
        const list = selectedPlans.filter((p) => authPhase(p) === 'approved' && p.hasUplan)
        if (list.length === 0) return toast.warning(pa.toast.noAuthorizedUplans)
        try {
          const details = await mapLimit(list, 5, (p) => fp.fetchPlanDetail(p.id))
          const uplans = details.map((d) => parseJson<UplanData>(d.uplan) ?? {})
          setViewer({ kind: 'bulkUplans', uplans, names: details.map((d) => d.customName) })
        } catch (e) {
          toast.error(errorMessage(e, pa.toast.viewerError))
        }
      }),
    [work, fp, selectedPlans, toast, pa, setViewer]
  )

  const viewErrors = useCallback(() => {
    const errors = selectedPlans
      .filter((p) => (authPhase(p) === 'denied' || authPhase(p) === 'withdrawn') && p.authorizationMessage)
      .map((p) => ({ name: p.customName, message: p.authorizationMessage as unknown }))
    if (errors.length === 0) return toast.warning(pa.toast.noErrors)
    setViewer({ kind: 'bulkErrors', errors })
  }, [selectedPlans, toast, pa, setViewer])

  const acceptAlternativesSelected = useCallback(() => {
    const ids = idsOf(selectedPlans.filter(hasScrsAlternative))
    if (ids.length === 0) return toast.warning(pa.toast.noAlternatives)
    confirm.ask({
      title: pa.confirm.alternativesTitle,
      message: interpolate(pa.confirm.alternativesMessage, { n: ids.length }),
      confirmLabel: interpolate(pa.confirm.alternativesConfirm, { n: ids.length }),
      variant: 'warning',
      onConfirm: () =>
        work('alternatives', async () => {
          const { accepted, failed } = await fp.acceptAlternatives(ids)
          if (accepted.length > 0) toast.success(interpolate(pa.toast.alternativesAccepted, { n: accepted.length }))
          if (failed.length > 0) toast.error(interpolate(pa.toast.alternativesFailed, { n: failed.length, error: failed[0].error }))
        }),
    })
  }, [confirm, selectedPlans, work, fp, toast, pa])

  return {
    processSelected,
    viewSelected,
    downloadSelectedCsv,
    downloadSelectedPlans,
    downloadSelectedUplans,
    resetAuthSelected,
    resetSelected,
    deleteSelected,
    requestAuthSelected,
    viewAuthorizedUplans,
    viewErrors,
    acceptAlternativesSelected,
  }
}
