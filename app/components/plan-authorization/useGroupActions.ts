'use client'

/**
 * Folder, upload and bulk actions (PARITY A. Folders, B. Upload, C. Selection and bulk, P-37/P-38).
 * Bulk helpers always act on explicit ids (the selection), through the useFlightPlans / useFolders hooks.
 */

import { useCallback, useState } from 'react'
import { interpolate, useI18n } from '@/app/i18n'
import type { UseFlightPlansReturn } from '@/app/hooks/useFlightPlans'
import type { FolderSummary, UseFoldersReturn } from '@/app/hooks/useFolders'
import type { useToast } from '@/app/hooks/useToast'
import { expandFiles, mapLimit, parseTrajectoryCsv, planNameFromFile, saveZips, UPLOAD_BATCH, type TrajectoryRow } from './files'
import {
  authPhase,
  hasScrsAlternative,
  parseJson,
  planPhase,
  randomTimes,
  type Mode,
  type PlanRow,
  type UplanData,
} from './lib'
import { errorMessage } from './usePlanActions'
import type { Confirm } from './useConfirm'
import type { ViewerState } from './ViewerHost'

interface Deps {
  mode: Mode
  plans: PlanRow[]
  fp: UseFlightPlansReturn<PlanRow>
  fo: UseFoldersReturn<FolderSummary>
  toast: ReturnType<typeof useToast>
  confirm: Confirm
  /** Ids currently ticked (Dev). */
  selected: number[]
  setViewer: (v: ViewerState | null) => void
}

export function useGroupActions({ mode, plans, fp, fo, toast, confirm, selected, setViewer }: Deps) {
  const { t } = useI18n()
  const pa = t.planAuth
  /** Name of the long-running group operation in flight (disables the bar / dropzone). */
  const [working, setWorking] = useState<string | null>(null)

  const work = useCallback(
    async (name: string, fn: () => Promise<unknown>) => {
      setWorking(name)
      try {
        await fn()
      } finally {
        setWorking(null)
      }
    },
    []
  )

  const plansOf = useCallback((folderId: number) => plans.filter((p) => p.folderId === folderId), [plans])
  const selectedPlans = plans.filter((p) => selected.includes(p.id))
  const idsOf = (list: PlanRow[]) => list.map((p) => p.id)

  // ---- Folders ---------------------------------------------------------------------

  const createFolder = useCallback(
    async (name: string): Promise<boolean> => {
      const created = await fo.createFolder({ name })
      if (created) toast.success(pa.toast.folderCreated)
      else toast.error(pa.toast.folderCreateError)
      return !!created
    },
    [fo, toast, pa]
  )

  const renameFolder = useCallback(
    async (folder: FolderSummary, name: string): Promise<boolean> => {
      const ok = !!(await fo.updateFolder(folder.id, { name }))
      if (ok) toast.success(pa.toast.folderRenamed)
      else toast.error(pa.toast.folderRenameError)
      return ok
    },
    [fo, toast, pa]
  )

  /** The folders route deletes the plans itself but does not cancel them at FAS: pass the plan ids (plans route does). */
  const deleteFolder = useCallback(
    (folder: FolderSummary) => {
      const planIds = idsOf(plansOf(folder.id))
      confirm.ask({
        title: pa.confirm.deleteFolderTitle,
        message: interpolate(planIds.length ? pa.confirm.deleteFolderMessageWithPlans : pa.confirm.deleteFolderMessage, { name: folder.name, n: planIds.length }),
        confirmLabel: pa.confirm.deleteFolderConfirm,
        variant: 'danger',
        onConfirm: () =>
          work('deleteFolder', async () => {
            const ok = await fo.deleteFolder(folder.id, planIds)
            await fp.refresh()
            if (ok) toast.success(pa.toast.folderDeleted)
            else toast.error(pa.toast.folderDeleteError)
          }),
      })
    },
    [confirm, plansOf, work, fo, fp, toast, pa]
  )

  const cloneFolder = useCallback(
    (folder: FolderSummary) =>
      work('clone', async () => {
        toast.info(pa.toast.cloning)
        const cloned = await fo.cloneFolder(folder.id)
        await fp.refresh()
        if (cloned) toast.success(pa.toast.cloned)
        else toast.error(pa.toast.cloneError)
      }),
    [work, fo, fp, toast, pa]
  )

  /** Queues EVERY plan of the folder (also processed ones), so it asks first. */
  const processFolder = useCallback(
    (folder: FolderSummary) => {
      const ids = idsOf(plansOf(folder.id))
      if (ids.length === 0) return toast.warning(pa.toast.emptyFolder)
      confirm.ask({
        title: pa.confirm.processFolderTitle,
        message: interpolate(pa.confirm.processFolderMessage, { name: folder.name, n: ids.length }),
        confirmLabel: pa.confirm.processFolderConfirm,
        variant: 'warning',
        onConfirm: () =>
          work('processFolder', async () => {
            const res = await fo.processFolder(folder.id, ids)
            await fp.refresh()
            if (res) toast.success(interpolate(pa.toast.queued, { n: res.count }))
            else toast.error(pa.toast.processError)
          }),
      })
    },
    [confirm, plansOf, work, fo, fp, toast, pa]
  )

  const saveFolderWindow = useCallback(
    async (folder: FolderSummary, min: string | null, max: string | null) => {
      const ok = !!(await fo.updateFolder(folder.id, { minScheduledAt: min, maxScheduledAt: max }))
      if (ok) toast.success(pa.toast.windowSaved)
      else toast.error(pa.toast.windowError)
    },
    [fo, toast, pa]
  )

  /** Applies to every plan of the folder (processed / authorized ones too), so it asks first. */
  const randomizeFolder = useCallback(
    (folder: FolderSummary) => {
      const list = plansOf(folder.id)
      const times = folder.minScheduledAt && folder.maxScheduledAt ? randomTimes(list.length, folder.minScheduledAt, folder.maxScheduledAt) : null
      if (!times) return toast.warning(pa.toast.windowInvalid)
      confirm.ask({
        title: pa.confirm.randomizeTitle,
        message: interpolate(pa.confirm.randomizeMessage, { name: folder.name, n: list.length }),
        confirmLabel: pa.confirm.randomizeConfirm,
        variant: 'warning',
        onConfirm: () =>
          work('randomize', async () => {
            const res = await fp.scheduleFlightPlans(list.map((p, i) => ({ id: p.id, scheduledAt: times[i] })))
            if (res) toast.success(interpolate(pa.toast.randomized, { n: res.count }))
            else toast.error(pa.toast.randomizeError)
          }),
      })
    },
    [confirm, plansOf, work, fp, toast, pa]
  )

  // ---- Trajectories / downloads (CSV id = plan id) ---------------------------------

  const viewTrajectories = useCallback(
    (list: PlanRow[], title: string) =>
      work('viewTrajectories', async () => {
        const eligible = list.filter((p) => planPhase(p) === 'done' && p.csvResult)
        if (eligible.length === 0) return toast.warning(pa.toast.noProcessedToView)
        const trajectories: TrajectoryRow[][] = []
        const names: string[] = []
        for (const p of eligible) {
          try {
            trajectories.push(await parseTrajectoryCsv(await fp.fetchCsvResult(p.id)))
            names.push(p.customName)
          } catch {
            // a plan whose CSV cannot be read is skipped, as before
          }
        }
        if (trajectories.length === 0) return toast.warning(pa.toast.noProcessedToView)
        setViewer({ kind: 'multiTrajectory', title, trajectories, names })
      }),
    [work, fp, toast, pa, setViewer]
  )

  const viewFolderTrajectories = useCallback(
    (folder: FolderSummary) => viewTrajectories(plansOf(folder.id), interpolate(pa.viewers.folderTrajectories, { name: folder.name })),
    [viewTrajectories, plansOf, pa]
  )

  const downloadCsvs = useCallback(
    (list: PlanRow[], zipBase: string) =>
      work('downloadCsv', async () => {
        const ids = idsOf(list.filter((p) => planPhase(p) === 'done' && p.csvResult))
        if (ids.length === 0) return toast.warning(pa.toast.noProcessedToDownload)
        try {
          const items = await fp.fetchCsvResults(ids)
          await saveZips(items.map((i) => ({ name: i.customName, content: i.csvResult })), 'csv', zipBase)
        } catch (e) {
          toast.error(errorMessage(e, pa.toast.csvError))
        }
      }),
    [work, fp, toast, pa]
  )

  const downloadFolderCsvs = useCallback((folder: FolderSummary) => downloadCsvs(plansOf(folder.id), folder.name || 'folder'), [downloadCsvs, plansOf])

  // ---- Upload / import -------------------------------------------------------------

  /** External U-plan (.json with operationVolumes) imported as an already processed plan. */
  const importUplan = useCallback(
    async (file: File, folderId: number) => {
      if (!file.name.toLowerCase().endsWith('.json')) return toast.error(pa.toast.invalidFormat)
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        return toast.error(pa.toast.invalidJson)
      }
      if (!parsed || !Array.isArray(parsed.operationVolumes)) return toast.error(pa.toast.invalidUplan)
      try {
        await fp.importExternalUplan(parsed, folderId, file.name)
        toast.success(pa.toast.uplanImported)
      } catch (e) {
        toast.error(errorMessage(e, pa.toast.uplanImportError))
      }
    },
    [fp, toast, pa]
  )

  /** Plan files and zips (Dev): chunks of UPLOAD_BATCH plans per POST. */
  const uploadPlans = useCallback(
    (files: File[], folderId: number) =>
      work('upload', async () => {
        const virtual = await expandFiles(files)
        if (virtual.length === 0) return toast.warning(pa.toast.nothingToUpload)
        toast.info(interpolate(pa.toast.uploading, { n: virtual.length }))
        let created = 0
        for (let i = 0; i < virtual.length; i += UPLOAD_BATCH) {
          const payload = await Promise.all(
            virtual.slice(i, i + UPLOAD_BATCH).map(async (vf) => ({
              customName: planNameFromFile(vf.name),
              status: 'sin procesar' as const,
              fileContent: await vf.getText(),
              folderId,
            }))
          )
          const res = await fp.createFlightPlans(payload)
          if (!res) {
            toast.error(pa.toast.uploadError)
            break
          }
          created += res.createdCount
        }
        if (created > 0) toast.success(interpolate(pa.toast.uploaded, { n: created }))
      }),
    [work, fp, toast, pa]
  )

  /**
   * Files dropped / chosen on a folder. Prod: the first file is an external U-plan (.json).
   * Dev: .json files are external U-plans (as in prod), everything else is a plan file or a zip.
   */
  const handleFiles = useCallback(
    async (files: File[], folderId: number) => {
      if (mode === 'prod') {
        if (files[0]) await importUplan(files[0], folderId)
        return
      }
      const isJson = (f: File) => f.name.toLowerCase().endsWith('.json')
      for (const f of files.filter(isJson)) await importUplan(f, folderId)
      const rest = files.filter((f) => !isJson(f))
      if (rest.length) await uploadPlans(rest, folderId)
    },
    [mode, importUplan, uploadPlans]
  )

  // ---- Bulk (Dev) ------------------------------------------------------------------

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
    working,
    selectedPlans,
    createFolder,
    renameFolder,
    deleteFolder,
    cloneFolder,
    processFolder,
    saveFolderWindow,
    randomizeFolder,
    viewFolderTrajectories,
    downloadFolderCsvs,
    importUplan,
    uploadPlans,
    handleFiles,
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

export type GroupActions = ReturnType<typeof useGroupActions>
