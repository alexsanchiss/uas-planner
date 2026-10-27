/**
 * GET /api/flightPlans and GET /api/folders: the opt-in `?fields=summary` listing (F7a).
 * Contract: without `fields=summary` (or with any other value) the Prisma query and the JSON body are exactly what
 * they were before F7a (full rows, heavy columns included); with it the heavy columns (fileContent, uplan,
 * activationMessage) are never selected, the light flags hasFileContent / hasUplan are added, and a folder only
 * carries `flightPlans: [{ id }]`. Fails if the default path is changed or the heavy columns leak into the summary.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const mockPlanFindMany = jest.fn();
const mockFolderFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: { findMany: (...a: unknown[]) => mockPlanFindMany(...a) },
    folder: { findMany: (...a: unknown[]) => mockFolderFindMany(...a) },
  },
}));
jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() };
  return { __esModule: true, default: logger, logger };
});

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { GET as getPlans } from '../route';
import { GET as getFolders } from '../../folders/route';

const USER = 10;
const HEAVY = ['fileContent', 'uplan', 'activationMessage'];

const get = (handler: typeof getPlans, path: string, token: string | null = generateToken(USER)) =>
  handler(
    new NextRequest(`http://localhost${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );

// A full row as the default listing returns it (heavy columns present)
const FULL_ROW = {
  id: 7,
  customName: 'plan A',
  status: 'procesado',
  fileContent: '{"mission":{}}',
  uplan: '{"operationVolumes":[]}',
  activationMessage: 'long text',
  authorizationMessage: 'ACCEPTED_ALTERNATIVE',
  folder: { id: 1, name: 'F' },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/flightPlans', () => {
  it.each([['no fields', '/api/flightPlans'], ['fields=full', '/api/flightPlans?fields=full'], ['empty fields', '/api/flightPlans?fields=']])(
    'default listing (%s) is unchanged: same query, body byte-identical to the rows',
    async (_label, path) => {
      mockPlanFindMany.mockResolvedValue([FULL_ROW]);
      const res = await get(getPlans, path);
      expect(res.status).toBe(200);
      expect(mockPlanFindMany).toHaveBeenCalledTimes(1);
      expect(mockPlanFindMany).toHaveBeenCalledWith({ where: { userId: USER }, include: { folder: true }, orderBy: { id: 'desc' } });
      expect(await res.text()).toBe(JSON.stringify([FULL_ROW]));
    },
  );

  it('summary selects explicit light columns: no heavy column, authorizationMessage kept, userId-scoped', async () => {
    mockPlanFindMany.mockImplementation(async (args: { select?: Record<string, unknown>; where: Record<string, unknown> }) => {
      if (args.select && 'customName' in args.select) return [{ id: 7, customName: 'plan A', authorizationMessage: 'x' }];
      return [{ id: 7 }]; // the two id-only presence queries
    });
    const res = await get(getPlans, '/api/flightPlans?fields=summary');
    expect(res.status).toBe(200);

    const listing = mockPlanFindMany.mock.calls.map(([a]) => a).find((a) => a.select && 'customName' in a.select);
    expect(listing.where).toEqual({ userId: USER });
    expect(listing.include).toBeUndefined();
    for (const col of HEAVY) expect(listing.select).not.toHaveProperty(col);
    expect(listing.select.authorizationMessage).toBe(true);
    expect(listing.select.folder).toBe(true);
  });

  it('summary adds hasFileContent / hasUplan from id-only presence queries and never returns heavy text', async () => {
    mockPlanFindMany.mockImplementation(async (args: { select: Record<string, unknown>; where: Record<string, unknown> }) => {
      if ('customName' in args.select) return [{ id: 7, customName: 'a' }, { id: 6, customName: 'b' }];
      // presence queries: `{ not: null }` on the heavy column and only `id` selected
      expect(args.select).toEqual({ id: true });
      if (args.where.fileContent) return [{ id: 7 }, { id: 6 }];
      if (args.where.uplan) return [{ id: 6 }];
      throw new Error('unexpected query');
    });
    const body = await (await get(getPlans, '/api/flightPlans?fields=summary')).json();
    expect(body).toEqual([
      { id: 7, customName: 'a', hasFileContent: true, hasUplan: false },
      { id: 6, customName: 'b', hasFileContent: true, hasUplan: true },
    ]);
    for (const row of body) for (const col of HEAVY) expect(row).not.toHaveProperty(col);
    // every query stays scoped to the caller
    for (const [a] of mockPlanFindMany.mock.calls) expect(a.where.userId).toBe(USER);
  });

  it('requires auth on both paths', async () => {
    expect((await get(getPlans, '/api/flightPlans', null)).status).toBe(401);
    expect((await get(getPlans, '/api/flightPlans?fields=summary', null)).status).toBe(401);
    expect(mockPlanFindMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/folders', () => {
  it.each([['no fields', '/api/folders'], ['fields=full', '/api/folders?fields=full']])(
    'default listing (%s) still includes the full plan rows',
    async (_label, path) => {
      const rows = [{ id: 1, name: 'F', flightPlans: [FULL_ROW] }];
      mockFolderFindMany.mockResolvedValue(rows);
      const res = await get(getFolders, path);
      expect(mockFolderFindMany).toHaveBeenCalledWith({ where: { userId: USER }, include: { flightPlans: true }, orderBy: { id: 'desc' } });
      expect(await res.text()).toBe(JSON.stringify(rows));
    },
  );

  it('summary only selects the plan ids', async () => {
    mockFolderFindMany.mockResolvedValue([{ id: 1, name: 'F', flightPlans: [{ id: 7 }] }]);
    const res = await get(getFolders, '/api/folders?fields=summary');
    expect(res.status).toBe(200);
    expect(mockFolderFindMany).toHaveBeenCalledWith({
      where: { userId: USER },
      include: { flightPlans: { select: { id: true } } },
      orderBy: { id: 'desc' },
    });
  });
});
