'use client'

/**
 * Plan authorization: ONE component tree for both modes.
 *   mode 'prod' = guided workflow per plan (folders, plans, schedule, process, U-plan, FAS, viewers).
 *   mode 'dev'  = prod + the researcher / bulk tools (status chips, multi-select bar, folder tools,
 *                 plan uploads, per-folder time window).
 * Data comes from useFlightPlans / useFolders (summary listings, adaptive polling); heavy plan columns are
 * read on demand. See tasks/runs/F7/PARITY.md for the capability list this tree implements.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { CircleHelp, FolderPlus, Inbox, SearchX } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { useAuth } from '@/app/hooks/useAuth'
import { useFlightPlans } from '@/app/hooks/useFlightPlans'
import { useFolders } from '@/app/hooks/useFolders'
import { useToast } from '@/app/hooks/useToast'
import { useVolumeRegeneration } from '@/app/hooks/useVolumeRegeneration'
import { FolderPanel, type FolderPanelHandle, type FolderStatusCounts, type FolderView } from './FolderPanel'
import {
  countFilters,
  matchesFilter,
  matchesSelectKey,
  PAGE_SIZE,
  planPhase,
  SELECT_KEYS,
  type Mode,
  type PlanRow,
  type SelectKey,
  type StatusFilter,
} from './lib'
import { PlanCard } from './PlanCard'
import { PlanTable, type SortKey, type SortState } from './PlanTable'
import type { RowCtx } from './rowActions'
import { FolderSchedulePopover } from './SchedulePopover'
import { LoadError, PlanAuthSkeleton, StateMessage } from './States'
import { StatusChips } from './StatusChips'
import { SyncIndicator, SyncPausedBanner } from './SyncIndicator'
import { UploadDropzone } from './UploadDropzone'
import { useBusy } from './useBusy'
import { useConfirm } from './useConfirm'
import { useGroupActions } from './useGroupActions'
import { usePlanActions } from './usePlanActions'
import { ViewerHost } from './ViewerHost'

// Loaded on demand: the detail panel opens on click, the bulk bar only exists in Dev
const PlanDetail = dynamic(() => import('./PlanDetail').then((m) => m.PlanDetail), { ssr: false })
const BulkActionBar = dynamic(() => import('./BulkActionBar').then((m) => m.BulkActionBar), { ssr: false })

function sortPlans(list: PlanRow[], sort: SortState | null): PlanRow[] {
  if (!sort) return list
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    if (sort.key === 'name') return dir * a.customName.localeCompare(b.customName, undefined, { numeric: true, sensitivity: 'base' })
    const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : null
    const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : null
    if (ta === null || tb === null) return ta === tb ? 0 : ta === null ? 1 : -1 // unscheduled last, either direction
    return dir * (ta - tb)
  })
}

const SECONDARY =
  'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50'

export function PlanAuthorization({ mode }: { mode: Mode }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const pa = t.planAuth
  const toast = useToast()
  const dev = mode === 'dev'

  const fp = useFlightPlans({ summary: true })
  const fo = useFolders({ summary: true })
  // Auto-regenerate missing operation volumes every 30 s (P-61)
  useVolumeRegeneration(!!user)

  const plans = fp.flightPlans
  const folders = fo.folders
  const busy = useBusy()
  const confirm = useConfirm()

  const [view, setView] = useState<FolderView | null>(null)
  const [filter, setFilter] = useState<StatusFilter | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(1)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const actions = usePlanActions({ plans, fp, toast, confirm, busy })
  const group = useGroupActions({ mode, plans, fp, fo, toast, confirm, selected: selectedIds, setViewer: actions.setViewer })

  const panelRef = useRef<HTMLDivElement>(null)
  const foldersRef = useRef<FolderPanelHandle>(null)
  const selectPlanHandled = useRef(false)

  // ---- Keep view / focus / selection consistent with the data ------------------------

  const loaded = !fp.loading && !fo.loading
  const orphanCount = useMemo(() => plans.filter((p) => p.folderId === null).length, [plans])

  useEffect(() => {
    if (!loaded) return
    const exists = typeof view === 'number' && folders.some((f) => f.id === view)
    if (view === 'none' && orphanCount > 0) return
    if (exists) return
    setView(folders.length > 0 ? folders[0].id : orphanCount > 0 ? 'none' : null)
  }, [loaded, view, folders, orphanCount])

  useEffect(() => {
    if (!loaded) return
    const ids = new Set(plans.map((p) => p.id))
    setFocusedId((id) => (id !== null && !ids.has(id) ? null : id))
    setSelectedIds((prev) => (prev.every((id) => ids.has(id)) ? prev : prev.filter((id) => ids.has(id))))
  }, [loaded, plans])

  // P-19: ?selectPlan=ID (redirect from Plan Definition) focuses that plan (and ticks it in Dev)
  useEffect(() => {
    if (selectPlanHandled.current || !loaded || plans.length === 0) return
    const param = new URLSearchParams(window.location.search).get('selectPlan')
    if (!param) return
    selectPlanHandled.current = true
    const plan = plans.find((p) => String(p.id) === param)
    if (plan) {
      setFocusedId(plan.id)
      setView(plan.folderId ?? 'none')
      if (dev) setSelectedIds([plan.id])
      toast.success(interpolate(pa.toast.importedFromDefinition, { name: plan.customName }))
    }
    window.history.replaceState(null, '', '/plan-authorization')
  }, [loaded, plans, dev, toast, pa])

  // Bring the focused plan's panel into view (smooth unless the user prefers reduced motion)
  useEffect(() => {
    if (focusedId === null) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [focusedId])

  useEffect(() => setPage(1), [view, filter, sort])

  // ---- Derived lists -----------------------------------------------------------------

  const chipCounts = useMemo(() => countFilters(plans), [plans])

  const { folderCounts, folderStatus, noFolderCount } = useMemo(() => {
    const counts: Record<number, number> = {}
    const status: Record<number, FolderStatusCounts> = {}
    let none = 0
    for (const p of plans) {
      const shown = !filter || matchesFilter(p, filter)
      if (p.folderId === null) {
        if (shown) none++
        continue
      }
      if (shown) counts[p.folderId] = (counts[p.folderId] ?? 0) + 1
      const s = (status[p.folderId] ??= { unprocessed: 0, queued: 0, processing: 0, processed: 0, error: 0 })
      const phase = planPhase(p)
      if (phase === 'idle') s.unprocessed++
      else if (phase === 'queued') s.queued++
      else if (phase === 'processing') s.processing++
      else if (phase === 'done') s.processed++
      else s.error++
    }
    return { folderCounts: counts, folderStatus: status, noFolderCount: none }
  }, [plans, filter])

  const viewFolder = typeof view === 'number' ? folders.find((f) => f.id === view) ?? null : null
  const viewPlans = useMemo(() => (view === null ? [] : plans.filter((p) => (view === 'none' ? p.folderId === null : p.folderId === view))), [plans, view])
  const shownPlans = useMemo(() => sortPlans(filter ? viewPlans.filter((p) => matchesFilter(p, filter)) : viewPlans, sort), [viewPlans, filter, sort])
  const totalPages = Math.max(1, Math.ceil(shownPlans.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagePlans = shownPlans.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const focusedPlan = focusedId !== null ? plans.find((p) => p.id === focusedId) ?? null : null

  const ctx: RowCtx = { mode, a: actions, busy, folders, pa }

  // ---- Handlers ----------------------------------------------------------------------

  const onSort = useCallback(
    (key: SortKey) => setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null)),
    []
  )
  const toggleSelect = useCallback((id: number) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])), [])
  const togglePage = useCallback(
    (select: boolean) => {
      const ids = pagePlans.map((p) => p.id)
      setSelectedIds((prev) => (select ? [...prev, ...ids.filter((id) => !prev.includes(id))] : prev.filter((id) => !ids.includes(id))))
    },
    [pagePlans]
  )
  const selectBy = (key: SelectKey) => {
    const ids = viewPlans.filter((p) => matchesSelectKey(p, key)).map((p) => p.id)
    setSelectedIds((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))])
  }
  const deselectFolder = () => {
    const ids = new Set(viewPlans.map((p) => p.id))
    setSelectedIds((prev) => prev.filter((id) => !ids.has(id)))
  }
  const retry = () => {
    fp.resetErrors()
    void fp.refresh()
    void fo.refresh()
  }
  const focusPlan = (id: number) => setFocusedId((cur) => (cur === id ? null : id))

  // ---- Render ------------------------------------------------------------------------

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-fg">{pa.title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <SyncIndicator lastSyncedAt={fp.lastSyncedAt} isSyncing={fp.isSyncing} failed={!!fp.syncError} onRefresh={() => void Promise.all([fp.refresh(), fo.refresh()])} />
        <Link href="/how-it-works#plan-authorization-help" className={SECONDARY}>
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          {pa.help}
        </Link>
      </div>
    </header>
  )

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[40dvh] w-full max-w-7xl items-center justify-center px-4">
        <p className="text-fg-2">{pa.states.loginRequired}</p>
      </div>
    )
  }

  const noData = plans.length === 0 && folders.length === 0
  const initialLoading = !loaded && noData
  const loadFailed = (!!fp.error || !!fo.error) && noData

  const blocking = initialLoading ? <PlanAuthSkeleton /> : loadFailed ? <LoadError onRetry={retry} /> : null

  const viewName = view === 'none' ? pa.folders.noFolder : viewFolder?.name ?? ''

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      {header}

      {dev && !blocking && <StatusChips counts={chipCounts} active={filter} onChange={setFilter} />}
      {fp.errorCount >= 3 && <SyncPausedBanner onRetry={retry} />}

      {blocking}

      {!blocking && (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <div className="lg:sticky lg:top-4">
            <FolderPanel
              ref={foldersRef}
              mode={mode}
              folders={folders}
              counts={folderCounts}
              noFolderCount={noFolderCount}
              statusCounts={folderStatus}
              selected={view}
              onSelect={setView}
              onCreate={group.createFolder}
              onRename={group.renameFolder}
              onDelete={group.deleteFolder}
              onDropPlan={(planId, folderId) => {
                const plan = plans.find((p) => p.id === planId)
                if (plan) void actions.move(plan, folderId)
              }}
              onDropFiles={(files, folderId) => void group.handleFiles(files, folderId)}
              onClone={group.cloneFolder}
              onProcess={group.processFolder}
              onViewProcessed={group.viewFolderTrajectories}
              onDownloadCsvs={group.downloadFolderCsvs}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {focusedPlan && (
              <div ref={panelRef} className="scroll-mt-4">
                <PlanDetail plan={focusedPlan} ctx={ctx} onClose={() => setFocusedId(null)} />
              </div>
            )}

            {view === null && (
              <StateMessage icon={FolderPlus} title={pa.states.noFoldersTitle} body={pa.states.noFoldersBody}>
                <button type="button" onClick={() => foldersRef.current?.focusNew()} className="min-h-10 rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-hover">
                  {pa.states.noFoldersCta}
                </button>
              </StateMessage>
            )}

            {view !== null && (
              <>
                {viewFolder && (
                  <UploadDropzone mode={mode} folderName={viewFolder.name} disabled={group.working === 'upload'} onFiles={(files) => void group.handleFiles(files, viewFolder.id)} />
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-fg">
                    {viewName}{' '}
                    <span role="status" aria-live="polite" className="text-sm font-normal text-fg-2">
                      {filter ? interpolate(pa.table.countFiltered, { shown: shownPlans.length, total: viewPlans.length }) : interpolate(pa.table.count, { n: viewPlans.length })}
                    </span>
                  </h2>
                  {dev && viewFolder && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="pa-select-status" className="sr-only">
                        {pa.dev.selectByStatus}
                      </label>
                      <select
                        id="pa-select-status"
                        value=""
                        onChange={(e) => selectBy(e.target.value as SelectKey)}
                        className="min-h-9 rounded-md border border-input bg-input px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring"
                      >
                        <option value="" disabled>
                          {pa.dev.selectByStatus}
                        </option>
                        {SELECT_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {pa.dev.select[k]}
                          </option>
                        ))}
                      </select>
                      <button type="button" className={SECONDARY} onClick={deselectFolder} disabled={!viewPlans.some((p) => selectedSet.has(p.id))}>
                        {pa.dev.deselect}
                      </button>
                      <FolderSchedulePopover
                        folderName={viewFolder.name}
                        min={viewFolder.minScheduledAt}
                        max={viewFolder.maxScheduledAt}
                        planCount={viewPlans.length}
                        onSaveWindow={(min, max) => group.saveFolderWindow(viewFolder, min, max)}
                        onRandomize={() => group.randomizeFolder(viewFolder)}
                      />
                    </div>
                  )}
                </div>

                {viewPlans.length === 0 ? (
                  <StateMessage icon={Inbox} title={pa.states.emptyFolderTitle} body={dev ? pa.states.emptyFolderBodyDev : pa.states.emptyFolderBodyProd}>
                    {!dev && (
                      <Link href="/plan-definition" className={SECONDARY}>
                        {pa.states.goToPlanDefinition}
                      </Link>
                    )}
                  </StateMessage>
                ) : shownPlans.length === 0 ? (
                  <StateMessage icon={SearchX} title={pa.states.noMatchesTitle} body={pa.states.noMatchesBody}>
                    <button type="button" className={SECONDARY} onClick={() => setFilter(null)}>
                      {pa.filters.clear}
                    </button>
                  </StateMessage>
                ) : (
                  <>
                    <div className="hidden lg:block">
                      <PlanTable
                        plans={pagePlans}
                        ctx={ctx}
                        sort={sort}
                        onSort={onSort}
                        focusedId={focusedId}
                        selectedIds={selectedSet}
                        selectable={dev}
                        onToggleSelect={toggleSelect}
                        onTogglePage={togglePage}
                        onFocusPlan={focusPlan}
                      />
                    </div>
                    <ul className="space-y-3 lg:hidden">
                      {pagePlans.map((plan) => (
                        <li key={plan.id}>
                          <PlanCard plan={plan} ctx={ctx} focused={focusedId === plan.id} selected={selectedSet.has(plan.id)} selectable={dev} onToggleSelect={toggleSelect} onFocusPlan={focusPlan} />
                        </li>
                      ))}
                    </ul>
                    {totalPages > 1 && (
                      <nav aria-label={pa.table.pagination} className="flex items-center justify-between gap-3">
                        <button type="button" className={SECONDARY} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                          {pa.table.previous}
                        </button>
                        <span className="text-sm text-fg-2" aria-live="polite">
                          {interpolate(pa.table.page, { page: currentPage, total: totalPages })}
                        </span>
                        <button type="button" className={SECONDARY} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                          {pa.table.next}
                        </button>
                      </nav>
                    )}
                  </>
                )}
              </>
            )}

            {dev && selectedIds.length > 0 && <BulkActionBar g={group} onClear={() => setSelectedIds([])} />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={confirm.close}
        onConfirm={confirm.confirm}
        title={confirm.spec?.title}
        message={confirm.spec?.message ?? ''}
        warning={confirm.spec?.warning}
        confirmLabel={confirm.spec?.confirmLabel}
        cancelLabel={t.common.cancel}
        variant={confirm.spec?.variant ?? 'danger'}
      />

      <ViewerHost
        viewer={actions.viewer}
        onClose={actions.closeViewer}
        scrs={actions.scrs}
        onCloseScrs={actions.closeScrs}
        acceptingScrs={actions.acceptingScrs}
        onAcceptScrs={() => void actions.acceptScrs()}
        onOpenScrs={actions.openScrsFromResult}
        onFormSaved={() => void fp.refresh()}
        onFormRequestAuth={actions.requestAuthById}
      />
    </div>
  )
}

export default PlanAuthorization
