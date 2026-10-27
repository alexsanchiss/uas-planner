/**
 * POST /api/machine/flightPlans/[id]/activate (E3 + E4): characterisation.
 *
 * Contract with the unknown machine consumer: +-60 s activation window, 429 cooldown, and HTTP 200
 * with `error` when FAS denies the activation. The FAS request (GET {origin}/activation/{enc(n)})
 * keeps the route's own 10 s AbortController signal; centralising the FAS client must not change it.
 */

process.env.MACHINE_API_KEY = 'machine-test-key';
process.env.FAS_API_URL = 'http://fas-test.local/uplan';

const mockUserFindUnique = jest.fn();
const mockPlanFindUnique = jest.fn();
const mockPlanUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    flightPlan: {
      findUnique: (...a: unknown[]) => mockPlanFindUnique(...a),
      update: (...a: unknown[]) => mockPlanUpdate(...a),
    },
  },
}));

const mockFetch = jest.fn();
const originalFetch = global.fetch;

import { NextRequest } from 'next/server';
import { POST } from '../route';

const basePlan = () => ({
  id: 5,
  userId: 1,
  authorizationStatus: 'aprobado',
  scheduledAt: new Date(Date.now() + 5_000),
  externalResponseNumber: 'EXT/5',
  lastActivationAttempt: null as Date | null,
  activationStatus: 'activable',
});

function post(body: unknown = { email: 'pilot@example.com', termsAccepted: true }, key: string | null = 'machine-test-key') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key !== null) headers['x-machine-api-key'] = key;
  return POST(
    new NextRequest('http://localhost/api/machine/flightPlans/5/activate', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: '5' }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUserFindUnique.mockResolvedValue({ id: 1 });
  mockPlanFindUnique.mockResolvedValue(basePlan());
  mockPlanUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 5, ...data }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('machine activate: status codes and bodies', () => {
  it('401 without a key; 400 for invalid JSON, missing email, terms not accepted', async () => {
    expect((await post(undefined, null)).status).toBe(401);

    let res = await post('{nope');
    expect([res.status, await res.json()]).toEqual([400, { error: 'Invalid JSON body' }]);

    res = await post({ termsAccepted: true });
    expect([res.status, await res.json()]).toEqual([400, { error: 'Missing email in body' }]);

    res = await post({ email: 'pilot@example.com', termsAccepted: 'yes' });
    expect([res.status, await res.json()]).toEqual([400, { error: 'Debe aceptar los términos' }]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('404 user / plan, 403 foreign plan, 400 not approved / no number / no schedule', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    let res = await post();
    expect([res.status, await res.json()]).toEqual([404, { error: 'User not found' }]);

    mockPlanFindUnique.mockResolvedValueOnce(null);
    res = await post();
    expect([res.status, await res.json()]).toEqual([404, { error: 'Plan de vuelo no encontrado' }]);

    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), userId: 99 });
    res = await post();
    expect([res.status, await res.json()]).toEqual([403, { error: 'Access denied' }]);

    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), authorizationStatus: 'denegado' });
    res = await post();
    expect([res.status, await res.json()]).toEqual([400, { error: 'El plan no está aprobado' }]);

    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), externalResponseNumber: null });
    res = await post();
    expect([res.status, await res.json()]).toEqual([400, { error: 'El plan no tiene número de respuesta externo' }]);

    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), scheduledAt: null });
    res = await post();
    expect([res.status, await res.json()]).toEqual([400, { error: 'El plan no tiene hora programada' }]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('429 cooldown within 5 s of the last attempt', async () => {
    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), lastActivationAttempt: new Date(Date.now() - 1000) });

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Cooldown activo');
    expect(typeof body.retryAt).toBe('string');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('the activation window is +-60 s: 400 before it opens and after it closes (machine value, not the user one)', async () => {
    // 2 minutes is inside the USER window (+-300 s) but outside the machine one: pins the value
    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), scheduledAt: new Date(Date.now() + 120_000) });
    let res = await post();
    expect([res.status, (await res.json()).error]).toEqual([400, 'Ventana no abierta']);

    mockPlanFindUnique.mockResolvedValueOnce({ ...basePlan(), scheduledAt: new Date(Date.now() - 120_000) });
    res = await post();
    expect([res.status, (await res.json()).error]).toEqual([400, 'Ventana cerrada']);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('machine activate: FAS request and response handling', () => {
  it("asks FAS exactly GET {origin}/activation/{enc(n)} with the route's own abort signal", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Activación autorizada');
    expect(body.flightPlan).toMatchObject({ activationStatus: 'autorizado_despegue', activationMessage: '{"status":"ok"}' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://fas-test.local/activation/EXT%2F5');
    expect(init.method).toBe('GET');
    expect(Object.keys(init).sort()).toEqual(['method', 'signal']);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // activation is marked in progress before FAS is called
    expect(mockPlanUpdate.mock.calls[0][0].data).toMatchObject({ activationStatus: 'activando' });
  });

  it('HTTP 200 with error "Activación denegada" when FAS answers non-2xx (the client reads the body)', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ reason: 'no' }), { status: 403 }));

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBe('Activación denegada');
    expect(body.message).toBe('FAS returned 403: {"reason":"no"}');
    expect(body.flightPlan).toMatchObject({ activationStatus: 'denegado_activacion', activationMessage: '{"reason":"no"}' });
    expect(typeof body.retryAt).toBe('string');
  });

  it('HTTP 200 "Activación denegada" on a network error', async () => {
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ error: 'Activación denegada', message: 'connect ECONNREFUSED' });
    expect(body.flightPlan).toMatchObject({ activationStatus: 'denegado_activacion' });
  });
});
