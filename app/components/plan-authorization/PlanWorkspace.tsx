'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, CalendarClock, Loader2, Lock, SearchX } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { hasFailedScrsAlternative } from '@/lib/scrs'
import { ActionMenu } from './ActionMenu'
import { InlineNameForm } from './InlineNameForm'
import { authPhase, formatDateTime, formatShortDateTime, isScheduleLocked, messageText, planPhase, type PlanRow, type ProgressKind } from './lib'
import { planStatusText } from './planStatus'
import { PrimaryAction } from './PrimaryAction'
import { planManageEntries, planViewEntries, primaryView, type RowCtx } from './rowActions'
import { ScheduleField } from './SchedulePopover'
import { AuthStatusBadge, PlanStatusBadge } from './StatusBadge'
import { WorkflowStepper } from './WorkflowStepper'

const FILL: Record<ProgressKind, string> = {
  noFile: 'bg-brand',
  step: 'bg-brand',
  processing: 'bg-brand',
  authorizing: 'bg-warning',
  approved: 'bg-success',
  denied: 'bg-danger',
  withdrawn: 'bg-warning',
  error: 'bg-danger',
}

interface Props {
  plan: PlanRow
  ctx: RowCtx
  /** Phones: move focus to the heading when the plan opens (the list screen is replaced by this one). */
  focusOnOpen: boolean
  /** Phones: back to the list. */
  onBack: () => void
}

/** Production workspace of ONE plan: header, 5 steps, the single action of the current step and the views of this plan. */
export function PlanWorkspace({ plan, ctx, focusOnOpen, onBack }: Props) {
  const { t, language } = useI18n()
  const pa = t.planAuth
  const w = pa.workspace
  const [renaming, setRenaming] = useState(false)
  const [changing, setChanging] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const wasRenaming = useRef(false)
  const timeFormId = useId()
  const stepId = useId()
  const viewsId = useId()

  useEffect(() => {
    if (!focusOnOpen) return
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the workspace opens (it is keyed by plan)
  }, [])
  useEffect(() => {
    if (wasRenaming.current && !renaming) heading.current?.focus()
    wasRenaming.current = renaming
  }, [renaming])

  const status = planStatusText(plan, w, language)
  const { kind, step } = status.progress
  const locked = isScheduleLocked(plan)
  const primary = primaryView(plan, ctx)
  const auth = authPhase(plan)
  const manage = planManageEntries(plan, ctx, () => setRenaming(true))
  // The primary action already opens the result: no second tile for it
  const tiles = planViewEntries(plan, ctx).filter((e) => !(e.id === 'result' && primary?.id === 'viewResult'))
  const scheduledShort = formatShortDateTime(plan.scheduledAt, language)
  const messageForAlt = messageText(plan.authorizationMessage)
  const noAlternative = auth === 'denied' && !!messageForAlt && hasFailedScrsAlternative(messageForAlt)
  const timeStep = kind === 'step' && step === 2
  const processStep = kind === 'step' && step === 3
  const savingTime = ctx.busy.is('schedule', plan.id)
  const hasBar = !!primary

  // Phones: the action bar is fixed; the page reserves its height (rule in globals.css) while it is mounted
  useEffect(() => {
    if (!hasBar) return
    document.body.setAttribute('data-action-bar', '')
    return () => document.body.removeAttribute('data-action-bar')
  }, [hasBar])

  const copy =
    kind === 'noFile'
      ? { title: w.titles.noFile, body: pa.workflow.prompts.noPlanFile }
      : kind === 'step'
        ? step === 2
          ? { title: w.titles.time, body: pa.workflow.scheduleHint }
          : step === 3
            ? { title: w.titles.process, body: pa.workflow.prompts.readyToProcess }
            : { title: w.titles.review, body: pa.workflow.prompts.processed }
        : kind === 'processing'
          ? { title: w.titles.processing, body: pa.workflow.prompts.processing }
          : kind === 'authorizing'
            ? { title: w.titles.authorizing, body: pa.workflow.prompts.fasProcessing }
            : kind === 'error'
              ? { title: w.titles.error, body: pa.workflow.prompts.error }
              : { title: w.titles[kind], body: pa.workflow.prompts.decided }

  const actionClass = 'w-full lg:w-auto'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg-2 hover:bg-hover hover:text-fg lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {w.yourPlans}
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <InlineNameForm
                initial={plan.customName}
                label={pa.row.nameLabel}
                validate={(n) => (!n ? pa.row.nameEmpty : n.length > 100 ? pa.row.nameTooLong : null)}
                onSubmit={(n) => ctx.a.rename(plan, n)}
                onClose={() => setRenaming(false)}
              />
            ) : (
              <h2 ref={heading} tabIndex={-1} className="break-words text-xl font-semibold text-fg outline-none">
                {plan.customName}
              </h2>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <PlanStatusBadge phase={planPhase(plan)} />
              <AuthStatusBadge phase={auth} />
              {scheduledShort && (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-subtle px-2 py-0.5 text-xs font-medium text-fg-2"
                  title={`${w.scheduledBadge}: ${formatDateTime(plan.scheduledAt, language)}`}
                >
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {scheduledShort}
                </span>
              )}
            </div>
          </div>
          <ActionMenu label={interpolate(w.manageFor, { name: plan.customName })} entries={manage} touch />
        </div>
      </header>

      <div className="hidden lg:block">
        <WorkflowStepper plan={plan} labels={w.steps} />
      </div>
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium text-fg">{interpolate(w.stepOf, { n: step })}</span>
          <span className="truncate text-fg-2">{status.short}</span>
        </div>
        <div
          role="progressbar"
          aria-label={interpolate(w.progressFor, { name: plan.customName })}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={step}
          aria-valuetext={status.line}
          className="mt-2 h-2 overflow-hidden rounded-full bg-subtle"
        >
          <div className={`h-full rounded-full ${FILL[kind]}`} style={{ width: `${step * 20}%` }} />
        </div>
      </div>

      <section
        aria-labelledby={stepId}
        className="lg:rounded-t-lg lg:border lg:border-b-0 lg:border-line lg:bg-surface lg:px-5 lg:pb-3 lg:pt-5"
      >
        <h3 id={stepId} className="text-base font-semibold text-fg">
          {copy.title}
        </h3>
        <p className="mt-1 max-w-prose text-sm text-fg-2">{copy.body}</p>

        {timeStep && (
          <div className="mt-4 max-w-sm">
            <ScheduleField
              formId={timeFormId}
              value={plan.scheduledAt}
              label={pa.workflow.scheduleLabel}
              disabled={locked}
              onSave={(iso) => ctx.a.schedule(plan, iso)}
            />
          </div>
        )}

        {processStep && (
          <div className="mt-3">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-2">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {interpolate(w.scheduledFor, { when: formatDateTime(plan.scheduledAt, language) })}
              </span>
              {locked ? (
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {pa.workflow.locked}
                </span>
              ) : (
                <button
                  type="button"
                  aria-expanded={changing}
                  onClick={() => setChanging((c) => !c)}
                  className="inline-flex min-h-11 items-center rounded-md px-1 font-medium text-brand-text hover:underline lg:min-h-9"
                >
                  {w.changeTime}
                </button>
              )}
            </p>
            {changing && !locked && (
              <div className="mt-2 max-w-sm rounded-lg border border-line bg-surface-2 p-4">
                <ScheduleField
                  key={plan.scheduledAt ?? 'none'}
                  value={plan.scheduledAt}
                  label={pa.workflow.scheduleLabel}
                  onSave={async (iso) => {
                    const ok = await ctx.a.schedule(plan, iso)
                    if (ok) setChanging(false)
                    return ok
                  }}
                />
              </div>
            )}
          </div>
        )}

        {noAlternative && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-danger-line bg-danger-soft px-3 py-1.5 text-sm font-medium text-danger-text">
            <SearchX className="h-4 w-4" aria-hidden="true" />
            {pa.workflow.noAlternativeFound}
          </p>
        )}
      </section>

      {primary && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:static lg:-mt-4 lg:rounded-b-lg lg:border lg:border-t-0 lg:px-5 lg:pb-5 lg:pt-1">
          {primary.id === 'schedule' ? (
            <button
              type="submit"
              form={timeFormId}
              disabled={savingTime || locked}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-10 ${actionClass}`}
            >
              {savingTime ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}
              {w.saveTime}
            </button>
          ) : (
            <PrimaryAction plan={plan} ctx={ctx} touch className={actionClass} />
          )}
        </div>
      )}
      {tiles.length > 0 && (
        <section aria-labelledby={viewsId}>
          <h3 id={viewsId} className="mb-2 text-sm font-semibold text-fg">
            {w.views}
          </h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {tiles.map((e) => {
              const Icon = e.icon
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={e.loading}
                    aria-busy={e.loading || undefined}
                    onClick={e.onSelect}
                    className="flex min-h-[4.5rem] w-full flex-col items-start justify-between gap-2 rounded-lg border border-line bg-surface p-3 text-left text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {e.loading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-fg-2 motion-reduce:animate-none" aria-hidden="true" />
                    ) : Icon ? (
                      <Icon className="h-5 w-5 text-fg-2" aria-hidden="true" />
                    ) : null}
                    <span>{e.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
