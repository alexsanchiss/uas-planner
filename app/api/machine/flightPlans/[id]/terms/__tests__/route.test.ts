/**
 * GET /api/machine/flightPlans/[id]/terms (E3 + E4): characterisation of the machine terms proxy.
 *
 * Statuses/bodies are the contract with the unknown machine consumer and must be identical before
 * and after the FAS client was centralised; the FAS request (GET {origin}/terms/{enc(n)}) only
 * gained a timeout signal, whose expiry takes the existing 502 "FAS unavailable" path.
 */

process.env.MACHINE_API_KEY = 'machine-test-key';
process.env.FAS_API_URL = 'http://fas-test.local/uplan';

const mockUserFindUnique = jest.fn();
const mockPlanFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    flightPlan: { findUnique: (...a: unknown[]) => mockPlanFindUnique(...a) },
  },
}));

const mockFetch = jest.fn();
const originalFetch = global.fetch;

import { NextRequest } from 'next/server';
import { GET } from '../route';

const plan = { id: 5, userId: 1, authorizationStatus: 'aprobado', externalResponseNumber: 'EXT/5' };

function get(opts: { key?: string | null; query?: string; id?: string } = {}) {
  const { key = 'machine-test-key', query = '?email=pilot%40example.com', id = '5' } = opts;
  const headers: Record<string, string> = {};
  if (key !== null) headers['x-machine-api-key'] = key;
  return GET(new NextRequest(`http://localhost/api/machine/flightPlans/${id}/terms${query}`, { headers }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUserFindUnique.mockResolvedValue({ id: 1 });
  mockPlanFindUnique.mockResolvedValue(plan);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('machine terms: status codes and bodies', () => {
  it('401 without or with a wrong key', async () => {
    expect((await get({ key: null })).status).toBe(401);
    expect((await get({ key: 'nope' })).status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['missing email', { query: '' }, 400, { error: 'Missing email query parameter' }],
    ['bad id', { id: 'abc' }, 400, { error: 'Invalid flight plan ID' }],
  ])('%s', async (_label, opts, status, body) => {
    const res = await get(opts);

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it('404 unknown user, 404 unknown plan, 403 plan of another user', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    let res = await get();
    expect([res.status, await res.json()]).toEqual([404, { error: 'User not found' }]);

    mockPlanFindUnique.mockResolvedValueOnce(null);
    res = await get();
    expect([res.status, await res.json()]).toEqual([404, { error: 'Plan de vuelo no encontrado' }]);

    mockPlanFindUnique.mockResolvedValueOnce({ ...plan, userId: 99 });
    res = await get();
    expect([res.status, await res.json()]).toEqual([403, { error: 'Access denied' }]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('400 when the plan is not approved or has no external number', async () => {
    mockPlanFindUnique.mockResolvedValueOnce({ ...plan, authorizationStatus: 'pendiente' });
    let res = await get();
    expect([res.status, await res.json()]).toEqual([400, { error: 'El plan no está aprobado' }]);

    mockPlanFindUnique.mockResolvedValueOnce({ ...plan, externalResponseNumber: null });
    res = await get();
    expect([res.status, await res.json()]).toEqual([400, { error: 'El plan no tiene número de respuesta externo' }]);
  });
});

describe('machine terms: FAS request and response handling', () => {
  it('asks FAS exactly GET {origin}/terms/{enc(n)} (only a signal added) and forwards the JSON verbatim', async () => {
    const terms = { terms: ['a', 'b'], nested: { n: 1 } };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(terms), { status: 200 }));

    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(terms);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://fas-test.local/terms/EXT%2F5');
    expect(init.method).toBe('GET');
    expect(Object.keys(init).sort()).toEqual(['method', 'signal']);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('502 {error:"FAS unavailable", message} on a network error', async () => {
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const res = await get();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'FAS unavailable', message: 'connect ECONNREFUSED' });
  });

  it('takes the same 502 path when the timeout signal fires', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));

    const res = await get();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'FAS unavailable', message: 'The operation was aborted due to timeout' });
  });

  it('502 with the FAS status when FAS answers non-2xx', async () => {
    mockFetch.mockResolvedValue(new Response('boom', { status: 503, statusText: 'Service Unavailable' }));

    const res = await get();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'FAS unavailable', message: 'FAS returned 503 Service Unavailable' });
  });
});
