/**
 * Integration tests for POST /api/flightPlans/[id]/accept-alternative
 */

import { NextRequest } from 'next/server';

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockFindUnique = jest.fn();
const mockDeleteMany = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    csvResult: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockWithAuth = jest.fn();
const mockIsAuthError = jest.fn();

jest.mock('@/lib/auth-middleware', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
  isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}));

// ── scrs / qgc-plan are NOT mocked — we use the real implementations ─────────

// Import after mocks are registered
import { POST } from '../route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/flightPlans/${id}/accept-alternative`, {
    method: 'POST',
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Minimal valid authorizationMessage with an SCRS alternative.
 * Matches the exact payload described in the task specification.
 */
const VALID_AUTH_MESSAGE = JSON.stringify({
  volumes: [13],
  scr_dispatch: {
    sent: true,
    status_code: 200,
    response: {
      status: 'success',
      uplan_id: 'test-id',
      segments: [
        {
          segment: 1,
          start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
          end: { type: 'Point', coordinates: [-0.35, 39.476, 100] },
          solution_method: 'ML',
          len_path: 2,
          t_path: 0.1,
          route_path: [
            { type: 'Point', coordinates: [-0.36, 39.48, 100] },
            { type: 'Point', coordinates: [-0.355, 39.478, 100] },
            { type: 'Point', coordinates: [-0.35, 39.476, 100] },
          ],
        },
      ],
    },
  },
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/flightPlans/[id]/accept-alternative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. No auth → 401 ──────────────────────────────────────────────────────
  it('returns 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
    mockWithAuth.mockResolvedValue(errorResponse);
    mockIsAuthError.mockReturnValue(true);

    const res = await POST(makeRequest('1'), makeParams('1'));

    expect(res.status).toBe(401);
  });

  // ── 2. Plan not found → 404 ───────────────────────────────────────────────
  it('returns 404 when the plan does not exist', async () => {
    mockWithAuth.mockResolvedValue({ userId: 42 });
    mockIsAuthError.mockReturnValue(false);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest('999'), makeParams('999'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrado/i);
  });

  // ── 3. Plan belongs to another user → 403 ────────────────────────────────
  it('returns 403 when the plan belongs to another user', async () => {
    mockWithAuth.mockResolvedValue({ userId: 42 });
    mockIsAuthError.mockReturnValue(false);
    mockFindUnique.mockResolvedValue({
      id: 1,
      userId: 99, // different user
      authorizationStatus: 'denegado',
      authorizationMessage: VALID_AUTH_MESSAGE,
      uplan: null,
    });

    const res = await POST(makeRequest('1'), makeParams('1'));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/access denied/i);
  });

  // ── 4. Plan not denied → 400 ──────────────────────────────────────────────
  it('returns 400 when the plan is not denied (e.g. aprobado)', async () => {
    mockWithAuth.mockResolvedValue({ userId: 42 });
    mockIsAuthError.mockReturnValue(false);
    mockFindUnique.mockResolvedValue({
      id: 1,
      userId: 42,
      authorizationStatus: 'aprobado',
      authorizationMessage: VALID_AUTH_MESSAGE,
      uplan: null,
    });

    const res = await POST(makeRequest('1'), makeParams('1'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/aprobado/);
  });

  // ── 5. Denied but no scr_dispatch → 400 ──────────────────────────────────
  it('returns 400 when plan is denied but has no SCRS alternative', async () => {
    mockWithAuth.mockResolvedValue({ userId: 42 });
    mockIsAuthError.mockReturnValue(false);
    mockFindUnique.mockResolvedValue({
      id: 1,
      userId: 42,
      authorizationStatus: 'denegado',
      // authorizationMessage has no scr_dispatch
      authorizationMessage: JSON.stringify({ volumes: [13] }),
      uplan: null,
    });

    const res = await POST(makeRequest('1'), makeParams('1'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No SCRS alternative available for this plan');
  });

  // ── 6. Successful acceptance ──────────────────────────────────────────────
  it('returns 200 and updated plan on success', async () => {
    const userId = 42;
    const planId = 7;

    mockWithAuth.mockResolvedValue({ userId });
    mockIsAuthError.mockReturnValue(false);

    mockFindUnique.mockResolvedValue({
      id: planId,
      userId,
      authorizationStatus: 'denegado',
      authorizationMessage: VALID_AUTH_MESSAGE,
      uplan: JSON.stringify({
        flightDetails: {
          mode: 'VLOS',
          category: 'OPENA1',
          specialOperation: 'FIREFIGHTING',
          privateFlight: false,
          waypoints: [{ time: 0, lat: 39.5, lon: -0.4, h: 100 }],
        },
        uas: { registrationNumber: 'REG1' },
        contactDetails: { firstName: 'John' },
        dataOwnerIdentifier: { sac: 'AAA', sic: 'BBB' },
        dataSourceIdentifier: { sac: 'CCC', sic: 'DDD' },
        operationVolumes: [{ ordinal: 0 }],
      }),
    });

    const updatedPlan = {
      id: planId,
      userId,
      status: 'sin procesar',
      authorizationStatus: 'sin autorización',
      authorizationMessage: null,
      externalResponseNumber: null,
      machineAssignedId: null,
      csvResult: null,
      fileContent: 'some-qgc-content',
      uplan: 'some-uplan',
      folder: null,
    };

    // $transaction receives an array of promises — execute them and return results
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      const results = await Promise.all(ops);
      return results;
    });
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue(updatedPlan);

    const res = await POST(makeRequest(String(planId)), makeParams(String(planId)));

    expect(res.status).toBe(200);
    const body = await res.json();

    // Response shape
    expect(body).toHaveProperty('flightPlan');
    expect(body.flightPlan.status).toBe('sin procesar');

    // Verify the update call had the right shape
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: planId });
    expect(updateCall.data.status).toBe('sin procesar');
    expect(updateCall.data.authorizationStatus).toBe('sin autorización');
    expect(updateCall.data.authorizationMessage).toBe('ACCEPTED_ALTERNATIVE');
    expect(updateCall.data.externalResponseNumber).toBeNull();
    expect(updateCall.data.machineAssignedId).toBeNull();
    expect(updateCall.data.csvResult).toBeNull();

    // fileContent must be a non-empty QGC JSON string
    expect(typeof updateCall.data.fileContent).toBe('string');
    const qgcPlan = JSON.parse(updateCall.data.fileContent);
    expect(qgcPlan.fileType).toBe('Plan');
    expect(qgcPlan.mission.items.length).toBeGreaterThan(0);

    // uplan must have updated waypoints and cleared operationVolumes
    expect(typeof updateCall.data.uplan).toBe('string');
    const uplan = JSON.parse(updateCall.data.uplan);
    expect(uplan.flightDetails.waypoints).toBeDefined();
    expect(uplan.flightDetails.waypoints.length).toBeGreaterThan(0);
    expect(uplan.operationVolumes).toEqual([]);

    // Preserved fields from original uplan
    expect(uplan.flightDetails.mode).toBe('VLOS');
    expect(uplan.flightDetails.category).toBe('OPENA1');
    expect(uplan.uas.registrationNumber).toBe('REG1');
    expect(uplan.dataOwnerIdentifier).toEqual({ sac: 'AAA', sic: 'BBB' });

    // Landing waypoint at altitude 0 must be present
    const landingWp = uplan.flightDetails.waypoints[uplan.flightDetails.waypoints.length - 1];
    expect(landingWp.h).toBe(0);
  });
});
