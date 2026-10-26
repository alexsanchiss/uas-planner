/**
 * /api/flightPlans PUT + POST: clients cannot write FAS-owned authorization fields (SEC-04) and
 * cannot attach plans to another user's folder (SEC-06).
 *
 * Real JWT auth. The prisma fake counts folders honouring `where` (id list AND userId), so the
 * ownership check is exercised for real through lib/http.userOwnsFolders.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const mockUpdateMany = jest.fn();
const mockCreate = jest.fn();
const mockCreateMany = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockFolderCount = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      createMany: (...a: unknown[]) => mockCreateMany(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
    folder: { count: (...a: unknown[]) => mockFolderCount(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));
jest.mock('@/lib/email', () => ({ sendPlanDeletionEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() };
  return { __esModule: true, default: logger, logger };
});

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { POST, PUT } from '../route';

const A = 10;
const B = 20;
const FOLDERS = [
  { id: 1, userId: A },
  { id: 2, userId: B },
];

function call(handler: typeof PUT | typeof POST, body: unknown, userId: number | null = A) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return handler(
    new NextRequest('http://localhost/api/flightPlans', {
      method: handler === PUT ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
}
const put = (body: unknown, userId: number | null = A) => call(PUT, body, userId);
const post = (body: unknown, userId: number | null = A) => call(POST, body, userId);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 100, ...data }));
  mockCreateMany.mockResolvedValue({ count: 1 });
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue({ id: 100 });
  mockFindUnique.mockResolvedValue({ id: 5 });
  mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  mockFolderCount.mockImplementation(async ({ where }: { where: { id: { in: number[] }; userId: number } }) =>
    FOLDERS.filter((f) => where.id.in.includes(f.id) && f.userId === where.userId).length,
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------------------------
// SEC-04: authorization fields
// ---------------------------------------------------------------------------------------------

const FORBIDDEN_STATUSES: unknown[] = [
  'aprobado',
  'denegado',
  'pendiente',
  'withdrawn',
  'autorizado',
  'rechazado',
  'APROBADO',
  ' sin autorización',
  'sin autorización ',
  '',
  'anything at all',
  null,
  5,
  true,
  ['aprobado'],
  { v: 'aprobado' },
];

const shapes: Array<[string, (data: Record<string, unknown>) => Record<string, unknown>]> = [
  ['single {id,data}', (data) => ({ id: 5, data })],
  ['bulk {ids,data}', (data) => ({ ids: [5, 6], data })],
  ['per-item {items}', (data) => ({ items: [{ id: 5, data }] })],
];

describe.each(shapes)('PUT /api/flightPlans %s: authorization fields', (_label, wrap) => {
  it.each(FORBIDDEN_STATUSES.map((v) => [JSON.stringify(v), v]))(
    'rejects authorizationStatus %s with 400 and writes nothing',
    async (_json, value) => {
      const res = await put(wrap({ authorizationStatus: value }));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/authorizationStatus/);
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([['ACCEPTED_ALTERNATIVE'], [''], [{ a: 1 }], [[]], [0], [false]])(
    'rejects a non-null authorizationMessage %j',
    async (value) => {
      const res = await put(wrap({ authorizationMessage: value }));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/authorizationMessage/);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    },
  );

  it.each([['EXT-1'], [''], [0], [{}]])('rejects a non-null externalResponseNumber %j', async (value) => {
    const res = await put(wrap({ externalResponseNumber: value }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/externalResponseNumber/);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses the whole request when a harmless field travels with a forbidden one', async () => {
    const res = await put(wrap({ customName: 'renamed', authorizationStatus: 'aprobado' }));

    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('still accepts the full reset the UI sends (sin autorización + null message + null number)', async () => {
    const reset = { authorizationStatus: 'sin autorización', authorizationMessage: null, externalResponseNumber: null };

    const res = await put(wrap(reset));

    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany.mock.calls[0][0].data).toEqual(reset);
    expect(mockUpdateMany.mock.calls[0][0].where).toMatchObject({ userId: A });
  });

  it("still accepts 'procesando autorización' and the individual null resets", async () => {
    for (const data of [
      { authorizationStatus: 'procesando autorización' },
      { authorizationMessage: null },
      { externalResponseNumber: null },
    ]) {
      mockUpdateMany.mockClear();

      const res = await put(wrap(data));

      expect(res.status).toBe(200);
      expect(mockUpdateMany.mock.calls[0][0].data).toEqual(data);
    }
  });
});

describe('PUT /api/flightPlans per-item: all-or-nothing', () => {
  it('writes nothing for the good items when one item carries a forbidden value', async () => {
    const res = await put({
      items: [
        { id: 5, data: { customName: 'fine' } },
        { id: 6, data: { authorizationStatus: 'aprobado' } },
        { id: 7, data: { scheduledAt: '2030-01-01T00:00:00.000Z' } },
      ],
    });

    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('applies every item when all are legitimate', async () => {
    const res = await put({
      items: [
        { id: 5, data: { scheduledAt: '2030-01-01T00:00:00.000Z' } },
        { id: 6, data: { authorizationStatus: 'sin autorización', externalResponseNumber: null } },
      ],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 2 });
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
  });
});

describe('PUT /api/flightPlans: contract that must not move', () => {
  it('is 401 without a token', async () => {
    expect((await put({ id: 5, data: { customName: 'x' } }, null)).status).toBe(401);
  });

  it('single update: scoped to the caller and answers the updated row', async () => {
    mockFindUnique.mockResolvedValue({ id: 5, customName: 'x' });

    const res = await put({ id: 5, data: { customName: 'x', status: 'en cola' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 5, customName: 'x' });
    expect(mockUpdateMany.mock.calls[0][0]).toEqual({ where: { id: 5, userId: A }, data: { customName: 'x', status: 'en cola' } });
  });

  it('single update that matches nothing is 404, empty data is 400 (unchanged)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    expect((await put({ id: 5, data: { customName: 'x' } })).status).toBe(404);
    expect((await put({ id: 5, data: { nothing: 1 } })).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------------------------
// SEC-06: folderId must belong to the caller
// ---------------------------------------------------------------------------------------------

describe('PUT /api/flightPlans: folderId ownership', () => {
  const foreign = { folderId: 2 }; // belongs to B, caller is A

  it.each([
    ['single', { id: 5, data: foreign }],
    ['bulk ids', { ids: [5, 6], data: foreign }],
    ['per-item (one foreign item among own ones)', { items: [{ id: 5, data: { folderId: 1 } }, { id: 6, data: foreign }] }],
  ])("404 'Folder not found' when moving plans into someone else's folder (%s), writing nothing", async (_label, body) => {
    const res = await put(body);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Folder not found' });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('the same 404 for a folder that does not exist (no ownership oracle)', async () => {
    const res = await put({ id: 5, data: { folderId: 999 } });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Folder not found' });
  });

  it("allows the caller's own folder and clearing the folder", async () => {
    expect((await put({ id: 5, data: { folderId: 1 } })).status).toBe(200);
    expect(mockUpdateMany.mock.calls[0][0].data).toEqual({ folderId: 1 });

    mockFolderCount.mockClear();
    expect((await put({ id: 5, data: { folderId: null } })).status).toBe(200);
    expect(mockFolderCount).not.toHaveBeenCalled();
  });

  it('checks ownership against the authenticated user, not the plan', async () => {
    // B moving into B's own folder is fine; A into B's is not
    expect((await put({ id: 5, data: { folderId: 2 } }, B)).status).toBe(200);
    expect((await put({ id: 5, data: { folderId: 2 } }, A)).status).toBe(404);
  });
});

describe('POST /api/flightPlans: folderId ownership', () => {
  const plan = (extra: Record<string, unknown> = {}) => ({
    customName: 'p',
    status: 'sin procesar',
    fileContent: 'x',
    uplan: { operationVolumes: [] },
    ...extra,
  });

  it("single: 404 'Folder not found' for another user's folder, nothing created", async () => {
    const res = await post(plan({ folderId: 2 }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Folder not found' });
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('single: own folder and no folder both create (201) with userId from the token', async () => {
    expect((await post(plan({ folderId: 1 }))).status).toBe(201);
    expect(mockCreateMany.mock.calls[0][0].data[0]).toMatchObject({ userId: A, folderId: 1 });

    mockCreateMany.mockClear();
    expect((await post(plan())).status).toBe(201);
    expect(mockCreateMany.mock.calls[0][0].data[0]).toMatchObject({ userId: A, folderId: null });
  });

  it('single: a client-sent authorizationStatus never reaches the database', async () => {
    await post(plan({ folderId: 1, authorizationStatus: 'aprobado', externalResponseNumber: 'EXT-1' }));

    expect(mockCreateMany.mock.calls[0][0].data[0]).not.toHaveProperty('authorizationStatus');
    expect(mockCreateMany.mock.calls[0][0].data[0]).not.toHaveProperty('externalResponseNumber');
  });

  it('bulk: one foreign folder anywhere in the batch rejects the whole batch', async () => {
    const res = await post({ items: [plan({ folderId: 1 }), plan({ folderId: 1 }), plan({ folderId: 2 })] });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Folder not found' });
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('bulk: own folders create everything (201 {createdCount, items})', async () => {
    mockFindMany.mockResolvedValue([{ id: 100 }, { id: 101 }]);

    const res = await post({ items: [plan({ folderId: 1 }), plan({ folderId: 1 })] });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ createdCount: 2, items: [{ id: 100 }, { id: 101 }] });
    expect(mockCreateMany.mock.calls[0][0].data).toHaveLength(2);
  });

  const external = (folderId: number) => ({
    type: 'external_uplan',
    customName: 'ext',
    folderId,
    uplan: { operationVolumes: [{ timeBegin: '2030-01-01T10:00:00' }] },
  });

  it('external_uplan: 404 for another user\'s folder, nothing created', async () => {
    const res = await post(external(2));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Folder not found' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('external_uplan: own folder is created unauthorised and processed (unchanged contract)', async () => {
    const res = await post(external(1));

    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data).toMatchObject({
      userId: A,
      folderId: 1,
      status: 'procesado',
      csvResult: 0,
      authorizationStatus: 'sin autorización',
    });
  });
});
