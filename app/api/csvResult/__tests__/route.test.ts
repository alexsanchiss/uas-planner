/**
 * /api/csvResult GET / POST / DELETE: ownership (SEC-02).
 *
 * csvResult.id == flightPlan.id, so a CSV is the caller's only when a plan with that id has
 * userId == caller. The prisma fake below honours `where` faithfully (id lists, userId), so if
 * the route stops scoping by userId these tests see the other user's data and fail.
 * Real JWT auth (no auth mock): 401s come from the real middleware.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

type PlanRow = { id: number; userId: number; customName: string };
type Where = { id?: number | { in: number[] }; userId?: number };

const mockDb = {
  plans: [] as PlanRow[],
  csv: new Map<number, string | null>(),
};

function ids(where: Where): number[] | undefined {
  if (where.id === undefined) return undefined;
  return typeof where.id === 'number' ? [where.id] : where.id.in;
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findMany: jest.fn(async ({ where }: { where: Where }) => {
        const wanted = ids(where);
        return mockDb.plans
          .filter((p) => (wanted === undefined || wanted.includes(p.id)) && (where.userId === undefined || p.userId === where.userId))
          .map((p) => ({ id: p.id, customName: p.customName }));
      }),
    },
    csvResult: {
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) =>
        mockDb.csv.has(where.id) ? { id: where.id, csvResult: mockDb.csv.get(where.id) } : null,
      ),
      findMany: jest.fn(async ({ where }: { where: Where }) => {
        const wanted = ids(where) ?? [...mockDb.csv.keys()];
        return wanted.filter((id) => mockDb.csv.has(id)).map((id) => ({ id, csvResult: mockDb.csv.get(id) }));
      }),
      delete: jest.fn(async ({ where }: { where: { id: number } }) => {
        if (!mockDb.csv.has(where.id)) throw new Error('P2025 record not found');
        mockDb.csv.delete(where.id);
        return { id: where.id };
      }),
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const wanted = ids(where) ?? [];
        const hit = wanted.filter((id) => mockDb.csv.has(id));
        hit.forEach((id) => mockDb.csv.delete(id));
        return { count: hit.length };
      }),
    },
  },
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { GET, POST, DELETE } from '../route';

const A = 10; // owns plans 1, 3, 4
const B = 20; // owns plan 2

function req(method: string, url: string, userId: number | null, body?: unknown): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockDb.plans = [
    { id: 1, userId: A, customName: 'Plan A1' },
    { id: 2, userId: B, customName: 'Plan B2' },
    { id: 3, userId: A, customName: 'Plan A3' },
    { id: 4, userId: A, customName: 'Plan A4 (no csv)' },
  ];
  mockDb.csv = new Map<number, string | null>([
    [1, 'csv-A1'],
    [2, 'csv-B2'],
    [3, 'csv-A3'],
  ]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/csvResult?id=', () => {
  it('requires a valid token', async () => {
    expect((await GET(req('GET', '/api/csvResult?id=1', null))).status).toBe(401);
    const bad = new NextRequest('http://localhost/api/csvResult?id=1', { headers: { Authorization: 'Bearer nope' } });
    expect((await GET(bad)).status).toBe(401);
  });

  it('returns the CSV to the owner with the unchanged shape', async () => {
    const res = await GET(req('GET', '/api/csvResult?id=1', A));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ csvResult: 'csv-A1' });
  });

  it("never returns another user's CSV: 404 'CSV no encontrado', indistinguishable from a missing one", async () => {
    const foreign = await GET(req('GET', '/api/csvResult?id=1', B));
    const missing = await GET(req('GET', '/api/csvResult?id=999', B));

    expect(foreign.status).toBe(404);
    const foreignBody = await foreign.json();
    expect(foreignBody).toEqual({ error: 'CSV no encontrado' });
    expect(JSON.stringify(foreignBody)).not.toContain('csv-A1');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(foreignBody);
  });

  it("is 404 for the owner's plan that has no CSV row, and 400 for a malformed id (unchanged)", async () => {
    expect((await GET(req('GET', '/api/csvResult?id=4', A))).status).toBe(404);
    expect((await GET(req('GET', '/api/csvResult?id=abc', A))).status).toBe(400);
    expect((await GET(req('GET', '/api/csvResult', A))).status).toBe(400);
  });
});

describe('POST /api/csvResult (bulk fetch)', () => {
  it('requires a valid token', async () => {
    expect((await POST(req('POST', '/api/csvResult', null, { ids: [1] }))).status).toBe(401);
  });

  it('returns {items:[{id,customName,csvResult}]} for the owner, omitting plans without a CSV', async () => {
    const res = await POST(req('POST', '/api/csvResult', A, { ids: [1, 3, 4] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { id: 1, customName: 'Plan A1', csvResult: 'csv-A1' },
        { id: 3, customName: 'Plan A3', csvResult: 'csv-A3' },
      ],
    });
  });

  it("drops ids the caller does not own: no CSV content and no plan name of someone else's plan", async () => {
    const res = await POST(req('POST', '/api/csvResult', B, { ids: [1, 2, 3] }));
    const text = JSON.stringify(await res.json());

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ items: [{ id: 2, customName: 'Plan B2', csvResult: 'csv-B2' }] });
    expect(text).not.toContain('csv-A');
    expect(text).not.toContain('Plan A');
  });

  it('answers an empty list when every requested id belongs to someone else', async () => {
    const res = await POST(req('POST', '/api/csvResult', B, { ids: [1, 3] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });
});

describe('DELETE /api/csvResult', () => {
  it('requires a valid token and deletes nothing without it', async () => {
    expect((await DELETE(req('DELETE', '/api/csvResult', null, { id: 1 }))).status).toBe(401);
    expect(mockDb.csv.has(1)).toBe(true);
  });

  it("single: a non-owner gets 404 and the owner's CSV survives", async () => {
    const res = await DELETE(req('DELETE', '/api/csvResult', B, { id: 1 }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'CSV no encontrado' });
    expect(mockDb.csv.get(1)).toBe('csv-A1');
  });

  it('single: the owner deletes it and gets 204 with no body (unchanged)', async () => {
    const res = await DELETE(req('DELETE', '/api/csvResult', A, { id: 1 }));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(mockDb.csv.has(1)).toBe(false);
    expect(mockDb.csv.has(2)).toBe(true);
  });

  it("bulk: only the caller's CSVs are deleted and counted; others' rows survive", async () => {
    const res = await DELETE(req('DELETE', '/api/csvResult', B, { ids: [1, 2, 3] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deletedCount: 1 });
    expect([...mockDb.csv.keys()].sort()).toEqual([1, 3]);
  });

  it('bulk: deletedCount is 0 and nothing is touched when every id is foreign', async () => {
    const res = await DELETE(req('DELETE', '/api/csvResult', B, { ids: [1, 3] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deletedCount: 0 });
    expect(mockDb.csv.size).toBe(3);
  });

  it("bulk: the owner deletes all of their own CSVs and keeps nobody else's", async () => {
    const res = await DELETE(req('DELETE', '/api/csvResult', A, { ids: [1, 2, 3, 4] }));

    expect(await res.json()).toEqual({ deletedCount: 2 });
    expect([...mockDb.csv.keys()]).toEqual([2]);
  });
});
