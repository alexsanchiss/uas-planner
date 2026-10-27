'use client'

import { Check, Loader2, X } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { completedSteps, currentStep, getWorkflowState, WORKFLOW_STEPS, type PlanRow, type WorkflowStep } from './lib'

type StepStatus = 'completed' | 'current' | 'processing' | 'error' | 'upcoming'

const CIRCLE: Record<StepStatus, string> = {
  completed: 'border-success bg-success text-success-fg',
  current: 'border-brand-ring bg-brand text-brand-fg ring-2 ring-brand-ring ring-offset-2 ring-offset-surface',
  processing: 'border-warning bg-warning text-warning-fg',
  error: 'border-danger bg-danger text-danger-fg',
  upcoming: 'border-line-2 bg-surface text-muted',
}

/**
 * Five-step guide (select, date/time, process, geoawareness, authorize); state is never colour alone.
 * `labels` = short names without descriptions (production workspace); omitted = Dev's labels with descriptions.
 */
export function WorkflowStepper({ plan, labels }: { plan: PlanRow; labels?: Record<WorkflowStep, string> }) {
  const { t } = useI18n()
  const pa = t.planAuth.workflow
  const state = getWorkflowState(plan)
  const step = currentStep(plan)
  const done = completedSteps(plan)

  const statusOf = (id: WorkflowStep): StepStatus => {
    if (state === 'error' && id === 'process') return 'error'
    if (state === 'processing' && id === 'process') return 'processing'
    if (state === 'authorizing' && id === 'authorize') return 'processing'
    if (done.includes(id)) return 'completed'
    return id === step ? 'current' : 'upcoming'
  }

  return (
    <ol className="flex items-start" aria-label={pa.label}>
      {WORKFLOW_STEPS.map((id, i) => {
        const status = statusOf(id)
        return (
          <li key={id} aria-current={status === 'current' ? 'step' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-4 -z-0 h-0.5 w-full ${done.includes(id) || status === 'completed' ? 'bg-success' : 'bg-line'}`} />}
            <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${CIRCLE[status]}`}>
              {status === 'completed' ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : status === 'processing' ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : status === 'error' ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                i + 1
              )}
            </span>
            <span className={`mt-1.5 text-xs sm:text-sm ${status === 'upcoming' ? 'text-muted' : 'font-medium text-fg'}`}>{labels ? labels[id] : pa.steps[id].label}</span>
            <span className="sr-only">{pa.status[status]}</span>
            {!labels && <span className="mt-0.5 hidden text-xs text-fg-2 md:block">{pa.steps[id].description}</span>}
          </li>
        )
      })}
    </ol>
  )
}
