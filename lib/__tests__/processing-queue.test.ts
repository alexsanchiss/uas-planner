/**
 * queueInfo: 1-based position + length over ALL users' 'en cola' plans, in the exact order of
 * traj-assigner.js (scheduledAt asc NULLs last, createdAt asc, id asc). prisma is faked with a findMany
 * that really sorts by the orderBy it receives, so the test checks the order Prisma would apply.
 */
import fs from 'fs';
import path from 'path';

type Row = { id: number; status: string; scheduledAt: Date | null; createdAt: Date };
type Spec = 'asc' | 'desc' | { sort: 'asc' | 'desc'; nulls?: 'first' | 'last' };
type OrderBy = Array<Record<string, Spec>>;

let db: Row[] = [];
const mockFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { flightPlan: { findMany: (...a: unknown[]) => mockFindMany(...a) } },
}));

import { queueInfo } from '../processing-queue';

/** Interprets { where: { status }, orderBy } the way Prisma/MySQL would (MySQL default: NULLs first on asc). */
function fakeFindMany({ where, orderBy }: { where: { status: string }; orderBy: OrderBy }) {
  const keys = orderBy.map((o) => {
    const [field, spec] = Object.entries(o)[0];
    return typeof spec === 'string'
      ? { field, dir: spec, nulls: 'first' as const }
      : { field, dir: spec.sort, nulls: spec.nulls ?? ('first' as const) };
  });
  const val = (r: Row, field: string): number | null => {
    const v = (r as unknown as Record<string, Date | number | null>)[field];
    return v === null ? null : v instanceof Date ? v.getTime() : v;
  };
  const rows = db
    .filter((r) => r.status === where.status)
    .sort((x, y) => {
      for (const k of keys) {
        const a = val(x, k.field);
        const b = val(y, k.field);
        if (a === b) continue;
        if (a === null || b === null) return (a === null) === (k.nulls === 'first') ? -1 : 1;
        return k.dir === 'asc' ? a - b : b - a;
      }
      return 0;
    });
  return Promise.resolve(rows.map((r) => ({ id: r.id })));
}

const d = (s: string) => new Date(`2026-11-10T${s}Z`);
const row = (id: number, status: string, createdAt: string, scheduledAt: string | null = null): Row => ({
  id,
  status,
  createdAt: d(createdAt),
  scheduledAt: scheduledAt ? d(scheduledAt) : null,
});

beforeEach(() => {
  jest.clearAllMocks();
  db = [];
  mockFindMany.mockImplementation(fakeFindMany);
});

describe('queueInfo', () => {
  it('does not query when no row is queued, and returns null position/length for every row', async () => {
    const out = await queueInfo([
      { id: 1, status: 'sin procesar' },
      { id: 2, status: 'procesando' },
      { id: 3, status: 'procesado' },
      { id: 4, status: 'error' },
    ]);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(out.every((r) => r.queuePosition === null && r.queueLength === null)).toBe(true);
  });

  it('returns an empty list for no rows without querying', async () => {
    expect(await queueInfo([])).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('asks for the id of every queued plan with the assigner order, in one query', async () => {
    db = [row(1, 'en cola', '08:00:00')];
    await queueInfo([{ id: 1, status: 'en cola' }]);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: 'en cola' },
      orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
  });

  it('uses the same ordering expression as traj-assigner.js', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'traj-assigner.js'), 'utf8');
    const order = src.slice(src.indexOf("status: 'en cola'"));
    const i1 = order.indexOf("scheduledAt: { sort: 'asc', nulls: 'last' }");
    const i2 = order.indexOf("createdAt: 'asc'");
    const i3 = order.indexOf("id: 'asc'");
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });

  it('ranks scheduled plans first (earliest first), then unscheduled by createdAt, then by id', async () => {
    db = [
      row(10, 'en cola', '09:00:00'), // unscheduled, newer
      row(11, 'en cola', '08:00:00'), // unscheduled, older
      row(12, 'en cola', '10:00:00', '12:00:00'), // scheduled later
      row(13, 'en cola', '10:30:00', '11:00:00'), // scheduled earlier
      row(15, 'en cola', '09:00:00'), // same createdAt as 10 and 14 -> id tiebreak
      row(14, 'en cola', '09:00:00'),
    ];
    const out = await queueInfo(db.map((r) => ({ id: r.id, status: r.status })));
    const pos = Object.fromEntries(out.map((r) => [r.id, r.queuePosition]));
    expect(pos).toEqual({ 13: 1, 12: 2, 11: 3, 10: 4, 14: 5, 15: 6 });
    expect(out.every((r) => r.queueLength === 6)).toBe(true);
  });

  it('counts the queue of every user and ignores plans that are not queued', async () => {
    db = [
      row(1, 'procesando', '07:00:00'),
      row(2, 'en cola', '08:00:00'), // another user's plan: still ahead
      row(3, 'procesado', '08:30:00'),
      row(4, 'en cola', '09:00:00'), // ours
      row(5, 'error', '09:30:00'),
    ];
    const out = await queueInfo([
      { id: 4, status: 'en cola' },
      { id: 5, status: 'error' },
    ]);
    expect(out[0]).toMatchObject({ id: 4, queuePosition: 2, queueLength: 2 });
    expect(out[1]).toMatchObject({ id: 5, queuePosition: null, queueLength: null });
  });

  it('a plan that left the queue between the two reads gets null/null, not a bogus position', async () => {
    db = [row(1, 'en cola', '08:00:00')];
    const out = await queueInfo([
      { id: 1, status: 'en cola' },
      { id: 99, status: 'en cola' }, // listed as queued, but gone from the queue now
    ]);
    expect(out[0]).toMatchObject({ queuePosition: 1, queueLength: 1 });
    expect(out[1]).toMatchObject({ queuePosition: null, queueLength: null });
  });

  it('keeps the original fields and the input order', async () => {
    db = [row(7, 'en cola', '08:00:00'), row(8, 'en cola', '09:00:00')];
    const out = await queueInfo([
      { id: 8, status: 'en cola', customName: 'B' },
      { id: 7, status: 'en cola', customName: 'A' },
    ]);
    expect(out.map((r) => [r.id, r.customName, r.queuePosition])).toEqual([
      [8, 'B', 2],
      [7, 'A', 1],
    ]);
  });
});
