'use client'

/**
 * Plan authorization, production layout: ONE plan at a time, guided, no bulk.
 *   >= lg: two panes (sticky plan list | workspace of the selected plan).
 *   <  lg: two screens in the same route (list | workspace); the selection lives in the URL (?selectPlan=<id>)
 *          and is pushed to the history, so the browser / OS back gesture returns to the list.
 * Same actions, confirmations and viewers as Dev (see DevPlanAuthorization); PARITY.md has the capability list.
 * Scale: the list never loads every plan. Folders come with their plan counts (useFolders `counts`), a folder loads
 * its first 25 plans when it is expanded, the name search runs on the server and the selected plan is fetched by id
 * (useFolderPlans). Polling refreshes only what is on screen.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CircleHelp, Inbox } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { useAuth } from '@/app/hooks/useAuth'
import { POLL_IDLE_MS } from '@/app/hooks/useFlightPlans'
import { folderKey, NO_FOLDER_KEY, SEARCH_KEY, useFolderPlans } from '@/app/hooks/useFolderPlans'
import { useFolders } from '@/app/hooks/useFolders'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { useToast } from '@/app/hooks/useToast'
import { useVolumeRegeneration } from '@/app/hooks/useVolumeRegeneration'
import { needsAction } from './lib'
import { PlanList } from './PlanList'
import { PlanWorkspace } from './PlanWorkspace'
import type { RowCtx } from './rowActions'
import { LoadError, PlanListSkeleton, StateMessage } from './States'
import { SyncIndicator, SyncPausedBanner } from './SyncIndicator'
import { useBusy } from './useBusy'
import { useConfirm } from './useConfirm'
import { useGroupActions } from './useGroupActions'
import { usePlanActions } from './usePlanActions'
import { ViewerHost } from './ViewerHost'

const SECONDARY =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover lg:min-h-9'
const NONE_SELECTED: number[] = []

export function ProdPlanAuthorization() {
  const { user } = useAuth()
  const { t } = useI18n()
  const pa = t.planAuth
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const wide = useMediaQuery('(min-width: 1024px)')

  const param = params.get('selectPlan')
  const paramId = param && /^\d+$/.test(param) ? Number(param) : null

  // Folder counts at the slow rate; the plans of the groups on screen + the selected plan (3 s while one is in progress)
  const fo = useFolders({ counts: true, pollingInterval: POLL_IDLE_MS, pollingEnabled: true })
  const pg = useFolderPlans({ selectedId: paramId, onCountsStale: fo.refresh })
  const fp = pg.fp
  const { open: openGroup } = pg
  const pgRef = useRef(pg) // latest pages for the effects below, without re-running them on every render
  pgRef.current = pg
  useVolumeRegeneration(!!user) // regenerates missing operation volumes every 30 s (P-61)

  const plans = fp.flightPlans // loaded rows only
  const folders = fo.folders
  const busy = useBusy()
  const confirm = useConfirm()
  const actions = usePlanActions({ plans, fp, toast, confirm, busy })
  const group = useGroupActions({ mode: 'prod', plans, fp, fo, toast, confirm, selected: NONE_SELECTED, setViewer: actions.setViewer, approvedIdsOf: pg.approvedIdsOf })

  const loaded = !fp.loading && !fo.loading
  const noData = folders.length === 0 && fo.noFolderCount === 0
  const loadFailed = (!!fp.error || !!fo.error) && noData

  // ---- Selection lives in the URL ----------------------------------------------------

  const selectedPlan = useMemo(() => (paramId === null ? null : plans.find((p) => p.id === paramId) ?? null), [paramId, plans])
  const selectedId = selectedPlan?.id ?? null
  // The URL names a plan that is not there (deleted, stale link): known once it was seen, or the server said so
  const seen = useRef<string | null>(null)
  if (selectedPlan) seen.current = param
  const settled = !param || paramId === null || !!selectedPlan || pg.selectedMissing || seen.current === param
  const pushed = useRef(false) // this visit pushed the plan screen on the history (phones)
  const handledParam = useRef(false)
  const prevParam = useRef<string | null>(param)
  const clearing = useRef<string | null>(null) // stale ?selectPlan being cleared (one history operation)

  const go = useCallback(
    (id: number | null, how: 'push' | 'replace') => {
      const url = id === null ? pathname : `${pathname}?selectPlan=${id}`
      if (how === 'push') router.push(url, { scroll: false })
      else router.replace(url, { scroll: false })
    },
    [router, pathname]
  )

  const select = (id: number) => {
    if (id === selectedId) return
    if (wide) return go(id, 'replace')
    pushed.current = true
    go(id, 'push')
  }

  const back = () => {
    if (pushed.current) {
      pushed.current = false
      router.back()
    } else go(null, 'replace')
  }

  // Redirect from Plan Definition (?selectPlan=ID on arrival): same welcome toast as before
  useEffect(() => {
    if (handledParam.current || !loaded || plans.length === 0) return
    handledParam.current = true
    if (selectedPlan) toast.success(interpolate(pa.toast.importedFromDefinition, { name: selectedPlan.customName }))
  }, [loaded, plans.length, selectedPlan, toast, pa])

  // A plan that no longer exists (deleted, stale link) clears the selection. If this visit pushed the plan screen,
  // going back removes that entry (history [list]); otherwise the entry is replaced.
  useEffect(() => {
    if (!param) clearing.current = null
    if (!loaded || !param || !settled || selectedPlan || clearing.current === param) return
    clearing.current = param
    if (pushed.current) {
      pushed.current = false
      router.back()
    } else go(null, 'replace')
  }, [loaded, param, settled, selectedPlan, go, router])

  // Desktop: open the first group that has plans (nothing else is loaded until a folder is expanded)
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoOpened.current || fo.loading || !wide || param) return
    autoOpened.current = true
    const first = folders.find((f) => f.planCount > 0)
    if (first) openGroup(String(first.id))
    else if (fo.noFolderCount > 0) openGroup(NO_FOLDER_KEY)
  }, [fo.loading, wide, param, folders, fo.noFolderCount, openGroup])

  // Desktop: never an empty workspace; the first loaded plan that needs action, else the first loaded plan (visual list order)
  useEffect(() => {
    if (!loaded || !wide || param) return
    const { search, rowsOf } = pgRef.current
    const ordered = search ? rowsOf(SEARCH_KEY) : [...folders.flatMap((f) => rowsOf(folderKey(f.id))), ...rowsOf(NO_FOLDER_KEY)]
    const first = ordered.find(needsAction) ?? ordered[0]
    if (first) go(first.id, 'replace')
  }, [loaded, wide, param, folders, plans, go])

  // Phones: once the URL is back on the list (back button / gesture, or the open plan was deleted), focus the row that
  // was open, or the list heading when that plan is gone. Keyed on the URL so it runs after the navigation.
  useEffect(() => {
    const was = prevParam.current
    prevParam.current = param
    if (!was || param || wide) return
    const raf = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-plan-row="${was}"]`) ?? document.querySelector<HTMLElement>('[data-plan-list-heading]')
      target?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [param, wide])

  const retry = () => {
    fp.resetErrors()
    fo.startPolling()
    void fp.refresh()
    void fo.refresh()
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[40dvh] w-full max-w-7xl items-center justify-center px-4">
        <p className="text-fg-2">{pa.states.loginRequired}</p>
      </div>
    )
  }

  const ctx: RowCtx = { mode: 'prod', a: actions, busy, folders, pa }
  const workspaceScreen = selectedPlan !== null // phones: the workspace replaces the list

  const noPlans = (
    <StateMessage icon={Inbox} title={pa.workspace.noPlansTitle} body={pa.workspace.noPlansBody}>
      <Link href="/plan-definition" className={SECONDARY}>
        {pa.states.goToPlanDefinition}
      </Link>
    </StateMessage>
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* The workspace screen on phones has its own heading: the page header only stays for screen readers */}
      <header className={`flex-wrap items-center justify-between gap-3 ${workspaceScreen ? 'sr-only lg:not-sr-only lg:flex' : 'flex'}`}>
        <h1 className="text-2xl font-bold text-fg">{pa.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SyncIndicator lastSyncedAt={fp.lastSyncedAt} isSyncing={fp.isSyncing} failed={!!fp.syncError} onRefresh={() => void Promise.all([fp.refresh(), fo.refresh()])} />
          <Link href="/how-it-works#plan-authorization-help" className={SECONDARY}>
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
            {pa.help}
          </Link>
        </div>
      </header>

      {fp.errorCount >= 3 && <SyncPausedBanner onRetry={retry} />}

      {!loaded && noData ? (
        <PlanListSkeleton />
      ) : loadFailed ? (
        <LoadError onRetry={retry} />
      ) : (
        <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className={`${workspaceScreen ? 'hidden lg:block' : ''} lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1`}>
            <PlanList
              folders={folders}
              noFolderCount={fo.noFolderCount}
              list={pg}
              selectedId={selectedId}
              selectedKey={selectedPlan ? folderKey(selectedPlan.folderId) : null}
              onSelect={select}
              onCreateFolder={group.createFolder}
              onRenameFolder={group.renameFolder}
              onDeleteFolder={group.deleteFolder}
              onImport={(files, folderId) => void group.handleFiles(files, folderId)}
              onMovePlan={(planId, folderId) => {
                const plan = plans.find((p) => p.id === planId)
                if (plan) void actions.move(plan, folderId)
              }}
              empty={noPlans}
            />
          </div>

          <div className={`min-w-0 ${workspaceScreen ? '' : 'hidden lg:block'}`}>
            {selectedPlan ? (
              <PlanWorkspace key={selectedPlan.id} plan={selectedPlan} ctx={ctx} focusOnOpen={!wide} onBack={back} />
            ) : noData ? (
              noPlans
            ) : (
              <p className="text-sm text-fg-2">{pa.workspace.selectPrompt}</p>
            )}
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
