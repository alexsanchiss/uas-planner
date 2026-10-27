'use client'

/**
 * Folder and upload actions (PARITY A. Folders, B. Upload, P-37/P-38). The Dev-only bulk actions are in
 * useBulkActions.ts and the raw-plan upload in uploadPlans.ts, both loaded on demand.
 * Everything acts on explicit ids, through the useFlightPlans / useFolders hooks.
 */

import { useCallback, useState } from 'react'
import { interpolate, useI18n } from '@/app/i18n'
import type { UseFlightPlansReturn } from '@/app/hooks/useFlightPlans'
import type { FolderSummary, UseFoldersReturn } from '@/app/hooks/useFolders'
import type { useToast } from '@/app/hooks/useToast'
import { parseTrajectoryCsv, saveZips, type TrajectoryRow } from './files'
import { planPhase, randomTimes, type Mode, type PlanRow } from './lib'
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
      if (rest.length === 0) return
      await work('upload', async () => {
        const { uploadPlans } = await import('./uploadPlans') // Dev only: stays out of the production bundle
        await uploadPlans({ fp, toast, pa }, rest, folderId)
      })
    },
    [mode, importUplan, work, fp, toast, pa]
  )

  return {
    working,
    work,
    selectedPlans,
    createFolder,
    renameFolder,
    deleteFolder,
    cloneFolder,
    processFolder,
    saveFolderWindow,
    randomizeFolder,
    viewTrajectories,
    viewFolderTrajectories,
    downloadCsvs,
    downloadFolderCsvs,
    importUplan,
    handleFiles,
  }
}

export type GroupActions = ReturnType<typeof useGroupActions>
