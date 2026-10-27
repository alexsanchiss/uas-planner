'use client'

/**
 * Plan authorization, production layout: ONE plan at a time, guided, no bulk.
 *   >= lg: two panes (sticky plan list | workspace of the selected plan).
 *   <  lg: two screens in the same route (list | workspace); the selection lives in the URL (?selectPlan=<id>)
 *          and is pushed to the history, so the browser / OS back gesture returns to the list.
 * Same hooks, actions, confirmations and viewers as Dev (see DevPlanAuthorization); PARITY.md has the capability list.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CircleHelp, Inbox } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { useAuth } from '@/app/hooks/useAuth'
import { useFlightPlans } from '@/app/hooks/useFlightPlans'
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

  const fp = useFlightPlans({ summary: true })
  const fo = useFolders({ summary: true })
  useVolumeRegeneration(!!user) // regenerates missing operation volumes every 30 s (P-61)

  const plans = fp.flightPlans
  const folders = fo.folders
  const busy = useBusy()
  const confirm = useConfirm()
  const actions = usePlanActions({ plans, fp, toast, confirm, busy })
  const group = useGroupActions({ mode: 'prod', plans, fp, fo, toast, confirm, selected: NONE_SELECTED, setViewer: actions.setViewer })

  const loaded = !fp.loading && !fo.loading
  const noData = plans.length === 0 && folders.length === 0
  const loadFailed = (!!fp.error || !!fo.error) && noData

  // ---- Selection lives in the URL ----------------------------------------------------

  const param = params.get('selectPlan')
  const selectedPlan = useMemo(() => (param ? plans.find((p) => String(p.id) === param) ?? null : null), [param, plans])
  const selectedId = selectedPlan?.id ?? null
  const pushed = useRef(false) // this visit pushed the plan screen on the history (phones)
  const handledParam = useRef(false)
  const lastOpened = useRef<number | null>(null)
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
    if (!loaded || !param || selectedPlan || clearing.current === param) return
    clearing.current = param
    if (pushed.current) {
      pushed.current = false
      router.back()
    } else go(null, 'replace')
  }, [loaded, param, selectedPlan, go, router])

  // Desktop: never an empty workspace; the first plan that needs action, else the first plan (visual list order)
  useEffect(() => {
    if (!loaded || !wide || selectedId !== null) return
    const ordered = [...folders.flatMap((f) => plans.filter((p) => p.folderId === f.id)), ...plans.filter((p) => p.folderId === null)]
    const first = ordered.find(needsAction) ?? ordered[0]
    if (first) go(first.id, 'replace')
  }, [loaded, wide, selectedId, folders, plans, go])

  // Phones: back on the list, focus returns to the row that was open
  useEffect(() => {
    if (selectedId === null && lastOpened.current !== null && !wide) {
      // the row that was open, or the list heading when that plan is gone
      const row = document.querySelector<HTMLElement>(`[data-plan-row="${lastOpened.current}"]`) ?? document.querySelector<HTMLElement>('[data-plan-list-heading]')
      row?.focus()
    }
    lastOpened.current = selectedId
  }, [selectedId, wide])

  const retry = () => {
    fp.resetErrors()
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
              plans={plans}
              selectedId={selectedId}
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
            ) : plans.length === 0 ? (
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
