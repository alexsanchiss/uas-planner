/**
 * /api/flightPlans/[id] PUT + DELETE.
 *
 * PUT: clients cannot write FAS-owned authorization fields (SEC-04, zod schema) and cannot move a
 * plan into another user's folder (SEC-06). DELETE: the FAS cancellation request is the E4
 * contract (DELETE {origin}/uplan_cancelation/{enc(n)}, no headers/body, only a timeout signal).
 * Real JWT auth; prisma and fetch are faked.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
process.env.FAS_API_URL = 'http://fas-test.local/uplan';

const mockPlanFindUnique = jest.fn();
const mockPlanUpdate = jest.fn();
const mockPlanDelete = jest.fn();
const mockCsvDelete = jest.fn();
const mockUserFindUnique = jest.fn();
const mockFolderCount = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: (...a: unknown[]) => mockPlanFindUnique(...a),
      update: (...a: unknown[]) => mockPlanUpdate(...a),
      delete: (...a: unknown[]) => mockPlanDelete(...a),
    },
    csvResult: { delete: (...a: unknown[]) => mockCsvDelete(...a) },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    folder: { count: (...a: unknown[]) => mockFolderCount(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

const mockSendDeletionEmail = jest.fn();
jest.mock('@/lib/email', () => ({
  sendPlanDeletionEmail: (...a: unknown[]) => mockSendDeletionEmail(...a),
}));
jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() };
  return { __esModule: true, default: logger, logger };
});

const mockFetch = jest.fn();
const originalFetch = global.fetch;

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { DELETE, PUT } from '../route';

const OWNER = 10;
const STRANGER = 20;
const OWN_FOLDER = 1;
const FOREIGN_FOLDER = 2;

function call(handler: typeof PUT | typeof DELETE, body: unknown, userId: number | null = OWNER, id = '5') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return handler(
    new NextRequest(`http://localhost/api/flightPlans/${id}`, {
      method: handler === PUT ? 'PUT' : 'DELETE',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockPlanFindUnique.mockResolvedValue({ userId: OWNER });
  mockPlanUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 5, ...data }));
  mockFolderCount.mockImplementation(async ({ where }: { where: { id: { in: number[] }; userId: number } }) =>
    [{ id: OWN_FOLDER, userId: OWNER }, { id: FOREIGN_FOLDER, userId: STRANGER }].filter(
      (f) => where.id.in.includes(f.id) && f.userId === where.userId,
    ).length,
  );
  mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  mockPlanDelete.mockImplementation(async ({ where }: { where: { id: number } }) => ({ id: where.id, customName: 'Plan 5' }));
  mockCsvDelete.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue({ email: 'owner@example.com' });
  mockSendDeletionEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('PUT /api/flightPlans/[id]: authorization fields', () => {
  it('is 401 without a token', async () => {
    expect((await call(PUT, { customName: 'x' }, null)).status).toBe(401);
  });

  it.each(['aprobado', 'denegado', 'pendiente', 'withdrawn', 'autorizado', 'rechazado', 'anything'])(
    'rejects authorizationStatus %s with a 400 validation error and writes nothing',
    async (status) => {
      const res = await call(PUT, { authorizationStatus: status });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Validation failed');
      expect(mockPlanUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['authorizationMessage', 'ACCEPTED_ALTERNATIVE'],
    ['authorizationMessage', { reason: 'x' }],
    ['externalResponseNumber', 'EXT-1'],
  ])('rejects a non-null %s (%j)', async (field, value) => {
    const res = await call(PUT, { [field]: value });

    expect(res.status).toBe(400);
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });

  it('refuses the whole update when a harmless field travels with a forbidden one', async () => {
    const res = await call(PUT, { customName: 'renamed', authorizationStatus: 'aprobado' });

    expect(res.status).toBe(400);
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });

  it('accepts the full reset and persists it, including externalResponseNumber: null', async () => {
    const reset = { authorizationStatus: 'sin autorización', authorizationMessage: null, externalResponseNumber: null };

    const res = await call(PUT, reset);

    expect(res.status).toBe(200);
    expect(mockPlanUpdate.mock.calls[0][0].data).toEqual(reset);
  });

  it("accepts 'procesando autorización' and the unchanged uplan-only update the U-Plan form sends", async () => {
    expect((await call(PUT, { authorizationStatus: 'procesando autorización' })).status).toBe(200);

    mockPlanUpdate.mockClear();
    const res = await call(PUT, { uplan: { operationVolumes: [] } });
    expect(res.status).toBe(200);
    expect(mockPlanUpdate.mock.calls[0][0].data).toEqual({ uplan: '{"operationVolumes":[]}' });
  });

  it('is 403 for a non-owner and writes nothing', async () => {
    mockPlanFindUnique.mockResolvedValue({ userId: STRANGER });

    const res = await call(PUT, { customName: 'hijack' });

    expect(res.status).toBe(403);
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });
});

describe('PUT /api/flightPlans/[id]: folderId ownership', () => {
  it("404 'Folder not found' for another user's folder and for a nonexistent one, writing nothing", async () => {
    for (const folderId of [FOREIGN_FOLDER, 999]) {
      const res = await call(PUT, { folderId });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Folder not found' });
    }
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });

  it("allows the caller's own folder and clearing the folder (no lookup for null)", async () => {
    expect((await call(PUT, { folderId: OWN_FOLDER })).status).toBe(200);
    expect(mockPlanUpdate.mock.calls[0][0].data).toEqual({ folderId: OWN_FOLDER });

    mockFolderCount.mockClear();
    expect((await call(PUT, { folderId: null })).status).toBe(200);
    expect(mockFolderCount).not.toHaveBeenCalled();
  });

  it('keeps ownership of the plan ahead of the folder check (403, not 404)', async () => {
    mockPlanFindUnique.mockResolvedValue({ userId: STRANGER });

    expect((await call(PUT, { folderId: FOREIGN_FOLDER })).status).toBe(403);
  });
});

describe('DELETE /api/flightPlans/[id]: FAS cancellation (E4)', () => {
  const approved = {
    userId: OWNER,
    csvResult: null,
    customName: 'Plan 5',
    authorizationStatus: 'aprobado',
    externalResponseNumber: 'EXT/9 x',
  };

  it('sends exactly DELETE {origin}/uplan_cancelation/{enc(n)} with only a timeout signal added', async () => {
    mockPlanFindUnique.mockResolvedValue(approved);
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

    const res = await call(DELETE, undefined);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: 'Flight plan deleted successfully',
      deletedPlan: { id: 5, customName: 'Plan 5' },
      deletedCsvResult: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://fas-test.local/uplan_cancelation/EXT%2F9%20x');
    expect(Object.keys(init).sort()).toEqual(['method', 'signal']);
    expect(init.method).toBe('DELETE');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(mockSendDeletionEmail).toHaveBeenCalledWith('owner@example.com', 'Plan 5');
  });

  it('still deletes the plan and answers 200 when FAS is down or times out (existing error path)', async () => {
    mockPlanFindUnique.mockResolvedValue(approved);
    mockFetch.mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));

    const res = await call(DELETE, undefined);

    expect(res.status).toBe(200);
    expect(mockPlanDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call FAS for plans that are not approved, nor for a non-owner', async () => {
    mockPlanFindUnique.mockResolvedValue({ ...approved, authorizationStatus: 'sin autorización' });
    expect((await call(DELETE, undefined)).status).toBe(200);

    mockPlanFindUnique.mockResolvedValue({ ...approved, userId: STRANGER });
    expect((await call(DELETE, undefined)).status).toBe(403);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // KNOWN BUG (found in the F4 review, not fixed by b79277a): flightPlan.csvResult is a 0/1 FLAG,
  // never an id (CLAUDE.md "csvResult is a boolean flag, NOT an ID"); the CSV row shares the PLAN's
  // id. The route deletes csvResult row `flightPlan.csvResult`, i.e. row 1 (somebody else's CSV)
  // and 500s on a 0. Remove `.failing` once the route deletes `{ id }` and only when the flag is set.
  it.failing('deletes the plan\'s own csvResult row (id = plan id), never the 0/1 flag value', async () => {
    mockPlanFindUnique.mockResolvedValue({ ...approved, authorizationStatus: 'sin autorización', csvResult: 1 });

    const res = await call(DELETE, undefined);

    expect(res.status).toBe(200);
    expect(mockCsvDelete).toHaveBeenCalledTimes(1);
    expect(mockCsvDelete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});
