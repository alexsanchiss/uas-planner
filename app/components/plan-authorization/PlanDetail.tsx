'use client'

import { Loader2, Lock, SearchX, X } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { hasFailedScrsAlternative } from '@/lib/scrs'
import { authPhase, currentStep, getWorkflowState, isScheduleLocked, messageText, planPhase, type PlanRow } from './lib'
import { PrimaryAction } from './PrimaryAction'
import { planMenuEntries, type RowCtx } from './rowActions'
import { ScheduleField } from './SchedulePopover'
import { AuthStatusBadge, PlanStatusBadge } from './StatusBadge'
import { WorkflowStepper } from './WorkflowStepper'

interface Props {
  plan: PlanRow
  ctx: RowCtx
  onClose: () => void
}

const SECONDARY =
  'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50'

/** Dev: focused plan: guided workflow, date/time, what to do next and the review / viewer buttons. */
export function PlanDetail({ plan, ctx, onClose }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.workflow
  const state = getWorkflowState(plan)
  const locked = isScheduleLocked(plan)
  const step = currentStep(plan)
  const auth = authPhase(plan)
  const entries = planMenuEntries(plan, ctx, () => {})
  const quick = (ids: string[]) => entries.filter((e) => ids.includes(e.id))
  const showSchedule = step === 'datetime' || !!plan.scheduledAt

  const messageForAlt = messageText(plan.authorizationMessage)
  const noAlternative = auth === 'denied' && !!messageForAlt && hasFailedScrsAlternative(messageForAlt)

  const prompt =
    state === 'unprocessed'
      ? plan.hasFileContent
        ? plan.scheduledAt
          ? pa.prompts.readyToProcess
          : pa.prompts.setTime
        : pa.prompts.noPlanFile
      : state === 'processing'
        ? pa.prompts.processing
        : state === 'processed'
          ? pa.prompts.processed
          : state === 'authorizing'
            ? pa.prompts.fasProcessing
            : state === 'error'
              ? pa.prompts.error
              : pa.prompts.decided

  const viewers = quick(planPhase(plan) === 'done' ? ['editUplan', 'uplan3d', 'trajectory3d', 'geo3d', 'downloadUplan', 'result', 'scrs'] : ['waypoints', 'editUplan'])

  return (
    <section aria-label={interpolate(pa.panelFor, { name: plan.customName })} className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-fg">{plan.customName}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <PlanStatusBadge phase={planPhase(plan)} />
            <AuthStatusBadge phase={auth} />
          </div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-fg-2 hover:bg-hover hover:text-fg" aria-label={pa.close}>
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{pa.close}</span>
        </button>
      </div>

      <WorkflowStepper plan={plan} />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {showSchedule && (
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <ScheduleField
              key={plan.scheduledAt ?? 'none'}
              value={plan.scheduledAt}
              label={pa.scheduleLabel}
              disabled={locked}
              onSave={(iso) => ctx.a.schedule(plan, iso)}
            />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-2">
              {locked ? (
                <>
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {pa.locked}
                </>
              ) : (
                pa.scheduleHint
              )}
            </p>
          </div>
        )}

        <div className={`rounded-lg border border-line bg-surface-2 p-4 ${showSchedule ? '' : 'md:col-span-2'}`}>
          <p className="text-sm text-fg-2">{prompt}</p>
          {viewers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {viewers.map((e) => {
                const Icon = e.icon
                return (
                  <button key={e.id} type="button" className={SECONDARY} disabled={e.disabled || e.loading} title={e.disabled ? e.reason : undefined} onClick={e.onSelect}>
                    {e.loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                    {e.label}
                  </button>
                )
              })}
            </div>
          )}
          {noAlternative && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-danger-line bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger-text">
              <SearchX className="h-4 w-4" aria-hidden="true" />
              {pa.noAlternativeFound}
            </p>
          )}
          <div className="mt-4">
            <PrimaryAction plan={plan} ctx={ctx} />
          </div>
        </div>
      </div>
    </section>
  )
}
