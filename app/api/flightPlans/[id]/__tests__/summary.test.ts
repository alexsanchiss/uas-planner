/**
 * GET /api/flightPlans/[id]?fields=summary (R6 round 2): the opt-in light row the production list polls for the selected plan.
 * Contract:
 *   - default (no `fields`, or any other value): exactly the old query and the old body (full row + folder, heavy columns in);
 *   - summary: the SAME select as the list (lib/flight-plan-summary SUMMARY_SELECT), heavy columns never read, plus
 *     hasFileContent / hasUplan; the 404 / 403 / 400 / 401 answers are the same as the default path, and the presence
 *     lookups only run for a plan the caller owns;
 *   - property: for every plan, the summary of [id] equals the row the paged list gives for it, and equals the full row minus
 *     the heavy columns, so swapping one for the other in the list is invisible.
 * The prisma mock is an in-memory table (select / include / where / skip / take applied like the database would).
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

type Row = Record<string, unknown> & { id: number; userId: number; folderId: number | null; fileContent: string | null; uplan: string | null; activationMessage: string | null; customName: string; authorizationStatus: string };

const USER = 10;
const OTHER = 11;
const FOLDERS: Record<number, { id: number; name: string; userId: number }> = {
  1: { id: 1, name: 'F1', userId: USER },
  2: { id: 2, name: 'F2', userId: USER },
  3: { id: 3, name: 'F3', userId: OTHER },
};
const dbRows: Row[] = [];
const calls = { findUnique: [] as { where: { id: number }; select?: Record<string, unknown>; include?: unknown }[], findFirst: [] as { where: Record<string, unknown>; select?: Record<string, unknown> }[] };

const project = (r: Row, select?: Record<string, unknown>, include?: { folder?: boolean }) => {
  const withFolder = (select ? select.folder === true : include?.folder === true) ? { folder: r.folderId === null ? null : FOLDERS[r.folderId] } : {};
  if (select) return { ...Object.fromEntries(Object.keys(select).filter((k) => k in r && select[k] === true).map((k) => [k, r[k]])), ...withFolder };
  return { ...r, ...withFolder };
};
type Where = { id?: number | { in: number[] }; userId?: number; folderId?: number | null; customName?: { contains: string }; authorizationStatus?: string; fileContent?: { not: null }; uplan?: { not: null } };
const matches = (r: Row, w: Where): boolean =>
  (w.id === undefined || (typeof w.id === 'number' ? r.id === w.id : w.id.in.includes(r.id))) &&
  (w.userId === undefined || r.userId === w.userId) &&
  (w.folderId === undefined || r.folderId === w.folderId) &&
  (w.customName === undefined || r.customName.toLowerCase().includes(w.customName.contains.toLowerCase())) &&
  (w.authorizationStatus === undefined || r.authorizationStatus === w.authorizationStatus) &&
  (w.fileContent === undefined || r.fileContent !== null) &&
  (w.uplan === undefined || r.uplan !== null);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: async (args: { where: { id: number }; select?: Record<string, unknown>; include?: { folder?: boolean } }) => {
        calls.findUnique.push(args);
        const r = dbRows.find((x) => x.id === args.where.id);
        return r ? project(r, args.select, args.include) : null;
      },
      findFirst: async (args: { where: Where; select?: Record<string, unknown> }) => {
        calls.findFirst.push(args as never);
        const r = dbRows.find((x) => matches(x, args.where));
        return r ? project(r, args.select) : null;
      },
      findMany: async (args: { where: Where; select?: Record<string, unknown>; orderBy?: { id: 'desc' }; skip?: number; take?: number }) => {
        let out = dbRows.filter((r) => matches(r, args.where));
        if (args.orderBy?.id === 'desc') out = [...out].sort((a, b) => b.id - a.id);
        out = out.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
        return out.map((r) => project(r, args.select));
      },
      count: async (args: { where: Where }) => dbRows.filter((r) => matches(r, args.where)).length,
    },
    folder: { count: async () => 1 },
  },
}));
jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() };
  return { __esModule: true, default: logger, logger };
});

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { SUMMARY_SELECT } from '@/lib/flight-plan-summary';
import { GET as getById } from '../route';
import { GET as getList } from '../../route';

const HEAVY = ['fileContent', 'uplan', 'activationMessage'];

const token = (user: number | null): Record<string, string> => (user ? { Authorization: `Bearer ${generateToken(user)}` } : {});
const byId = (id: string | number, query = '', user: number | null = USER) =>
  getById(new NextRequest(`http://localhost/api/flightPlans/${id}${query}`, { headers: token(user) }), { params: Promise.resolve({ id: String(id) }) });
const list = (user: number | null = USER) => getList(new NextRequest('http://localhost/api/flightPlans?fields=summary&limit=100', { headers: token(user) }));

beforeEach(() => {
  jest.clearAllMocks();
  calls.findUnique.length = 0;
  calls.findFirst.length = 0;
  dbRows.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // 30 plans: odd ids belong to USER, even to OTHER; heavy columns present / absent in every combination
  for (let i = 1; i <= 30; i++) {
    dbRows.push({
      id: i,
      userId: i % 2 ? USER : OTHER,
      folderId: i % 2 ? [null, 1, 2][i % 3] : [null, 3][i % 2 ? 0 : 1],
      customName: `plan ${i}`,
      status: ['sin procesar', 'procesado', 'error'][i % 3],
      csvResult: i % 3 === 1 ? 1 : null,
      createdAt: `2030-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      machineAssignedId: i % 4 === 0 ? i : null,
      authorizationStatus: ['sin autorización', 'aprobado', 'denegado', 'pendiente'][i % 4],
      authorizationMessage: i % 3 === 0 ? `{"msg":${i}}` : null,
      scheduledAt: i % 2 ? '2030-02-01T10:00:00.000Z' : null,
      externalResponseNumber: i % 5 === 0 ? `ext-${i}` : null,
      geoawarenessData: i % 6 === 0 ? { uspace_identifier: 'VLCUspace' } : null,
      activationStatus: 'no activable',
      activatedAt: null,
      termsAcceptedAt: null,
      lastActivationAttempt: null,
      fileContent: i % 2 === 0 || i % 3 === 0 ? `{"mission":${i}}` : null,
      uplan: i % 3 === 1 || i % 7 === 0 ? `{"operationVolumes":[${i}]}` : null,
      activationMessage: i % 5 === 0 ? 'long activation text' : null,
    });
  }
});

const OWN = () => dbRows.filter((r) => r.userId === USER).map((r) => r.id);

describe('GET /api/flightPlans/[id]: the default is unchanged', () => {
  it.each([['no fields', ''], ['fields=full', '?fields=full'], ['empty fields', '?fields='], ['upper case', '?fields=SUMMARY'], ['a typo', '?fields=summry']])(
    '%s: same query (full row + folder), body byte-identical to the row',
    async (_label, query) => {
      const id = OWN()[0];
      const res = await byId(id, query);
      expect(res.status).toBe(200);
      expect(calls.findUnique).toEqual([{ where: { id }, include: { folder: true } }]);
      expect(calls.findFirst).toHaveLength(0);
      const row = dbRows.find((r) => r.id === id)!;
      expect(await res.text()).toBe(JSON.stringify({ ...row, folder: row.folderId === null ? null : FOLDERS[row.folderId] }));
    }
  );

  it('the default body still carries the heavy columns and no hasFileContent / hasUplan flags', async () => {
    const id = OWN().find((i) => dbRows[i - 1].fileContent && dbRows[i - 1].uplan)!;
    const body = await (await byId(id)).json();
    expect(body.fileContent).toBeTruthy();
    expect(body.uplan).toBeTruthy();
    expect(body).not.toHaveProperty('hasFileContent');
    expect(body).not.toHaveProperty('hasUplan');
  });
});

describe('GET /api/flightPlans/[id]?fields=summary', () => {
  it('reads with the shared SUMMARY_SELECT (no include), and never selects a heavy column', async () => {
    const id = OWN()[0];
    const res = await byId(id, '?fields=summary');
    expect(res.status).toBe(200);
    expect(calls.findUnique).toHaveLength(1);
    expect(calls.findUnique[0].select).toBe(SUMMARY_SELECT);
    expect(calls.findUnique[0].include).toBeUndefined();
    for (const col of HEAVY) expect(SUMMARY_SELECT).not.toHaveProperty(col);
  });

  it('the body has no heavy column and carries the two flags computed from the heavy columns, for every plan of the caller', async () => {
    for (const id of OWN()) {
      const body = await (await byId(id, '?fields=summary')).json();
      const row = dbRows.find((r) => r.id === id)!;
      for (const col of HEAVY) expect({ id, col, has: col in body }).toEqual({ id, col, has: false });
      expect({ id, f: body.hasFileContent, u: body.hasUplan }).toEqual({ id, f: row.fileContent !== null, u: row.uplan !== null });
    }
  });

  it('PROPERTY: the summary of [id] equals the row of the paged list for the same plan (same keys, same values)', async () => {
    const items = (await (await list()).json()).items as Record<string, unknown>[];
    expect(items).toHaveLength(OWN().length);
    for (const item of items) {
      const body = await (await byId(item.id as number, '?fields=summary')).json();
      expect({ id: item.id, body }).toEqual({ id: item.id, body: item });
    }
  });

  it('PROPERTY: the summary equals the full row minus the heavy columns (plus the flags)', async () => {
    for (const id of OWN()) {
      const full = await (await byId(id)).json();
      const sum = await (await byId(id, '?fields=summary')).json();
      const { fileContent, uplan, activationMessage, ...light } = full;
      void activationMessage;
      expect({ id, sum }).toEqual({ id, sum: { ...light, hasFileContent: fileContent !== null, hasUplan: uplan !== null } });
    }
  });

  it('presence lookups: two id-only reads on THIS plan, after the ownership check', async () => {
    const id = OWN()[0];
    await byId(id, '?fields=summary');
    expect(calls.findFirst).toHaveLength(2);
    for (const c of calls.findFirst) {
      expect(c.select).toEqual({ id: true });
      expect(c.where.id).toBe(id);
    }
    expect(calls.findFirst.map((c) => Object.keys(c.where).sort())).toEqual([['fileContent', 'id'], ['id', 'uplan']]);
  });
});

describe('GET /api/flightPlans/[id]: the same answers on both paths', () => {
  it.each([['default', ''], ['summary', '?fields=summary']])('%s: a plan of another user is 403 and nothing else is read', async (_label, query) => {
    const foreign = dbRows.find((r) => r.userId === OTHER)!.id;
    const res = await byId(foreign, query);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Access denied' });
    expect(calls.findFirst).toHaveLength(0); // the presence lookups never run for a plan that is not the caller's
  });

  it.each([['default', ''], ['summary', '?fields=summary']])('%s: a plan that does not exist is 404', async (_label, query) => {
    const res = await byId(9999, query);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Flight plan not found' });
    expect(calls.findFirst).toHaveLength(0);
  });

  it.each([['abc'], ['0'], ['-4']])('id %s is a 400 before any query, with or without fields=summary', async (id) => {
    for (const query of ['', '?fields=summary']) {
      const res = await byId(id, query);
      expect(res.status).toBe(400);
    }
    expect(calls.findUnique).toHaveLength(0);
  });

  it.each([['default', ''], ['summary', '?fields=summary']])('%s: needs a token', async (_label, query) => {
    expect((await byId(1, query, null)).status).toBe(401);
    expect(calls.findUnique).toHaveLength(0);
  });

  it('a database failure is a 500 with the generic message on the summary path too', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const prisma = (await import('@/lib/prisma')).default as unknown as { flightPlan: { findUnique: jest.Mock | ((...a: unknown[]) => unknown) } };
    const original = prisma.flightPlan.findUnique;
    prisma.flightPlan.findUnique = jest.fn(async () => {
      throw new Error('db down');
    });
    const res = await byId(OWN()[0], '?fields=summary');
    prisma.flightPlan.findUnique = original;
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('db down');
  });
});
