/**
 * app/components/plan-authorization/lib.ts: the pure state helpers behind the unified Plan Authorization tree
 * (F7b). Status mapping, filters, the workflow state machine (withdrawn counts as DENIED everywhere), the
 * schedule lock, the contextual primary action and the JSON / date helpers. No React, no network.
 */

import {
  ACCEPTED_ALTERNATIVE,
  authPhase,
  completedSteps,
  countFilters,
  currentStep,
  fromLocalInput,
  getWorkflowState,
  hasScrsAlternative,
  hasVolumes,
  isScheduleLocked,
  matchesFilter,
  matchesSelectKey,
  messageText,
  parseJson,
  parseWaypointsFromPlan,
  planPhase,
  primaryActionId,
  randomTimes,
  toLocalInput,
  uplanWaypoints,
  uspaceOf,
  type PlanRow,
} from '../lib';

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
    folderId: 1,
    ...over,
  }) as PlanRow;

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
});

describe('status mapping', () => {
  it('maps plan statuses to phases (unknown = idle)', () => {
    expect(planPhase({ status: 'sin procesar' })).toBe('idle');
    expect(planPhase({ status: 'en cola' })).toBe('queued');
    expect(planPhase({ status: 'procesando' })).toBe('processing');
    expect(planPhase({ status: 'procesado' })).toBe('done');
    expect(planPhase({ status: 'error' })).toBe('error');
    expect(planPhase({ status: 'otra cosa' as never })).toBe('idle');
  });

  it("authPhase: the Dev marker 'procesando autorización' is pending, withdrawn is its own phase, unknown/null = none", () => {
    const a = (s: string | null) => authPhase({ authorizationStatus: s as never });
    expect(a('pendiente')).toBe('pending');
    expect(a('procesando autorización')).toBe('pending');
    expect(a('aprobado')).toBe('approved');
    expect(a('denegado')).toBe('denied');
    expect(a('withdrawn')).toBe('withdrawn');
    expect(a('sin autorización')).toBe('none');
    expect(a(null)).toBe('none');
  });

  it('messageText accepts strings and parsed JSON, empty = null', () => {
    expect(messageText('x')).toBe('x');
    expect(messageText('')).toBeNull();
    expect(messageText(null)).toBeNull();
    expect(messageText({ a: 1 })).toBe('{"a":1}');
  });
});

describe('workflow state machine', () => {
  it('withdrawn is treated as denied (state, filter, select key, primary action, completed step)', () => {
    const w = plan({ status: 'procesado', authorizationStatus: 'withdrawn' });
    const d = plan({ status: 'procesado', authorizationStatus: 'denegado' });
    expect(getWorkflowState(w)).toBe('denied');
    expect(getWorkflowState(w)).toBe(getWorkflowState(d));
    expect(matchesFilter(w, 'denied')).toBe(true);
    expect(matchesFilter(w, 'authorized')).toBe(false);
    expect(matchesSelectKey(w, 'denied')).toBe(true);
    expect(matchesSelectKey(w, 'noauth')).toBe(false);
    expect(primaryActionId(w)).toBe('viewResult');
    expect(completedSteps(w)).toContain('authorize');
  });

  it('maps every combination of the old getWorkflowState', () => {
    const s = (status: string, auth = 'sin autorización') => getWorkflowState(plan({ status, authorizationStatus: auth } as never));
    expect(s('sin procesar')).toBe('unprocessed');
    expect(s('en cola')).toBe('processing');
    expect(s('procesando')).toBe('processing');
    expect(s('error')).toBe('error');
    expect(s('procesado')).toBe('processed');
    expect(s('procesado', 'pendiente')).toBe('authorizing');
    expect(s('procesado', 'procesando autorización')).toBe('authorizing');
    expect(s('procesado', 'aprobado')).toBe('authorized');
    expect(s('procesado', 'denegado')).toBe('denied');
  });

  it('error beats any authorization state', () => {
    expect(getWorkflowState(plan({ status: 'error', authorizationStatus: 'aprobado' }))).toBe('error');
  });

  it('locks scheduledAt once processing started, and for an accepted alternative that is back to idle', () => {
    expect(isScheduleLocked(plan())).toBe(false);
    expect(isScheduleLocked(plan({ status: 'en cola' }))).toBe(true);
    expect(isScheduleLocked(plan({ status: 'procesado' }))).toBe(true);
    expect(isScheduleLocked(plan({ authorizationMessage: ACCEPTED_ALTERNATIVE }))).toBe(true);
    // the flag only matters while the plan is idle
    expect(isScheduleLocked(plan({ status: 'procesado', authorizationMessage: ACCEPTED_ALTERNATIVE }))).toBe(true);
    expect(isScheduleLocked(plan({ authorizationMessage: 'something else' }))).toBe(false);
  });

  it('primaryActionId is the next step of the workflow', () => {
    expect(primaryActionId(plan())).toBe('schedule');
    expect(primaryActionId(plan({ scheduledAt: '2030-01-01T00:00:00.000Z' }))).toBe('process');
    expect(primaryActionId(plan({ hasFileContent: false }))).toBeNull(); // nothing to process
    expect(primaryActionId(plan({ status: 'en cola' }))).toBe('processing');
    expect(primaryActionId(plan({ status: 'error' }))).toBe('reset');
    expect(primaryActionId(plan({ status: 'procesado' }))).toBe('requestAuth');
    expect(primaryActionId(plan({ status: 'procesado', authorizationStatus: 'pendiente' }))).toBe('awaitingFas');
    expect(primaryActionId(plan({ status: 'procesado', authorizationStatus: 'aprobado' }))).toBe('viewResult');
  });

  it('currentStep / completedSteps follow the 5-step guide', () => {
    expect(currentStep(null)).toBe('select');
    expect(completedSteps(null)).toEqual([]);
    expect(currentStep(plan())).toBe('datetime');
    const sched = plan({ scheduledAt: '2030-01-01T00:00:00.000Z' });
    expect(currentStep(sched)).toBe('process');
    expect(completedSteps(sched)).toEqual(['select', 'datetime']);
    const done = plan({ status: 'procesado', scheduledAt: '2030-01-01T00:00:00.000Z' });
    expect(currentStep(done)).toBe('geoawareness');
    expect(completedSteps(done)).toEqual(['select', 'datetime', 'process']);
    const pending = plan({ status: 'procesado', scheduledAt: '2030-01-01T00:00:00.000Z', authorizationStatus: 'pendiente' });
    expect(currentStep(pending)).toBe('authorize');
    expect(completedSteps(pending)).toEqual(['select', 'datetime', 'process', 'geoawareness']);
  });
});

describe('filters', () => {
  it('countFilters counts each plan in every filter it matches (denied includes withdrawn)', () => {
    const rows = [
      plan({ id: 1 }),
      plan({ id: 2, status: 'en cola' }),
      plan({ id: 3, status: 'procesado', authorizationStatus: 'aprobado' }),
      plan({ id: 4, status: 'procesado', authorizationStatus: 'denegado' }),
      plan({ id: 5, status: 'procesado', authorizationStatus: 'withdrawn' }),
      plan({ id: 6, status: 'error' }),
      plan({ id: 7, status: 'procesado', authorizationStatus: 'denegado', authorizationMessage: SCRS }),
    ];
    expect(countFilters(rows)).toEqual({
      unprocessed: 1,
      queued: 1,
      processing: 0,
      processed: 4,
      error: 1,
      authorized: 1,
      denied: 3,
      alternatives: 1,
    });
  });

  it('hasScrsAlternative reads the SCRS proposal from a string or parsed message, false otherwise', () => {
    expect(hasScrsAlternative({ authorizationMessage: SCRS })).toBe(true);
    expect(hasScrsAlternative({ authorizationMessage: JSON.parse(SCRS) })).toBe(true);
    expect(hasScrsAlternative({ authorizationMessage: ACCEPTED_ALTERNATIVE })).toBe(false);
    expect(hasScrsAlternative({ authorizationMessage: null })).toBe(false);
  });

  it("matchesSelectKey 'all' matches everything and 'noauth' only plans with no authorization phase", () => {
    expect(matchesSelectKey(plan(), 'all')).toBe(true);
    expect(matchesSelectKey(plan(), 'noauth')).toBe(true);
    expect(matchesSelectKey(plan({ authorizationStatus: 'pendiente' }), 'noauth')).toBe(false);
  });
});

describe('JSON and waypoint helpers', () => {
  it('parseJson accepts objects, JSON text and double-encoded text; everything else is null', () => {
    expect(parseJson({ a: 1 })).toEqual({ a: 1 });
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson(JSON.stringify(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
    expect(parseJson('not json')).toBeNull();
    expect(parseJson('"plain"')).toBeNull();
    expect(parseJson(null)).toBeNull();
    expect(parseJson(5)).toBeNull();
  });

  it('hasVolumes needs a non-empty operationVolumes array', () => {
    expect(hasVolumes({ operationVolumes: [{}] })).toBe(true);
    expect(hasVolumes({ operationVolumes: [] })).toBe(false);
    expect(hasVolumes({})).toBe(false);
    expect(hasVolumes(null)).toBe(false);
  });

  it('parseWaypointsFromPlan takes mission items with >= 7 params, first = takeoff, last = landing', () => {
    const fileContent = JSON.stringify({
      mission: {
        items: [
          { params: [0, 0, 0, 0, 39.1, -0.1, 10] },
          { params: [0, 0, 0, 0, 39.2, -0.2, 20] },
          { params: [0, 0, 0, 0, 39.3, -0.3, 0], Altitude: 5 },
          { params: [1, 2] }, // dropped: too short
        ],
      },
    });
    const wps = parseWaypointsFromPlan(fileContent);
    expect(wps).toEqual([
      { lat: 39.1, lng: -0.1, alt: 10, type: 'takeoff' },
      { lat: 39.2, lng: -0.2, alt: 20, type: 'cruise' },
      { lat: 39.3, lng: -0.3, alt: 5, type: 'landing' },
    ]);
    expect(parseWaypointsFromPlan(null)).toEqual([]);
    expect(parseWaypointsFromPlan('{broken')).toEqual([]);
  });

  it('uplanWaypoints flips GeoJSON [lon, lat, alt] and keeps only Points', () => {
    const uplan = { flightDetails: { waypoints: [{ type: 'Point', coordinates: [-0.3, 39.4, 50] }, { type: 'Polygon', coordinates: [] }] } };
    expect(uplanWaypoints(uplan)).toEqual([{ lat: 39.4, lon: -0.3, alt: 50 }]);
    expect(uplanWaypoints(null)).toEqual([]);
  });

  it('uspaceOf needs a non-empty string uspace_identifier', () => {
    expect(uspaceOf({ uspace_identifier: 'ES-1' })).toBe('ES-1');
    expect(uspaceOf({ uspace_identifier: '' })).toBeNull();
    expect(uspaceOf({ uspace_identifier: 3 })).toBeNull();
    expect(uspaceOf(null)).toBeNull();
  });
});

describe('dates', () => {
  it('local input <-> UTC ISO round-trips and tolerates empty / invalid', () => {
    const iso = '2030-05-06T07:08:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('garbage')).toBe('');
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput('garbage')).toBe('');
  });

  it('randomTimes: one ISO instant per plan inside [min, max]; null for an empty / inverted / invalid window', () => {
    const min = '2030-01-01T00:00:00.000Z';
    const max = '2030-01-01T01:00:00.000Z';
    const times = randomTimes(50, min, max) as string[];
    expect(times).toHaveLength(50);
    for (const t of times) {
      const ms = new Date(t).getTime();
      expect(ms).toBeGreaterThanOrEqual(new Date(min).getTime());
      expect(ms).toBeLessThanOrEqual(new Date(max).getTime());
    }
    expect(randomTimes(0, min, max)).toEqual([]);
    expect(randomTimes(3, max, min)).toBeNull();
    expect(randomTimes(3, min, min)).toBeNull();
    expect(randomTimes(3, 'x', max)).toBeNull();
  });
});
