/**
 * Production workspace helpers: planProgress (position in the 5-step guide), needsAction, primaryActionId and the
 * list-row / progress text of planStatusText. Pure: no React, no network.
 */

// planStatus imports `interpolate` from the React barrel '@/app/i18n' (I18nContext.tsx cannot load in the node env),
// so it is mocked here with the same one-line implementation.
jest.mock('@/app/i18n', () => ({
  interpolate: (template: string, vars: Record<string, string | number>) => template.replace(/{(\w+)}/g, (_: string, key: string) => String(vars[key] ?? `{${key}}`)),
}))

import { getTranslation } from '@/app/i18n/translations'
import { completedSteps, currentStep, needsAction, planProgress, primaryActionId, WORKFLOW_STEPS, type PlanRow } from '../lib'
import { planStatusText } from '../planStatus'

const en = getTranslation('en').planAuth.workspace
const es = getTranslation('es').planAuth.workspace
const WHEN = '2030-01-01T10:00:00.000Z'

const plan = (over: Partial<PlanRow> = {}): PlanRow =>
  ({
    id: 1,
    customName: 'p',
    status: 'sin procesar',
    authorizationStatus: 'sin autorización',
    authorizationMessage: null,
    scheduledAt: null,
    csvResult: null,
    hasFileContent: true,
    hasUplan: false,
    folderId: null,
    ...over,
  }) as PlanRow

const processed = { status: 'procesado', scheduledAt: WHEN, csvResult: 1, hasUplan: true } as const

const CASES: { name: string; plan: PlanRow; kind: string; step: number; needsAction: boolean; line: string; short: string }[] = [
  { name: 'no plan file', plan: plan({ hasFileContent: false }), kind: 'noFile', step: 1, needsAction: false, line: 'No plan file', short: 'No plan file' },
  { name: 'uploaded, no time', plan: plan(), kind: 'step', step: 2, needsAction: true, line: 'Step 2 of 5 · Time', short: 'Time' },
  { name: 'uploaded with a U-plan draft, still unprocessed', plan: plan({ hasUplan: true }), kind: 'step', step: 2, needsAction: true, line: 'Step 2 of 5 · Time', short: 'Time' },
  { name: 'scheduled', plan: plan({ scheduledAt: WHEN }), kind: 'step', step: 3, needsAction: true, line: 'Step 3 of 5 · Process', short: 'Process' },
  { name: 'queued', plan: plan({ status: 'en cola', scheduledAt: WHEN }), kind: 'processing', step: 3, needsAction: false, line: 'Step 3 of 5 · Processing…', short: 'Processing…' },
  { name: 'processing', plan: plan({ status: 'procesando', scheduledAt: WHEN }), kind: 'processing', step: 3, needsAction: false, line: 'Step 3 of 5 · Processing…', short: 'Processing…' },
  { name: 'processed', plan: plan(processed), kind: 'step', step: 4, needsAction: true, line: 'Step 4 of 5 · Review', short: 'Review' },
  { name: 'pending at FAS', plan: plan({ ...processed, authorizationStatus: 'pendiente' }), kind: 'authorizing', step: 5, needsAction: false, line: 'Step 5 of 5 · Awaiting FAS', short: 'Awaiting FAS' },
  { name: 'Dev bulk marker counts as pending', plan: plan({ ...processed, authorizationStatus: 'procesando autorización' as never }), kind: 'authorizing', step: 5, needsAction: false, line: 'Step 5 of 5 · Awaiting FAS', short: 'Awaiting FAS' },
  { name: 'approved (no time shown when unscheduled)', plan: plan({ ...processed, scheduledAt: null, authorizationStatus: 'aprobado' }), kind: 'approved', step: 5, needsAction: false, line: 'Approved', short: 'Approved' },
  { name: 'denied', plan: plan({ ...processed, authorizationStatus: 'denegado' }), kind: 'denied', step: 5, needsAction: false, line: 'Denied', short: 'Denied' },
  { name: 'withdrawn', plan: plan({ ...processed, authorizationStatus: 'withdrawn' }), kind: 'withdrawn', step: 5, needsAction: false, line: 'Withdrawn', short: 'Withdrawn' },
  { name: 'error', plan: plan({ status: 'error', scheduledAt: WHEN }), kind: 'error', step: 3, needsAction: true, line: 'Step 3 of 5 · Processing failed', short: 'Processing failed' },
]

describe('planProgress / needsAction / planStatusText per state', () => {
  it.each(CASES)('$name', (c) => {
    const progress = planProgress(c.plan)
    expect({ kind: progress.kind, step: progress.step }).toEqual({ kind: c.kind, step: c.step })
    expect(needsAction(c.plan)).toBe(c.needsAction)
    const text = planStatusText(c.plan, en, 'en')
    expect({ line: text.line, short: text.short }).toEqual({ line: c.line, short: c.short })
    expect(text.progress).toEqual(progress)
  })

  it('an approved plan shows its scheduled time in the row ("Approved · <when>")', () => {
    const line = planStatusText(plan({ ...processed, authorizationStatus: 'aprobado' }), en, 'en').line
    expect(line).toMatch(/^Approved · .+\d{2}:\d{2}$/)
    expect(planStatusText(plan({ ...processed, authorizationStatus: 'aprobado' }), en, 'en').short).toBe('Approved')
  })

  it('the Spanish dictionary renders the same structure', () => {
    expect(planStatusText(plan(), es, 'es').line).toMatch(/^Paso 2 de 5 · .+/)
    expect(planStatusText(plan({ ...processed, authorizationStatus: 'aprobado' }), es, 'es').line).toMatch(/^Aprobado · .+/)
  })

  it('every step is 1..5 and within the guide', () => {
    for (const c of CASES) {
      expect(c.step).toBeGreaterThanOrEqual(1)
      expect(c.step).toBeLessThanOrEqual(WORKFLOW_STEPS.length)
    }
  })
})

describe('needsAction mirrors the primary action', () => {
  it('true only for set time / process / request authorization / reset', () => {
    expect(primaryActionId(plan())).toBe('schedule')
    expect(primaryActionId(plan({ scheduledAt: WHEN }))).toBe('process')
    expect(primaryActionId(plan(processed))).toBe('requestAuth')
    expect(primaryActionId(plan({ status: 'error' }))).toBe('reset')
    expect(primaryActionId(plan({ hasFileContent: false }))).toBeNull()
    expect(primaryActionId(plan({ ...processed, authorizationStatus: 'aprobado' }))).toBe('viewResult')
    expect(needsAction(plan({ ...processed, authorizationStatus: 'aprobado' }))).toBe(false)
  })
})

describe('the stepper and the progress text agree on the current step', () => {
  // currentStep: 'select'(1) 'datetime'(2) 'process'(3) 'geoawareness'(4) 'authorize'(5)
  const NUM: Record<string, number> = { select: 1, datetime: 2, process: 3, geoawareness: 4, authorize: 5 }

  it('for every state with a time set, the highlighted step is the "Step N of 5" of the row', () => {
    for (const c of CASES) {
      if (!c.plan.scheduledAt || ['approved', 'denied', 'withdrawn', 'error'].includes(c.kind)) continue // error: the stepper marks the failed step itself
      expect({ name: c.name, step: NUM[currentStep(c.plan)] }).toEqual({ name: c.name, step: c.step })
    }
  })

  it('decided plans have the whole guide completed', () => {
    for (const a of ['aprobado', 'denegado', 'withdrawn']) expect(completedSteps(plan({ ...processed, authorizationStatus: a as never }))).toEqual(WORKFLOW_STEPS)
  })

  // Pins today's behaviour for a processed plan that has no scheduledAt (e.g. an imported U-plan): the stepper
  // highlights "Time" (step 2) while the row says "Step 4 of 5". Reported to the owner as a finding.
  it('KNOWN GAP: a processed plan without scheduledAt is step 4 in the row but "Time" (2) in the stepper', () => {
    const p = plan({ status: 'procesado', csvResult: 1, hasUplan: true, scheduledAt: null })
    expect({ row: planProgress(p).step, stepper: NUM[currentStep(p)] }).toEqual({ row: 4, stepper: 2 })
  })
})
