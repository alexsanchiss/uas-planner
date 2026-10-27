/**
 * app/components/plan-authorization/rowActions.ts: which entries a plan offers in each state.
 * planViewEntries (production tiles / Dev menu views and files), planManageEntries (production "..." menu) and
 * planMenuEntries (Dev "More" menu = rename + views + manage tail). Only what applies is listed: nothing greyed out,
 * and an unprocessed plan never offers trajectory / U-plan / geoawareness views or downloads.
 */

import { getTranslation } from '@/app/i18n/translations'
import type { FolderSummary } from '@/app/hooks/useFolders'
import { type Mode, type PlanRow } from '../lib'
import { planManageEntries, planMenuEntries, planViewEntries, primaryView, type RowCtx } from '../rowActions'

const pa = getTranslation('en').planAuth

const SCRS = JSON.stringify({
  scr_dispatch: {
    sent: true,
    status_code: 200,
    response: {
      status: 'success',
      uplan_id: 'u-1',
      segments: [
        {
          segment: 1,
          start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
          end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
          solution_method: 'ML',
          route_path: [
            { type: 'Point', coordinates: [-0.359, 39.479, 100] },
            { type: 'Point', coordinates: [-0.351, 39.471, 100] },
          ],
        },
      ],
    },
  },
})

const WHEN = '2030-01-01T10:00:00.000Z'
const plan = (over: Partial<PlanRow> = {}): PlanRow =>
  ({
    id: 7,
    customName: 'p',
    status: 'sin procesar',
    authorizationStatus: 'sin autorización',
    authorizationMessage: null,
    scheduledAt: null,
    csvResult: null,
    geoawarenessData: null,
    hasFileContent: true,
    hasUplan: false,
    folderId: null,
    ...over,
  }) as PlanRow

const folder = (id: number, name = `f${id}`) => ({ id, name }) as FolderSummary

function ctx(mode: Mode, folders: FolderSummary[] = []): RowCtx {
  return {
    mode,
    // Entries only close over the actions; nothing is invoked here.
    a: {} as RowCtx['a'],
    busy: { is: () => false, any: () => false, run: async (_k: unknown, _i: unknown, fn: () => Promise<unknown>) => fn() } as unknown as RowCtx['busy'],
    folders,
    pa,
  }
}

const ids = (entries: { id: string }[]) => entries.map((e) => e.id)
const noop = () => undefined

// ---- the plan states of the workflow ---------------------------------------------------------------

const processed = { status: 'procesado', csvResult: 1, hasUplan: true, scheduledAt: WHEN } as const
const USPACE = { uspace_identifier: 'U-SPACE-1' }

const STATES = {
  unprocessedFile: plan(),
  unprocessedDraft: plan({ hasUplan: true }), // freshly uploaded with a stored U-plan draft
  unprocessedNoFile: plan({ hasFileContent: false }),
  scheduled: plan({ scheduledAt: WHEN }),
  queued: plan({ status: 'en cola', scheduledAt: WHEN }),
  processing: plan({ status: 'procesando', scheduledAt: WHEN }),
  processedNoUspace: plan({ ...processed }),
  processedUspace: plan({ ...processed, geoawarenessData: USPACE }),
  processedNoUplan: plan({ ...processed, hasUplan: false }),
  pending: plan({ ...processed, authorizationStatus: 'pendiente', geoawarenessData: USPACE }),
  approved: plan({ ...processed, authorizationStatus: 'aprobado', geoawarenessData: USPACE }),
  deniedNoAlt: plan({ ...processed, authorizationStatus: 'denegado', authorizationMessage: 'Rejected by FAS' }),
  deniedAlt: plan({ ...processed, authorizationStatus: 'denegado', authorizationMessage: SCRS }),
  withdrawn: plan({ ...processed, authorizationStatus: 'withdrawn' }),
  error: plan({ status: 'error', scheduledAt: WHEN }),
} satisfies Record<string, PlanRow>
type StateName = keyof typeof STATES

const NOT_BEFORE_PROCESSING = ['trajectory2d', 'trajectory3d', 'uplan2d', 'uplan3d', 'geo3d', 'downloadUplan', 'downloadCsv', 'result', 'scrs']
const UNPROCESSED: StateName[] = ['unprocessedFile', 'unprocessedDraft', 'unprocessedNoFile', 'scheduled']
const IN_FLIGHT_OR_FAILED: StateName[] = ['queued', 'processing', 'error']

describe('planViewEntries: production (tiles)', () => {
  const view = (s: StateName) => ids(planViewEntries(STATES[s], ctx('prod')))

  it('an unprocessed plan only offers its waypoints, even with a stored U-plan draft', () => {
    expect(view('unprocessedFile')).toEqual(['waypoints'])
    expect(view('unprocessedDraft')).toEqual(['waypoints'])
    expect(view('scheduled')).toEqual(['waypoints'])
    expect(view('unprocessedNoFile')).toEqual([])
  })

  it('never lists trajectory, U-plan, geoawareness, edit, download or result entries before processing', () => {
    for (const s of UNPROCESSED) {
      const got = view(s)
      for (const id of [...NOT_BEFORE_PROCESSING, 'editUplan']) expect({ s, id, listed: got.includes(id) }).toEqual({ s, id, listed: false })
    }
  })

  it('queued, processing and failed plans offer waypoints only (no trajectory was produced)', () => {
    for (const s of IN_FLIGHT_OR_FAILED) expect({ s, got: view(s) }).toEqual({ s, got: ['waypoints'] })
  })

  it('processed, not yet requested: views, then edit and download of the U-plan (geoawareness only with a U-space)', () => {
    expect(view('processedNoUspace')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'editUplan', 'downloadUplan'])
    expect(view('processedUspace')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'geo3d', 'editUplan', 'downloadUplan'])
  })

  it('processed without a generated U-plan: no U-plan views and no edit', () => {
    expect(view('processedNoUplan')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'downloadUplan'])
  })

  it('pending: same views, no edit (FAS is working on it)', () => {
    expect(view('pending')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'geo3d', 'downloadUplan'])
  })

  it('approved / denied / withdrawn add the result; only denied with an SCRS alternative adds the alternative', () => {
    expect(view('approved')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'geo3d', 'result', 'downloadUplan'])
    expect(view('deniedNoAlt')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'result', 'downloadUplan'])
    expect(view('deniedAlt')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'result', 'scrs', 'downloadUplan'])
    expect(view('withdrawn')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'result', 'downloadUplan'])
  })

  it('production never offers the CSV download (researcher tool)', () => {
    for (const s of Object.keys(STATES) as StateName[]) expect(view(s)).not.toContain('downloadCsv')
  })

  it('nothing is greyed out: no entry is disabled and none carries a reason', () => {
    for (const mode of ['prod', 'dev'] as const)
      for (const s of Object.keys(STATES) as StateName[])
        for (const e of [...planViewEntries(STATES[s], ctx(mode)), ...planMenuEntries(STATES[s], ctx(mode, [folder(1)]), noop)]) {
          expect({ mode, s, id: e.id, disabled: e.disabled, reason: e.reason }).toEqual({ mode, s, id: e.id, disabled: undefined, reason: undefined })
        }
  })

  it('separators: before the result and before the first file entry, nowhere else', () => {
    const got = planViewEntries(STATES.approved, ctx('prod'))
    expect(got.filter((e) => e.separatorBefore).map((e) => e.id)).toEqual(['result', 'downloadUplan'])
    const draft = planViewEntries(STATES.processedNoUspace, ctx('prod'))
    expect(draft.filter((e) => e.separatorBefore).map((e) => e.id)).toEqual(['editUplan'])
  })
})

describe('planViewEntries: Dev (menu views and files)', () => {
  const view = (s: StateName) => ids(planViewEntries(STATES[s], ctx('dev')))

  it('an unprocessed plan has no trajectory / U-plan view, no geoawareness, no download and no result', () => {
    for (const s of UNPROCESSED) {
      const got = view(s)
      for (const id of NOT_BEFORE_PROCESSING) expect({ s, id, listed: got.includes(id) }).toEqual({ s, id, listed: false })
    }
  })

  // Dev edits the U-plan any time before authorization (old Dev behaviour, kept on purpose; see rowActions.facts).
  it('Dev keeps "Edit U-plan" before processing (researchers build U-plans by hand) but not once FAS has the plan', () => {
    for (const s of [...UNPROCESSED, ...IN_FLIGHT_OR_FAILED, 'processedNoUspace'] as StateName[]) expect({ s, got: view(s).includes('editUplan') }).toEqual({ s, got: true })
    for (const s of ['pending', 'approved', 'deniedNoAlt', 'deniedAlt', 'withdrawn'] as StateName[]) expect({ s, got: view(s).includes('editUplan') }).toEqual({ s, got: false })
  })

  it('Dev adds the CSV download after the U-plan download, only when a trajectory exists', () => {
    expect(view('processedNoUspace')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'editUplan', 'downloadUplan', 'downloadCsv'])
    expect(view('approved')).toEqual(['waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'geo3d', 'result', 'downloadUplan', 'downloadCsv'])
    expect(view('unprocessedFile')).toEqual(['waypoints', 'editUplan'])
    expect(view('error')).toEqual(['waypoints', 'editUplan'])
  })

  it('production and Dev differ only by editUplan before processing and by downloadCsv', () => {
    for (const s of Object.keys(STATES) as StateName[]) {
      const prod = ids(planViewEntries(STATES[s], ctx('prod')))
      const dev = ids(planViewEntries(STATES[s], ctx('dev'))).filter((id) => id !== 'downloadCsv')
      const devOnlyEdit = dev.filter((id) => !prod.includes(id))
      expect({ s, extra: devOnlyEdit.filter((id) => id !== 'editUplan') }).toEqual({ s, extra: [] })
      expect(prod.filter((id) => !dev.includes(id))).toEqual([])
    }
  })
})

describe('planManageEntries: the production "..." menu', () => {
  const manage = (s: StateName, folders: FolderSummary[] = [], mode: Mode = 'prod') => ids(planManageEntries(STATES[s], ctx(mode, folders), noop))

  it('contains rename / move / reset / delete and nothing view-like, in every state', () => {
    for (const s of Object.keys(STATES) as StateName[])
      for (const id of manage(s, [folder(1), folder(2)])) expect(['rename', 'move', 'reset', 'delete']).toContain(id)
  })

  it('an unprocessed plan has nothing to reset', () => {
    for (const s of UNPROCESSED) expect(manage(s)).toEqual(['rename', 'delete'])
    expect(manage('unprocessedFile', [folder(1)])).toEqual(['rename', 'move', 'delete'])
  })

  it('reset appears as soon as the plan left "unprocessed" (queued, processing, error, processed, decided)', () => {
    for (const s of [...IN_FLIGHT_OR_FAILED, 'processedNoUspace', 'pending', 'approved', 'deniedAlt', 'withdrawn'] as StateName[]) expect({ s, got: manage(s) }).toEqual({ s, got: ['rename', 'reset', 'delete'] })
  })

  it('move lists the other folders, plus "no folder" when the plan is in one; absent when there is nowhere to go', () => {
    const inFolder = { ...STATES.unprocessedFile, folderId: 1 } as PlanRow
    expect(ids(planManageEntries(inFolder, ctx('prod', []), noop))).toEqual(['rename', 'move', 'delete']) // "no folder" is a target
    const move = planManageEntries(inFolder, ctx('prod', [folder(1), folder(2)]), noop).find((e) => e.id === 'move')
    expect(ids(move?.children ?? [])).toEqual(['move-2', 'move-none'])
    const loose = planManageEntries(STATES.unprocessedFile, ctx('prod', [folder(1), folder(2)]), noop).find((e) => e.id === 'move')
    expect(ids(loose?.children ?? [])).toEqual(['move-1', 'move-2'])
    expect(manage('unprocessedFile', [])).toEqual(['rename', 'delete'])
  })

  it('delete is the only danger entry and the last one; separators keep it apart from the rest', () => {
    const all = planManageEntries(STATES.approved, ctx('prod', [folder(1)]), noop)
    expect(all.at(-1)?.id).toBe('delete')
    expect(all.filter((e) => e.tone === 'danger').map((e) => e.id)).toEqual(['delete'])
    expect(all.find((e) => e.id === 'move')?.separatorBefore).toBe(true)
    const bare = planManageEntries(STATES.unprocessedFile, ctx('prod'), noop)
    expect(bare.find((e) => e.id === 'delete')?.separatorBefore).toBe(true)
  })

  it('rename calls the supplied callback', () => {
    const calls: string[] = []
    planManageEntries(STATES.unprocessedFile, ctx('prod'), () => calls.push('rename'))[0].onSelect?.()
    expect(calls).toEqual(['rename'])
  })
})

describe('planMenuEntries: Dev "More" menu', () => {
  const menu = (s: StateName, folders: FolderSummary[] = []) => ids(planMenuEntries(STATES[s], ctx('dev', folders), noop))

  it('is rename + views/files + move/reset/delete, in the order of the pre-redesign menu', () => {
    expect(menu('approved', [folder(1)])).toEqual([
      'rename', 'waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'geo3d', 'result', 'downloadUplan', 'downloadCsv', 'move', 'reset', 'delete',
    ])
    expect(menu('processedNoUspace', [folder(1)])).toEqual([
      'rename', 'waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'editUplan', 'downloadUplan', 'downloadCsv', 'move', 'reset', 'delete',
    ])
    expect(menu('deniedAlt')).toEqual(['rename', 'waypoints', 'trajectory2d', 'trajectory3d', 'uplan3d', 'uplan2d', 'result', 'scrs', 'downloadUplan', 'downloadCsv', 'reset', 'delete'])
  })

  it('unprocessed: rename, waypoints, edit (Dev only), move, delete; no reset', () => {
    expect(menu('unprocessedFile', [folder(1)])).toEqual(['rename', 'waypoints', 'editUplan', 'move', 'delete'])
    expect(menu('unprocessedDraft', [folder(1)])).toEqual(['rename', 'waypoints', 'editUplan', 'move', 'delete'])
    expect(menu('unprocessedNoFile')).toEqual(['rename', 'editUplan', 'delete'])
  })

  it('is exactly planManageEntries + planViewEntries (one source of truth)', () => {
    for (const s of Object.keys(STATES) as StateName[]) {
      const c = ctx('dev', [folder(1), folder(2)])
      const manageIds = ids(planManageEntries(STATES[s], c, noop))
      const viewIds = ids(planViewEntries(STATES[s], c))
      expect({ s, got: ids(planMenuEntries(STATES[s], c, noop)) }).toEqual({ s, got: [manageIds[0], ...viewIds, ...manageIds.slice(1)] })
    }
  })

  it('production tiles and menu never overlap (view ids vs manage ids)', () => {
    for (const s of Object.keys(STATES) as StateName[]) {
      const v = ids(planViewEntries(STATES[s], ctx('prod')))
      const m = ids(planManageEntries(STATES[s], ctx('prod', [folder(1)]), noop))
      expect({ s, both: v.filter((id) => m.includes(id)) }).toEqual({ s, both: [] })
    }
  })
})

describe('primaryView (the one action of the step)', () => {
  const primary = (s: StateName) => primaryView(STATES[s], ctx('prod'))?.id ?? null

  it('follows the workflow: set time, process, wait, review/request, wait for FAS, result', () => {
    expect(primary('unprocessedFile')).toBe('schedule')
    expect(primary('scheduled')).toBe('process')
    expect(primary('queued')).toBe('processing')
    expect(primary('processing')).toBe('processing')
    expect(primary('processedNoUspace')).toBe('requestAuth')
    expect(primary('pending')).toBe('awaitingFas')
    expect(primary('approved')).toBe('viewResult')
    expect(primary('deniedAlt')).toBe('viewResult')
    expect(primary('error')).toBe('reset')
    expect(primary('unprocessedNoFile')).toBeNull()
  })

  it('waiting states are disabled (no run), actionable ones carry a run()', () => {
    for (const s of ['queued', 'processing', 'pending'] as StateName[]) {
      const v = primaryView(STATES[s], ctx('prod'))
      expect({ s, disabled: v?.disabled, run: v?.run }).toEqual({ s, disabled: true, run: undefined })
    }
    for (const s of ['scheduled', 'processedNoUspace', 'approved', 'error'] as StateName[]) expect(typeof primaryView(STATES[s], ctx('prod'))?.run).toBe('function')
  })

  it('planViewEntries still lists the result tile; PlanWorkspace hides it when the primary action is viewResult (checked in the browser smoke)', () => {
    const tile = ids(planViewEntries(STATES.approved, ctx('prod'))).includes('result')
    expect({ primary: primary('approved'), tile }).toEqual({ primary: 'viewResult', tile: true })
  })
})

/**
 * Regressions found by the R5 review (all fixed): geoawareness / U-plan / download gates. Each test fails if its
 * fix is reverted.
 */
describe('R5 regressions', () => {
  // Plan Definition stores geoawarenessData { uspace_identifier } when the pilot picks a U-space (PlanGenerator, TASK-045),
  // so a new plan, or a reset one, is unprocessed but "has U-space data": geo3d must wait for processing (phase done).
  const unprocessedUspace = plan({ geoawarenessData: USPACE })
  const resetUspace = plan({ geoawarenessData: USPACE, scheduledAt: WHEN })

  it('prod: a new plan created with a U-space offers only its waypoints (no "View geoawareness 3D")', () => {
    expect(ids(planViewEntries(unprocessedUspace, ctx('prod')))).toEqual(['waypoints'])
  })
  it('prod: a reset plan that keeps its U-space offers only its waypoints', () => {
    expect(ids(planViewEntries(resetUspace, ctx('prod')))).toEqual(['waypoints'])
  })
  it('Dev: an unprocessed plan with U-space data lists no geoawareness view', () => {
    expect(ids(planViewEntries(unprocessedUspace, ctx('dev')))).not.toContain('geo3d')
  })
  it('geoawareness waits for phase done, not for a trajectory: queued, processing and failed plans with U-space data have none', () => {
    for (const status of ['en cola', 'procesando', 'error'] as const)
      for (const mode of ['prod', 'dev'] as const) {
        const got = ids(planViewEntries(plan({ status, scheduledAt: WHEN, geoawarenessData: USPACE, csvResult: 1, hasUplan: true }), ctx(mode))).includes('geo3d')
        expect({ status, mode, got }).toEqual({ status, mode, got: false })
      }
  })
  it('a processed plan with U-space data and no trajectory (imported) does offer geoawareness (the gate is the phase)', () => {
    const p = plan({ status: 'procesado', hasFileContent: false, hasUplan: true, csvResult: 0, geoawarenessData: USPACE })
    expect(ids(planViewEntries(p, ctx('prod')))).toContain('geo3d')
  })

  // POST /api/flightPlans {type:'external_uplan'} creates status 'procesado', fileContent null, csvResult 0, uplan set:
  // U-plan views / edit / download must not depend on csvResult (trajectory and CSV still do).
  const imported = plan({ status: 'procesado', hasFileContent: false, hasUplan: true, csvResult: 0, scheduledAt: WHEN })

  it('prod: an imported external U-plan offers U-plan 3D / 2D, review/edit and download (no trajectory, no waypoints)', () => {
    expect(ids(planViewEntries(imported, ctx('prod')))).toEqual(['uplan3d', 'uplan2d', 'editUplan', 'downloadUplan'])
  })
  it('Dev: an imported external U-plan keeps U-plan 2D / 3D, edit and download, but no trajectory or CSV', () => {
    expect(ids(planViewEntries(imported, ctx('dev')))).toEqual(['uplan3d', 'uplan2d', 'editUplan', 'downloadUplan'])
  })
  it('imported plan: edit disappears once FAS has it; views, result and download stay', () => {
    const pending = plan({ ...imported, authorizationStatus: 'pendiente' })
    const approved = plan({ ...imported, authorizationStatus: 'aprobado' })
    expect(ids(planViewEntries(pending, ctx('prod')))).toEqual(['uplan3d', 'uplan2d', 'downloadUplan'])
    expect(ids(planViewEntries(approved, ctx('prod')))).toEqual(['uplan3d', 'uplan2d', 'result', 'downloadUplan'])
  })
  it('the U-plan gate needs a processed plan: an unprocessed / queued / failed plan with a stored U-plan (even with csvResult set) has no U-plan, download or trajectory entries', () => {
    for (const mode of ['prod', 'dev'] as const)
      for (const status of ['sin procesar', 'en cola', 'procesando', 'error'] as const) {
        const got = ids(planViewEntries(plan({ status, hasUplan: true, csvResult: 1, scheduledAt: WHEN }), ctx(mode)))
        for (const id of ['uplan3d', 'uplan2d', 'downloadUplan', 'trajectory2d', 'trajectory3d']) expect({ mode, status, id, listed: got.includes(id) }).toEqual({ mode, status, id, listed: false })
      }
  })
  it('download of the U-plan needs a trajectory or a stored U-plan: processed with neither has no file entries', () => {
    const none = plan({ status: 'procesado', csvResult: 0, hasUplan: false, scheduledAt: WHEN })
    expect(ids(planViewEntries(none, ctx('prod')))).toEqual(['waypoints'])
    const traj = plan({ status: 'procesado', csvResult: 1, hasUplan: false, scheduledAt: WHEN })
    expect(ids(planViewEntries(traj, ctx('prod')))).toContain('downloadUplan')
  })
  it('trajectory views and the CSV still depend on csvResult (an imported plan has none)', () => {
    for (const mode of ['prod', 'dev'] as const) {
      const got = ids(planViewEntries(imported, ctx(mode)))
      for (const id of ['trajectory2d', 'trajectory3d', 'downloadCsv']) expect({ mode, id, listed: got.includes(id) }).toEqual({ mode, id, listed: false })
    }
  })
  it('imported plan: the primary action is still "request authorization"', () => {
    expect(primaryView(imported, ctx('prod'))?.id).toBe('requestAuth')
  })
})
