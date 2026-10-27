/**
 * GET /api/flightPlans opt-in paging (F12): `fields=summary&limit=1..100[&offset][&folderId=<id|none>][&q][&authorizationStatus]`
 * -> `{ items, total }`. Contract: only the caller's plans (every query carries userId), a folder that is not the caller's
 * is a 404, `none` = the plans without folder, newest first (id desc), the total is the total of the same filter, bad
 * parameters are a 400 before any query, and a request without `limit` still gets the old array.
 *
 * The prisma mock is a small in-memory table: it applies `where` / `orderBy` / `skip` / `take` the way MySQL would, so the
 * assertions are on what comes back (who sees what), not on how the call was spelled. Every call is also recorded.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

type Row = {
  id: number;
  userId: number;
  folderId: number | null;
  customName: string;
  authorizationStatus: string;
  fileContent: string | null;
  uplan: string | null;
};
type Where = {
  id?: { in: number[] };
  userId?: number;
  folderId?: number | null;
  customName?: { contains: string };
  authorizationStatus?: string;
  fileContent?: { not: null };
  uplan?: { not: null };
};

const USER = 10;
const OTHER = 11;
const dbRows: Row[] = [];
const folders = [
  { id: 1, userId: USER },
  { id: 2, userId: USER },
  { id: 3, userId: OTHER }, // someone else's folder
];
const calls = { findMany: [] as { where: Where; select?: Record<string, unknown>; orderBy?: unknown; skip?: number; take?: number }[], count: [] as { where: Where }[], folderCount: [] as unknown[] };

const matches = (r: Row, w: Where): boolean =>
  (w.id === undefined || w.id.in.includes(r.id)) &&
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
      findMany: async (args: { where: Where; select?: Record<string, unknown>; orderBy?: { id: 'desc' }; skip?: number; take?: number }) => {
        calls.findMany.push(args);
        let out = dbRows.filter((r) => matches(r, args.where));
        if (args.orderBy?.id === 'desc') out = [...out].sort((a, b) => b.id - a.id);
        out = out.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
        // `select` -> only those columns (id-only presence queries stay id-only)
        return out.map((r) => (args.select ? Object.fromEntries(Object.keys(args.select).filter((k) => k in r).map((k) => [k, r[k as keyof Row]])) : r));
      },
      count: async (args: { where: Where }) => {
        calls.count.push(args);
        return dbRows.filter((r) => matches(r, args.where)).length;
      },
    },
    folder: {
      count: async (args: { where: { id: { in: number[] }; userId: number } }) => {
        calls.folderCount.push(args);
        return folders.filter((f) => args.where.id.in.includes(f.id) && f.userId === args.where.userId).length;
      },
    },
  },
}));
jest.mock('@/lib/logger', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), exception: jest.fn() };
  return { __esModule: true, default: logger, logger };
});

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { GET } from '../route';

const HEAVY = ['fileContent', 'uplan', 'activationMessage'];

const get = (query: string, user: number | null = USER) =>
  GET(new NextRequest(`http://localhost/api/flightPlans${query}`, { headers: user ? { Authorization: `Bearer ${generateToken(user)}` } : {} }));
const page = async (query: string) => {
  const res = await get(query);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
  calls.findMany.length = 0;
  calls.count.length = 0;
  calls.folderCount.length = 0;
  dbRows.length = 0;
  // USER: folder 1 -> ids 1..5 (id 5 is approved), folder 2 -> 6..7, no folder -> 8..10. OTHER: 100..104 (folder 3 and none)
  const mk = (id: number, userId: number, folderId: number | null, name: string, over: Partial<Row> = {}): Row => ({
    id,
    userId,
    folderId,
    customName: name,
    authorizationStatus: 'sin autorización',
    fileContent: '{"mission":{}}',
    uplan: null,
    ...over,
  });
  for (let i = 1; i <= 5; i++) dbRows.push(mk(i, USER, 1, `Alpha ${i}`, i === 5 ? { authorizationStatus: 'aprobado', uplan: '{}' } : {}));
  for (let i = 6; i <= 7; i++) dbRows.push(mk(i, USER, 2, `Beta ${i}`));
  for (let i = 8; i <= 10; i++) dbRows.push(mk(i, USER, null, `Loose ${i}`, i === 9 ? { fileContent: null, uplan: '{}' } : {}));
  for (let i = 100; i <= 102; i++) dbRows.push(mk(i, OTHER, 3, `Alpha foreign ${i}`));
  for (let i = 103; i <= 104; i++) dbRows.push(mk(i, OTHER, null, `Loose foreign ${i}`));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const idsOf = (b: { items: { id: number }[] }) => b.items.map((p) => p.id);

describe('GET /api/flightPlans paging: shape, order, totals', () => {
  it('returns { items, total }: newest first, the total of the whole filter, summary rows only', async () => {
    const { status, body } = await page('?fields=summary&limit=3');
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['items', 'total']);
    expect(idsOf(body)).toEqual([10, 9, 8]);
    expect(body.total).toBe(10); // all of USER's plans, not 3, not the other user's
    for (const row of body.items) for (const col of HEAVY) expect(row).not.toHaveProperty(col);
  });

  it('every row carries hasFileContent / hasUplan for ITS plan (primary-key lookups, page only)', async () => {
    const { body } = await page('?fields=summary&limit=10');
    const byId = Object.fromEntries(body.items.map((p: { id: number; hasFileContent: boolean; hasUplan: boolean }) => [p.id, p]));
    expect([byId[9].hasFileContent, byId[9].hasUplan]).toEqual([false, true]); // imported-like: no file, a U-plan
    expect([byId[5].hasFileContent, byId[5].hasUplan]).toEqual([true, true]);
    expect([byId[1].hasFileContent, byId[1].hasUplan]).toEqual([true, false]);
    // the presence queries only look at the ids of this page
    const presence = calls.findMany.filter((c) => c.where.id);
    expect(presence).toHaveLength(2);
    for (const c of presence) expect([...c.where.id!.in].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('offset pages through the list with no gaps and no repeats; the last page is short; past the end is empty with the same total', async () => {
    const seen: number[] = [];
    for (let offset = 0; offset < 10; offset += 4) {
      const { body } = await page(`?fields=summary&limit=4&offset=${offset}`);
      expect(body.total).toBe(10);
      seen.push(...idsOf(body));
    }
    expect(seen).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const past = await page('?fields=summary&limit=4&offset=40');
    expect(past.body).toEqual({ items: [], total: 10 });
  });

  it('offset defaults to 0, limit 1 and 100 are the bounds', async () => {
    expect(idsOf((await page('?fields=summary&limit=1')).body)).toEqual([10]);
    expect((await page('?fields=summary&limit=100')).body.items).toHaveLength(10);
  });

  it('a user without plans gets an empty page, not an error', async () => {
    const res = await get('?fields=summary&limit=25', 999);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], total: 0 });
  });
});

describe('GET /api/flightPlans paging: scoping', () => {
  it('never returns another user\'s plan, with or without filters; every query carries userId', async () => {
    for (const q of ['?fields=summary&limit=100', '?fields=summary&limit=100&folderId=none', '?fields=summary&limit=100&folderId=1', '?fields=summary&limit=100&q=alpha', '?fields=summary&limit=100&authorizationStatus=aprobado']) {
      calls.findMany.length = 0;
      calls.count.length = 0;
      const { status, body } = await page(q);
      expect({ q, status }).toEqual({ q, status: 200 });
      expect({ q, foreign: idsOf(body).filter((id: number) => id >= 100) }).toEqual({ q, foreign: [] });
      // the listing and the count carry userId; the two presence lookups only see ids of that page and return nothing but `id`
      for (const c of [...calls.findMany.filter((x) => !x.where.id), ...calls.count]) expect({ q, userId: c.where.userId }).toEqual({ q, userId: USER });
      for (const c of calls.findMany.filter((x) => x.where.id)) expect({ q, select: c.select }).toEqual({ q, select: { id: true } });
    }
  });

  it('the other user sees only theirs (the token decides, not a parameter)', async () => {
    const res = await get('?fields=summary&limit=100&userId=10', OTHER);
    const body = await res.json();
    expect(idsOf(body).sort((a: number, b: number) => a - b)).toEqual([100, 101, 102, 103, 104]);
    expect(body.total).toBe(5);
  });

  it('a folder of another user is a 404 and nothing is read', async () => {
    const res = await get('?fields=summary&limit=25&folderId=3');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Folder not found' });
    expect(calls.findMany).toHaveLength(0);
    expect(calls.count).toHaveLength(0);
  });

  it('a folder that does not exist is the same 404 (no way to tell it from a foreign one)', async () => {
    const res = await get('?fields=summary&limit=25&folderId=999');
    expect(res.status).toBe(404);
    expect(calls.findMany).toHaveLength(0);
  });

  it('an own folder returns only its plans; an empty own folder is 200 with no items', async () => {
    const { body } = await page('?fields=summary&limit=25&folderId=2');
    expect(idsOf(body)).toEqual([7, 6]);
    expect(body.total).toBe(2);
    dbRows.splice(0, dbRows.length, ...dbRows.filter((r) => r.folderId !== 2));
    expect((await page('?fields=summary&limit=25&folderId=2')).body).toEqual({ items: [], total: 0 });
  });

  it('folderId=none = the caller\'s plans without folder (and needs no folder ownership check)', async () => {
    const { body } = await page('?fields=summary&limit=25&folderId=none');
    expect(idsOf(body)).toEqual([10, 9, 8]);
    expect(body.total).toBe(3);
    expect(calls.folderCount).toHaveLength(0);
    expect(calls.findMany[0].where.folderId).toBeNull();
  });

  it('without folderId the list spans every folder and the no-folder plans of the caller', async () => {
    const { body } = await page('?fields=summary&limit=100');
    expect(new Set(body.items.map((p: { folderId: number | null }) => p.folderId))).toEqual(new Set([1, 2, null]));
  });
});

describe('GET /api/flightPlans paging: filters', () => {
  it('q is a case-insensitive "name contains" over the caller\'s plans, with its own total', async () => {
    const { body } = await page('?fields=summary&limit=2&q=ALPHA');
    expect(idsOf(body)).toEqual([5, 4]);
    expect(body.total).toBe(5); // the 3 "Alpha foreign" plans belong to the other user
  });

  it('q works across folders and respects folderId when both are given', async () => {
    expect(idsOf((await page('?fields=summary&limit=25&q=o')).body)).toEqual([10, 9, 8]); // "Loose" only
    expect((await page('?fields=summary&limit=25&q=loose&folderId=1')).body).toEqual({ items: [], total: 0 });
  });

  it('a blank q (after trim) is no filter at all', async () => {
    const withBlank = await page('?fields=summary&limit=100&q=%20%20');
    const without = await page('?fields=summary&limit=100');
    expect(withBlank.body).toEqual(without.body);
    expect(calls.findMany.every((c) => !('customName' in c.where))).toBe(true);
  });

  it('q is trimmed', async () => {
    expect(idsOf((await page('?fields=summary&limit=25&q=%20Beta%20')).body)).toEqual([7, 6]);
  });

  it('authorizationStatus is an exact filter (the folder delete asks for the approved ids of a folder)', async () => {
    const { body } = await page('?fields=summary&limit=100&folderId=1&authorizationStatus=aprobado');
    expect(idsOf(body)).toEqual([5]);
    expect(body.total).toBe(1);
  });
});

describe('GET /api/flightPlans paging: validation (400 before any query)', () => {
  it.each([
    ['limit missing a value', '?fields=summary&limit='],
    ['limit 0', '?fields=summary&limit=0'],
    ['limit 101', '?fields=summary&limit=101'],
    ['limit negative', '?fields=summary&limit=-5'],
    ['limit not a number', '?fields=summary&limit=abc'],
    ['limit fractional', '?fields=summary&limit=1.5'],
    ['offset negative', '?fields=summary&limit=10&offset=-1'],
    ['offset not a number', '?fields=summary&limit=10&offset=x'],
    ['offset huge', '?fields=summary&limit=10&offset=10000001'],
    ['folderId zero', '?fields=summary&limit=10&folderId=0'],
    ['folderId negative', '?fields=summary&limit=10&folderId=-2'],
    ['folderId word', '?fields=summary&limit=10&folderId=abc'],
    ['folderId NONE (case matters)', '?fields=summary&limit=10&folderId=NONE'],
    ['folderId empty', '?fields=summary&limit=10&folderId='],
    ['folderId fractional', '?fields=summary&limit=10&folderId=1.5'],
    ['q longer than 100', `?fields=summary&limit=10&q=${'x'.repeat(101)}`],
    ['unknown authorizationStatus', '?fields=summary&limit=10&authorizationStatus=hacked'],
    ['fields missing', '?limit=10'],
    ['fields=full', '?fields=full&limit=10'],
  ])('%s', async (_label, query) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
    expect(calls.findMany).toHaveLength(0);
    expect(calls.count).toHaveLength(0);
    expect(calls.folderCount).toHaveLength(0);
  });

  it('q of exactly 100 characters is fine', async () => {
    expect((await get(`?fields=summary&limit=10&q=${'x'.repeat(100)}`)).status).toBe(200);
  });

  it('requires a token', async () => {
    expect((await get('?fields=summary&limit=10', null)).status).toBe(401);
    expect(calls.findMany).toHaveLength(0);
  });
});

describe('GET /api/flightPlans: the default responses do not change', () => {
  it('without `limit` the paging parameters are ignored: ?fields=summary stays the full light ARRAY of the caller\'s plans', async () => {
    const res = await get('?fields=summary&offset=3&folderId=1&q=zzz&authorizationStatus=aprobado');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(10);
    expect(calls.count).toHaveLength(0); // no count query: not the paged path
    expect(calls.findMany[0].where).toEqual({ userId: USER });
    expect(calls.findMany[0].skip).toBeUndefined();
    expect(calls.findMany[0].take).toBeUndefined();
  });

  it('without `fields=summary` and without `limit` the full rows (heavy columns) come back as before', async () => {
    const res = await get('');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('fileContent');
    expect(calls.findMany[0]).toMatchObject({ where: { userId: USER }, include: { folder: true }, orderBy: { id: 'desc' } });
  });
});
