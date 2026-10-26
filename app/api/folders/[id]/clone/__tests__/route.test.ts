/**
 * POST /api/folders/[id]/clone: a clone is a NEW plan (SEC-05).
 *
 * It must not inherit FAS authorization (aprobado + the same externalResponseNumber would alias
 * the original in FAS callbacks and make deleting the clone cancel the original's authorization)
 * nor the activation state, while everything else (name, status, uplan, schedule, geoawareness,
 * csv, createdAt and therefore the list order) is preserved. The FAS callback rewrites `uplan.state`
 * (ACCEPTED/DENIED), so the clone's U-Plan starts again from "SENT" (what a new plan gets).
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const mockFolderFindUnique = jest.fn();
const mockFolderCreate = jest.fn();
const mockPlanFindMany = jest.fn();
const mockPlanCreate = jest.fn();
const mockCsvFindMany = jest.fn();
const mockCsvCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    folder: {
      findUnique: (...a: unknown[]) => mockFolderFindUnique(...a),
      create: (...a: unknown[]) => mockFolderCreate(...a),
    },
    flightPlan: {
      findMany: (...a: unknown[]) => mockPlanFindMany(...a),
      create: (...a: unknown[]) => mockPlanCreate(...a),
    },
    csvResult: {
      findMany: (...a: unknown[]) => mockCsvFindMany(...a),
      create: (...a: unknown[]) => mockCsvCreate(...a),
    },
  },
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { POST } from '../route';

const OWNER = 10;
const STRANGER = 20;

const folder = {
  id: 3,
  name: 'Mission',
  userId: OWNER,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  minScheduledAt: new Date('2026-02-01T00:00:00Z'),
  maxScheduledAt: new Date('2026-02-02T00:00:00Z'),
};

const approvedActivated = {
  customName: 'Approved flight',
  status: 'procesado',
  fileContent: 'qgc-plan',
  csvResult: 1,
  uplan: '{"state":"ACCEPTED","operationVolumes":[{"id":"v1"}],"flightDetails":{"a":1}}',
  scheduledAt: new Date('2026-02-01T10:00:00Z'),
  geoawarenessData: { uspace_identifier: 'u1' },
  createdAt: new Date('2026-01-05T08:00:00Z'),
  authorizationStatus: 'aprobado',
  authorizationMessage: 'FAS says yes',
  externalResponseNumber: 'EXT-777',
  activationStatus: 'autorizado_despegue',
  activatedAt: new Date('2026-02-01T10:00:30Z'),
  activationMessage: '{"ok":true}',
  termsAcceptedAt: new Date('2026-02-01T09:59:00Z'),
  lastActivationAttempt: new Date('2026-02-01T10:00:00Z'),
};

const originals = [
  { id: 21, ...approvedActivated, customName: 'First' },
  {
    id: 22,
    ...approvedActivated,
    customName: 'Second',
    createdAt: new Date('2026-01-06T08:00:00Z'),
    authorizationStatus: 'denegado',
    uplan: '{"state":"DENIED","operationVolumes":[]}',
  },
  { id: 23, ...approvedActivated, customName: 'No csv', csvResult: null, geoawarenessData: null, authorizationStatus: 'pendiente' },
];

// what each clone's `uplan` must be: same JSON, only `state` back to SENT
const expectedClonedUplan = [
  '{"state":"SENT","operationVolumes":[{"id":"v1"}],"flightDetails":{"a":1}}',
  '{"state":"SENT","operationVolumes":[]}',
  '{"state":"SENT","operationVolumes":[{"id":"v1"}],"flightDetails":{"a":1}}',
];

function clone(userId: number | null = OWNER, id = '3') {
  const headers: Record<string, string> = {};
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return POST(new NextRequest(`http://localhost/api/folders/${id}/clone`, { method: 'POST', headers }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  let nextId = 100;
  mockFolderFindUnique.mockResolvedValue(folder);
  mockFolderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 50, ...data }));
  mockPlanFindMany.mockResolvedValue(originals);
  mockPlanCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: nextId++, ...data }));
  mockCsvFindMany.mockResolvedValue([
    { id: 21, csvResult: 'csv-21' },
    { id: 22, csvResult: 'csv-22' },
  ]);
  mockCsvCreate.mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/folders/[id]/clone', () => {
  it('gives every clone an unauthorised, unactivated state with no FAS identity', async () => {
    const res = await clone();

    expect(res.status).toBe(200);
    expect(mockPlanCreate).toHaveBeenCalledTimes(3);
    for (const [{ data }] of mockPlanCreate.mock.calls) {
      expect(data.authorizationStatus).toBe('sin autorización');
      expect(data.authorizationMessage).toBeNull();
      // no FAS number copied: absent (DB default null) or explicitly null, never the original's
      expect(data.externalResponseNumber ?? null).toBeNull();
      // activation state is reset: absent (DB defaults) or the default value, never the original's
      expect(data.activationStatus ?? 'no activable').toBe('no activable');
      expect(data.activatedAt ?? null).toBeNull();
      expect(data.activationMessage ?? null).toBeNull();
      expect(data.termsAcceptedAt ?? null).toBeNull();
      expect(data.lastActivationAttempt ?? null).toBeNull();
    }
    expect(JSON.stringify(mockPlanCreate.mock.calls)).not.toContain('EXT-777');
    // what the client receives is the new, unauthorised plan
    const body = await res.json();
    expect(body.flightPlans.every((p: { authorizationStatus: string }) => p.authorizationStatus === 'sin autorización')).toBe(true);
  });

  it('preserves the rest of each plan, including createdAt, and creates them in the original order', async () => {
    await clone();

    expect(mockPlanFindMany).toHaveBeenCalledWith({ where: { folderId: 3 }, orderBy: { id: 'asc' } });
    const created = mockPlanCreate.mock.calls.map(([arg]) => arg.data);
    expect(created.map((d) => d.customName)).toEqual(['First', 'Second', 'No csv']);
    created.forEach((data, i) => {
      expect(data).toMatchObject({
        customName: originals[i].customName,
        status: 'procesado',
        fileContent: 'qgc-plan',
        csvResult: originals[i].csvResult,
        uplan: expectedClonedUplan[i],
        scheduledAt: originals[i].scheduledAt,
        userId: OWNER,
        folderId: 50,
        createdAt: originals[i].createdAt,
      });
    });
    expect(created[0].geoawarenessData).toEqual({ uspace_identifier: 'u1' });
  });

  it('resets uplan.state to SENT without touching anything else in the U-Plan', async () => {
    await clone();

    const clonedUplans = mockPlanCreate.mock.calls.map(([arg]) => JSON.parse(arg.data.uplan));
    expect(clonedUplans.map((u) => u.state)).toEqual(['SENT', 'SENT', 'SENT']);
    expect(clonedUplans[0].operationVolumes).toEqual([{ id: 'v1' }]);
    expect(clonedUplans[0].flightDetails).toEqual({ a: 1 });
    // the originals are not touched
    expect(originals[0].uplan).toContain('"state":"ACCEPTED"');
  });

  it('leaves a U-Plan without state, a non-JSON U-Plan and a missing U-Plan exactly as they are', async () => {
    mockPlanFindMany.mockResolvedValue([
      { id: 31, ...approvedActivated, uplan: '{"operationVolumes":[]}' },
      { id: 32, ...approvedActivated, uplan: 'not-json' },
      { id: 33, ...approvedActivated, uplan: null },
    ]);
    mockCsvFindMany.mockResolvedValue([]);

    const res = await clone();

    expect(res.status).toBe(200);
    expect(mockPlanCreate.mock.calls.map(([arg]) => arg.data.uplan)).toEqual(['{"operationVolumes":[]}', 'not-json', null]);
  });

  it('creates the new folder with the _copy suffix, the caller as owner and the original dates', async () => {
    const res = await clone();
    const body = await res.json();

    expect(mockFolderCreate.mock.calls[0][0].data).toEqual({
      name: 'Mission_copy',
      userId: OWNER,
      minScheduledAt: folder.minScheduledAt,
      maxScheduledAt: folder.maxScheduledAt,
      createdAt: folder.createdAt,
    });
    expect(body.folder.id).toBe(50);
    expect(body.flightPlans).toHaveLength(3);
  });

  it("copies each CSV to the NEW plan's id (not the original's) and only where one existed", async () => {
    await clone();

    expect(mockCsvCreate).toHaveBeenCalledTimes(2);
    expect(mockCsvCreate.mock.calls.map(([arg]) => arg.data)).toEqual([
      { id: 100, csvResult: 'csv-21' },
      { id: 101, csvResult: 'csv-22' },
    ]);
  });

  it('keeps its auth contract: 401 without a token, 404 unknown folder, 403 for someone else\'s folder (nothing created)', async () => {
    expect((await clone(null)).status).toBe(401);

    mockFolderFindUnique.mockResolvedValue(null);
    expect((await clone()).status).toBe(404);

    mockFolderFindUnique.mockResolvedValue(folder);
    expect((await clone(STRANGER)).status).toBe(403);

    expect((await clone(OWNER, 'abc')).status).toBe(400);
    expect(mockFolderCreate).not.toHaveBeenCalled();
    expect(mockPlanCreate).not.toHaveBeenCalled();
  });
});
