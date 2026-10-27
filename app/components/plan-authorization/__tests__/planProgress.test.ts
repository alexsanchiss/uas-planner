/**
 * Production workspace helpers: planProgress (position in the 5-step guide), needsAction, primaryActionId and the
 * list-row / progress text of planStatusText. Pure: no React, no network.
 */

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
  { name: 'processed without a time (imported U-plan)', plan: plan({ ...processed, scheduledAt: null, hasFileContent: false, csvResult: 0 }), kind: 'step', step: 4, needsAction: true, line: 'Step 4 of 5 \u00b7 Review', short: 'Review' },
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

  it('for every state, the highlighted step of the stepper is the "Step N of 5" of the row (one source: currentStep)', () => {
    for (const c of CASES) {
      // decided: whole guide done; error: the stepper marks the failed step; noFile: no stepper position
      if (['approved', 'denied', 'withdrawn', 'error', 'noFile'].includes(c.kind)) continue
      expect({ name: c.name, step: NUM[currentStep(c.plan)] }).toEqual({ name: c.name, step: c.step })
    }
  })

  it('decided plans have the whole guide completed', () => {
    for (const a of ['aprobado', 'denegado', 'withdrawn']) expect(completedSteps(plan({ ...processed, authorizationStatus: a as never }))).toEqual(WORKFLOW_STEPS)
  })

  it('a processed plan without scheduledAt (imported U-plan) is step 4 "Review" in the row, the bar and the stepper', () => {
    const p = plan({ status: 'procesado', csvResult: 0, hasUplan: true, hasFileContent: false, scheduledAt: null })
    expect({ row: planProgress(p).step, stepper: NUM[currentStep(p)] }).toEqual({ row: 4, stepper: 4 })
    expect(completedSteps(p)).not.toContain('datetime') // the time was never set, but the stepper no longer sits on it
  })

  it('an unprocessed plan with a file and no time is "Time"; with a time, "Process"', () => {
    expect(NUM[currentStep(plan())]).toBe(2)
    expect(NUM[currentStep(plan({ scheduledAt: WHEN }))]).toBe(3)
  })

  it('processing without a time (should not happen) stays on "Process", never back on "Time"', () => {
    expect(NUM[currentStep(plan({ status: 'procesando' }))]).toBe(3)
  })
})

describe('planStatus and interpolate load without the React i18n barrel', () => {
  it('interpolate fills {vars} and keeps unknown ones', async () => {
    const { interpolate } = await import('@/app/i18n/interpolate')
    expect(interpolate('Step {n} of 5 \u00b7 {label}', { n: 2, label: 'Time' })).toBe('Step 2 of 5 \u00b7 Time')
    expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}')
  })
})
