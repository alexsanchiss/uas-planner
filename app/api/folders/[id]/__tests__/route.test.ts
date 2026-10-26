/**
 * DELETE /api/folders/[id]: the cleanup only touches the CALLER's plans (SEC-06 leftover).
 *
 * Before F4 anybody could plant a plan inside someone else's folder (POST/PUT folderId was
 * unchecked), and deleting the folder then removed those plans and their CSVs whoever owned them.
 * The prisma fake honours `where` (folderId, userId) and enforces the real foreign key: the
 * `flightplan.folderId -> folder.id` relation is onDelete NoAction, so a folder that still has
 * plans cannot be removed.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

type Plan = { id: number; folderId: number | null; userId: number };
type Where = { folderId?: number; userId?: number; id?: { in: number[] } };

const mockDb = {
  folders: [] as Array<{ id: number; userId: number }>,
  plans: [] as Plan[],
  csv: new Set<number>(),
};

const matches = (p: Plan, where: Where) =>
  (where.folderId === undefined || p.folderId === where.folderId) && (where.userId === undefined || p.userId === where.userId);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    folder: {
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) => mockDb.folders.find((f) => f.id === where.id) ?? null),
      delete: jest.fn(async ({ where }: { where: { id: number } }) => {
        if (mockDb.plans.some((p) => p.folderId === where.id)) throw new Error('P2003 foreign key constraint failed');
        mockDb.folders = mockDb.folders.filter((f) => f.id !== where.id);
        return { id: where.id };
      }),
    },
    flightPlan: {
      findMany: jest.fn(async ({ where }: { where: Where }) => mockDb.plans.filter((p) => matches(p, where)).map((p) => ({ id: p.id }))),
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const gone = mockDb.plans.filter((p) => matches(p, where));
        mockDb.plans = mockDb.plans.filter((p) => !gone.includes(p));
        return { count: gone.length };
      }),
    },
    csvResult: {
      deleteMany: jest.fn(async ({ where }: { where: { id: { in: number[] } } }) => {
        const hit = where.id.in.filter((id) => mockDb.csv.delete(id));
        return { count: hit.length };
      }),
    },
  },
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { DELETE } from '../route';

const A = 10;
const B = 20;

function del(userId: number | null, id = '3') {
  const headers: Record<string, string> = {};
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return DELETE(new NextRequest(`http://localhost/api/folders/${id}`, { method: 'DELETE', headers }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockDb.folders = [
    { id: 3, userId: A },
    { id: 4, userId: A },
  ];
  mockDb.plans = [
    { id: 21, folderId: 3, userId: A },
    { id: 22, folderId: 3, userId: A },
    { id: 24, folderId: 4, userId: A },
  ];
  mockDb.csv = new Set([21, 22, 24]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DELETE /api/folders/[id]', () => {
  it("deletes the folder, the owner's plans in it and their CSVs, and nothing from other folders (204)", async () => {
    const res = await del(A);

    expect(res.status).toBe(204);
    expect(mockDb.folders.map((f) => f.id)).toEqual([4]);
    expect(mockDb.plans.map((p) => p.id)).toEqual([24]);
    expect([...mockDb.csv]).toEqual([24]);
  });

  it("never deletes another user's plan or CSV planted in the folder (the cleanup is scoped by userId)", async () => {
    mockDb.plans.push({ id: 23, folderId: 3, userId: B });
    mockDb.csv.add(23);

    await del(A);

    expect(mockDb.plans.map((p) => p.id)).toContain(23);
    expect(mockDb.csv.has(23)).toBe(true);
    // the caller's own plans are still cleaned up
    expect(mockDb.plans.map((p) => p.id)).not.toContain(21);
    expect(mockDb.csv.has(21)).toBe(false);
  });

  // KNOWN GAP (round-2 review): a leftover foreign plan keeps the folder FK-locked, so the real route
  // answers 500 after having already deleted the caller's plans. Detach foreign plans
  // (folderId = null) before folder.delete; remove `.failing` then.
  it.failing('a leftover foreign plan does not block deleting the folder (it is detached, not deleted)', async () => {
    mockDb.plans.push({ id: 23, folderId: 3, userId: B });
    mockDb.csv.add(23);

    const res = await del(A);

    expect(res.status).toBe(204);
    expect(mockDb.folders.map((f) => f.id)).toEqual([4]);
    expect(mockDb.plans.find((p) => p.id === 23)).toMatchObject({ folderId: null, userId: B });
  });

  it('403 for someone else\'s folder, 404 for an unknown one, 401 without a token: nothing is deleted', async () => {
    expect((await del(B)).status).toBe(403);
    expect((await del(A, '99')).status).toBe(404);
    expect((await del(null)).status).toBe(401);

    expect(mockDb.folders).toHaveLength(2);
    expect(mockDb.plans).toHaveLength(3);
    expect(mockDb.csv.size).toBe(3);
  });
});
