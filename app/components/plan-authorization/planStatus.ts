/** Text of "where is this plan" for the production list rows and the workspace progress (pure, no React). */

import { interpolate, type Translations } from '@/app/i18n'
import { formatShortDateTime, planProgress, WORKFLOW_STEPS, type PlanProgress, type PlanRow } from './lib'

type Workspace = Translations['planAuth']['workspace']

export interface PlanStatusText {
  progress: PlanProgress
  /** One line for a list row: "Step 3 of 5 · Process", "Approved · 28 Oct, 10:00", "Denied". */
  line: string
  /** Short state name (current step label or final state), shown next to "Step N of 5" on phones. */
  short: string
}

export function planStatusText(plan: PlanRow, w: Workspace, language: string): PlanStatusText {
  const progress = planProgress(plan)
  const stepLine = (short: string) => interpolate(w.stepLine, { n: progress.step, label: short })
  switch (progress.kind) {
    case 'step': {
      const short = w.steps[WORKFLOW_STEPS[progress.step - 1]]
      return { progress, short, line: stepLine(short) }
    }
    case 'processing':
      return { progress, short: w.status.processing, line: stepLine(w.status.processing) }
    case 'authorizing':
      return { progress, short: w.status.awaitingFas, line: stepLine(w.status.awaitingFas) }
    case 'error':
      return { progress, short: w.status.error, line: stepLine(w.status.error) }
    case 'approved': {
      const when = formatShortDateTime(plan.scheduledAt, language)
      return { progress, short: w.status.approved, line: when ? interpolate(w.approvedAt, { when }) : w.status.approved }
    }
    case 'denied':
      return { progress, short: w.status.denied, line: w.status.denied }
    case 'withdrawn':
      return { progress, short: w.status.withdrawn, line: w.status.withdrawn }
    case 'noFile':
      return { progress, short: w.status.noFile, line: w.status.noFile }
  }
}
