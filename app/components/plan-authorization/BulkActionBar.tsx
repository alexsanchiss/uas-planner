'use client'

import { AlertCircle, Eye, FileJson, Loader2, Play, RotateCcw, Route, Send, ShieldCheck, ShieldOff, Table2, Trash2, X } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { ActionMenu, type MenuEntry } from './ActionMenu'
import { authPhase, hasScrsAlternative, planPhase } from './lib'
import { useBulkActions, type BulkDeps } from './useBulkActions'

interface Props {
  deps: BulkDeps
  onClear: () => void
}

const BTN =
  'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Dev: sticky bar for the ticked plans (bottom-anchored on phones). The count is a polite live region;
 * primary actions are inline, downloads and the destructive / rare ones live in two menus.
 */
export function BulkActionBar({ deps, onClear }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.bulk
  const g = useBulkActions(deps)
  const list = deps.group.selectedPlans
  const busy = deps.group.working !== null
  const eligibleAuth = list.some((p) => planPhase(p) === 'done' && authPhase(p) === 'none')
  const hasProcessed = list.some((p) => planPhase(p) === 'done' && p.csvResult)
  const hasApproved = list.some((p) => authPhase(p) === 'approved' && p.hasUplan)
  const hasErrors = list.some((p) => (authPhase(p) === 'denied' || authPhase(p) === 'withdrawn') && p.authorizationMessage)
  const hasAlternative = list.some(hasScrsAlternative)

  const download: MenuEntry[] = [
    { id: 'csv', label: pa.downloadCsv, icon: Table2, disabled: !hasProcessed, reason: pa.noProcessed, onSelect: g.downloadSelectedCsv },
    { id: 'plan', label: pa.downloadPlan, icon: FileJson, disabled: !list.some((p) => p.hasFileContent), reason: pa.noPlanFiles, onSelect: g.downloadSelectedPlans },
    { id: 'uplan', label: pa.downloadUplan, icon: FileJson, disabled: !list.some((p) => planPhase(p) === 'done' && p.scheduledAt), reason: pa.noScheduled, onSelect: g.downloadSelectedUplans },
  ]

  const more: MenuEntry[] = [
    { id: 'uplans', label: pa.viewUplans, icon: ShieldCheck, disabled: !hasApproved, reason: pa.noApproved, onSelect: g.viewAuthorizedUplans },
    { id: 'errors', label: pa.viewErrors, icon: AlertCircle, disabled: !hasErrors, reason: pa.noErrors, onSelect: g.viewErrors },
    { id: 'alternatives', label: pa.acceptAlternatives, icon: Route, disabled: !hasAlternative, reason: pa.noAlternatives, onSelect: g.acceptAlternativesSelected },
    { id: 'resetAuth', label: pa.resetAuth, icon: ShieldOff, separatorBefore: true, onSelect: g.resetAuthSelected },
    { id: 'reset', label: pa.reset, icon: RotateCcw, onSelect: g.resetSelected },
    { id: 'delete', label: pa.delete, icon: Trash2, tone: 'danger', onSelect: g.deleteSelected },
  ]

  return (
    <div role="region" aria-label={pa.label} className="sticky bottom-2 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-elevated p-3 shadow-theme-md">
        <p role="status" aria-live="polite" className="mr-auto flex items-center gap-2 text-sm font-semibold text-fg">
          {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {interpolate(pa.selected, { n: list.length })}
        </p>
        <button type="button" disabled={busy} onClick={g.processSelected} className={`${BTN} bg-brand text-brand-fg hover:bg-brand-hover`}>
          <Play className="h-4 w-4" aria-hidden="true" />
          {pa.process}
        </button>
        <button
          type="button"
          disabled={busy || !eligibleAuth}
          title={!eligibleAuth ? pa.noEligibleAuth : undefined}
          onClick={g.requestAuthSelected}
          className={`${BTN} border border-line-2 bg-surface text-fg hover:bg-hover`}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {pa.requestAuth}
        </button>
        <button
          type="button"
          disabled={busy || !hasProcessed}
          title={!hasProcessed ? pa.noProcessed : undefined}
          onClick={g.viewSelected}
          className={`${BTN} border border-line-2 bg-surface text-fg hover:bg-hover`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {pa.view}
        </button>
        <ActionMenu label={pa.download} entries={download} align="end" disabled={busy}>
          {pa.download}
        </ActionMenu>
        <ActionMenu label={pa.more} entries={more} align="end" disabled={busy}>
          {pa.more}
        </ActionMenu>
        <button type="button" onClick={onClear} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg" aria-label={pa.clear} title={pa.clear}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
