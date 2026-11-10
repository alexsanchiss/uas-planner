/**
 * PUT /api/flightPlans/simulation: airframe + wind for a set of the caller's plans.
 * 401 without JWT, 400 on a bad body, 404 when any id is not the caller's (no IDOR, no leak of which one),
 * 409 for plans that cannot change (queued / processing / processed, or authorization approved / pending),
 * 200 { updated }. The write repeats the state guard in its WHERE (race between check and write).
 * Real JWT auth; prisma is faked over an in-memory table.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

type Plan = { id: number; userId: number; status: string; authorizationStatus: string };
let table: Plan[] = [];
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { PUT } from '../route';

const OWNER = 10;
const STRANGER = 20;

function call(body: unknown, userId: number | null = OWNER, raw?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return PUT(
    new NextRequest('http://localhost/api/flightPlans/simulation', {
      method: 'PUT',
      headers,
      body: raw ?? JSON.stringify(body),
    }),
  );
}

const valid = { ids: [1], airframe: 'multirotor', wind: null };
const plan = (id: number, status = 'sin procesar', authorizationStatus = 'sin autorización', userId = OWNER): Plan => ({
  id,
  userId,
  status,
  authorizationStatus,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  table = [plan(1), plan(2), plan(3)];
  mockFindMany.mockImplementation(async ({ where }: { where: { id: { in: number[] }; userId: number } }) =>
    table.filter((p) => where.id.in.includes(p.id) && p.userId === where.userId),
  );
  mockUpdateMany.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) => ({
    count: where.id.in.length,
  }));
});

describe('auth and body validation', () => {
  it('401 without a token, nothing read or written', async () => {
    const res = await call(valid, null);
    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('400 on invalid JSON', async () => {
    const res = await call(undefined, OWNER, '{not json');
    expect(res.status).toBe(400);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ['null body', null],
    ['no ids', { airframe: 'multirotor', wind: null }],
    ['empty ids', { ...valid, ids: [] }],
    ['duplicate ids', { ...valid, ids: [1, 1] }],
    ['non-integer id', { ...valid, ids: [1.5] }],
    ['zero id', { ...valid, ids: [0] }],
    ['negative id', { ...valid, ids: [-1] }],
    ['string id', { ...valid, ids: ['1'] }],
    ['more than 1000 ids', { ...valid, ids: Array.from({ length: 1001 }, (_, i) => i + 1) }],
    ['unknown airframe', { ...valid, airframe: 'helicopter' }],
    ['missing airframe', { ids: [1], wind: null }],
    ['missing wind (must be explicit null)', { ids: [1], airframe: 'multirotor' }],
    ['wind speed above 30', { ...valid, wind: { speed: 30.1, direction: 0 } }],
    ['negative wind speed', { ...valid, wind: { speed: -1, direction: 0 } }],
    ['direction above 360', { ...valid, wind: { speed: 5, direction: 360.5 } }],
    ['negative direction', { ...valid, wind: { speed: 5, direction: -1 } }],
    ['gust below speed', { ...valid, wind: { speed: 8, direction: 0, gust: 7.9 } }],
    ['gust above 40', { ...valid, wind: { speed: 8, direction: 0, gust: 40.1 } }],
    ['string speed', { ...valid, wind: { speed: '8', direction: 0 } }],
    ['wind without direction', { ...valid, wind: { speed: 8 } }],
  ])('400 for %s, nothing read or written', async (_name, body) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('accepts the boundaries: 1000 ids, speed 30, gust 40, gust = speed, direction 0 and 360', async () => {
    const many = Array.from({ length: 1000 }, (_, i) => i + 1);
    table = many.map((id) => plan(id));
    expect((await call({ ...valid, ids: many })).status).toBe(200);
    expect((await call({ ...valid, wind: { speed: 30, direction: 360, gust: 40 } })).status).toBe(200);
    expect((await call({ ...valid, wind: { speed: 8, direction: 0, gust: 8 } })).status).toBe(200);
  });
});

describe('ownership', () => {
  it('looks the plans up scoped to the caller', async () => {
    await call({ ...valid, ids: [1, 2] });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1, 2] }, userId: OWNER } }),
    );
  });

  it("404 when an id belongs to someone else, and nothing is written (not even the caller's own plans)", async () => {
    table = [plan(1), plan(2, 'sin procesar', 'sin autorización', STRANGER)];
    const res = await call({ ...valid, ids: [1, 2] });
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('404 for ids that do not exist', async () => {
    const res = await call({ ...valid, ids: [1, 999] });
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('a stranger cannot touch the caller\'s plans: same 404 as a missing plan', async () => {
    const res = await call(valid, STRANGER);
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('the write is scoped to the caller too', async () => {
    await call(valid);
    expect(mockUpdateMany.mock.calls[0][0].where.userId).toBe(OWNER);
  });
});

describe('locked plans (409)', () => {
  it.each(['en cola', 'procesando', 'procesado'])('409 for status %s, listing the blocked ids; nothing written', async (status) => {
    table = [plan(1), plan(2, status), plan(3)];
    const res = await call({ ...valid, ids: [1, 2, 3] });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ids).toEqual([2]);
    expect(typeof body.error).toBe('string');
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it.each(['aprobado', 'pendiente'])('409 for authorization %s even when the status is editable', async (auth) => {
    table = [plan(1, 'sin procesar', auth), plan(2, 'error', auth)];
    const res = await call({ ...valid, ids: [1, 2] });
    expect(res.status).toBe(409);
    expect((await res.json()).ids).toEqual([1, 2]);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['sin procesar', 'sin autorización'],
    ['error', 'sin autorización'],
    ['sin procesar', 'denegado'],
    ['error', 'withdrawn'],
  ])('allows status %s with authorization %s', async (status, auth) => {
    table = [plan(1, status, auth)];
    expect((await call(valid)).status).toBe(200);
  });

  it('the write repeats the state guard in its WHERE (a plan queued after the check is left untouched)', async () => {
    await call({ ...valid, ids: [1, 2] });
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany.mock.calls[0][0].where).toEqual({
      id: { in: [1, 2] },
      userId: OWNER,
      status: { in: ['sin procesar', 'error'] },
      authorizationStatus: { notIn: ['aprobado', 'pendiente'] },
    });
  });

  it('409 when the write touched fewer plans than asked (state changed in between)', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const res = await call({ ...valid, ids: [1, 2] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/changed state/i);
  });
});

describe('200 and what is written', () => {
  it('stores airframe and wind', async () => {
    const res = await call({ ids: [1, 2], airframe: 'fixedwing', wind: { speed: 8.5, direction: 270, gust: 12 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 2 });
    expect(mockUpdateMany.mock.calls[0][0].data).toEqual({
      simAirframe: 'fixedwing',
      windSpeed: 8.5,
      windDirection: 270,
      windGust: 12,
    });
  });

  it('wind null clears all three wind columns (and still sets the airframe)', async () => {
    await call({ ids: [1], airframe: 'fixedwing', wind: null });
    expect(mockUpdateMany.mock.calls[0][0].data).toEqual({
      simAirframe: 'fixedwing',
      windSpeed: null,
      windDirection: null,
      windGust: null,
    });
  });

  it('direction 360 is stored as 0; other directions are kept', async () => {
    await call({ ...valid, wind: { speed: 5, direction: 360 } });
    expect(mockUpdateMany.mock.calls[0][0].data.windDirection).toBe(0);
    await call({ ...valid, wind: { speed: 5, direction: 359.5 } });
    expect(mockUpdateMany.mock.calls[1][0].data.windDirection).toBe(359.5);
    await call({ ...valid, wind: { speed: 5, direction: 0 } });
    expect(mockUpdateMany.mock.calls[2][0].data.windDirection).toBe(0);
  });

  it('gust omitted or null -> windGust null (constant wind)', async () => {
    await call({ ...valid, wind: { speed: 5, direction: 90 } });
    expect(mockUpdateMany.mock.calls[0][0].data.windGust).toBeNull();
    await call({ ...valid, wind: { speed: 5, direction: 90, gust: null } });
    expect(mockUpdateMany.mock.calls[1][0].data.windGust).toBeNull();
  });

  it('never writes the runner-owned columns or the status', async () => {
    await call({ ...valid, wind: { speed: 5, direction: 90, gust: 9 } });
    const keys = Object.keys(mockUpdateMany.mock.calls[0][0].data).sort();
    expect(keys).toEqual(['simAirframe', 'windDirection', 'windGust', 'windSpeed']);
  });
});

describe('failures', () => {
  it('500 when prisma throws on the read', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'));
    expect((await call(valid)).status).toBe(500);
  });

  it('500 when prisma throws on the write', async () => {
    mockUpdateMany.mockRejectedValue(new Error('db down'));
    expect((await call(valid)).status).toBe(500);
  });
});
