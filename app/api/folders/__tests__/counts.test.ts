/**
 * GET /api/folders?fields=counts (F12): `{ folders: [folder + planCount], noFolderCount }` with no plan rows, scoped to the
 * caller. The default listing and `?fields=summary` keep their exact shape (covered with the plans route in
 * app/api/flightPlans/__tests__/summary-listing.test.ts; here only what the counts mode must not disturb).
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const mockFolderFindMany = jest.fn();
const mockPlanGroupBy = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    folder: { findMany: (...a: unknown[]) => mockFolderFindMany(...a) },
    flightPlan: { groupBy: (...a: unknown[]) => mockPlanGroupBy(...a) },
  },
}));
jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() };
  return { __esModule: true, default: logger, logger };
});

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { GET } from '../route';

const USER = 10;
const get = (query: string, token: string | null = generateToken(USER)) =>
  GET(new NextRequest(`http://localhost/api/folders${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }));

const FOLDERS = [
  { id: 3, name: 'C', userId: USER },
  { id: 2, name: 'B', userId: USER },
  { id: 1, name: 'A', userId: USER },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFolderFindMany.mockResolvedValue(FOLDERS);
});

describe('GET /api/folders?fields=counts', () => {
  it('returns every folder with its planCount plus the plans without folder; folders without plans count 0', async () => {
    mockPlanGroupBy.mockResolvedValue([
      { folderId: 1, _count: { _all: 120 } },
      { folderId: null, _count: { _all: 7 } },
      { folderId: 3, _count: { _all: 1 } },
    ]);
    const res = await get('?fields=counts');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      folders: [
        { id: 3, name: 'C', userId: USER, planCount: 1 },
        { id: 2, name: 'B', userId: USER, planCount: 0 },
        { id: 1, name: 'A', userId: USER, planCount: 120 },
      ],
      noFolderCount: 7,
    });
  });

  it('no plans without folder -> noFolderCount 0; no plans at all -> every planCount 0', async () => {
    mockPlanGroupBy.mockResolvedValue([]);
    const body = await (await get('?fields=counts')).json();
    expect(body.noFolderCount).toBe(0);
    expect(body.folders.map((f: { planCount: number }) => f.planCount)).toEqual([0, 0, 0]);
  });

  it('a user without folders gets an empty list (and still the loose-plan count)', async () => {
    mockFolderFindMany.mockResolvedValue([]);
    mockPlanGroupBy.mockResolvedValue([{ folderId: null, _count: { _all: 4 } }]);
    expect(await (await get('?fields=counts')).json()).toEqual({ folders: [], noFolderCount: 4 });
  });

  it('is scoped to the caller: both queries filter by userId, folders newest first', async () => {
    mockPlanGroupBy.mockResolvedValue([]);
    await get('?fields=counts');
    expect(mockFolderFindMany).toHaveBeenCalledWith({ where: { userId: USER }, orderBy: { id: 'desc' } });
    expect(mockPlanGroupBy).toHaveBeenCalledWith({ by: ['folderId'], where: { userId: USER }, _count: { _all: true } });
  });

  it('reads no plan rows: the folder query has no include / select of flightPlans', async () => {
    mockPlanGroupBy.mockResolvedValue([]);
    await get('?fields=counts');
    expect(mockFolderFindMany.mock.calls[0][0]).not.toHaveProperty('include');
    expect(mockFolderFindMany.mock.calls[0][0]).not.toHaveProperty('select');
  });

  it('does not leak a folder that is not the caller\'s even if a count row names it (counts are matched by folder id)', async () => {
    mockPlanGroupBy.mockResolvedValue([{ folderId: 99, _count: { _all: 5 } }]);
    const body = await (await get('?fields=counts')).json();
    expect(body.folders.map((f: { id: number }) => f.id)).toEqual([3, 2, 1]);
    expect(body.folders.every((f: { planCount: number }) => f.planCount === 0)).toBe(true);
    expect(body.noFolderCount).toBe(0);
  });

  it('requires a token', async () => {
    expect((await get('?fields=counts', null)).status).toBe(401);
    expect(mockFolderFindMany).not.toHaveBeenCalled();
    expect(mockPlanGroupBy).not.toHaveBeenCalled();
  });

  it('answers 500, not a stack trace, when the database fails', async () => {
    mockPlanGroupBy.mockRejectedValue(new Error('db down'));
    const res = await get('?fields=counts');
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('db down');
  });
});

describe('GET /api/folders: counts mode does not disturb the other listings', () => {
  it.each([['no fields', ''], ['fields=full', '?fields=full'], ['a typo of the opt-in', '?fields=count'], ['upper case', '?fields=COUNTS']])(
    'default listing (%s) is still the plain array with the full plan rows and no groupBy',
    async (_label, query) => {
      const rows = [{ id: 1, name: 'F', flightPlans: [{ id: 7, fileContent: 'x' }] }];
      mockFolderFindMany.mockResolvedValue(rows);
      const res = await get(query);
      expect(await res.text()).toBe(JSON.stringify(rows));
      expect(mockFolderFindMany).toHaveBeenCalledWith({ where: { userId: USER }, include: { flightPlans: true }, orderBy: { id: 'desc' } });
      expect(mockPlanGroupBy).not.toHaveBeenCalled();
    }
  );

  it('fields=summary keeps its plan-id-only include and no groupBy', async () => {
    mockFolderFindMany.mockResolvedValue([{ id: 1, name: 'F', flightPlans: [{ id: 7 }] }]);
    await get('?fields=summary');
    expect(mockFolderFindMany).toHaveBeenCalledWith({ where: { userId: USER }, include: { flightPlans: { select: { id: true } } }, orderBy: { id: 'desc' } });
    expect(mockPlanGroupBy).not.toHaveBeenCalled();
  });
});
