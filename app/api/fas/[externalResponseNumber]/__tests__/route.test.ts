/**
 * PUT /api/fas/[externalResponseNumber]: FAS callback (E1) and its optional source-IP allowlist (SEC-01).
 *
 * Part 1 pins the legacy contract with FAS_CALLBACK_ALLOWED_IPS unset: ACCEPTED -> aprobado,
 * anything else -> denegado, byte-identical statuses/bodies. Part 2 pins the allowlist: the
 * right-most X-Forwarded-For entry (the one the trusted proxy appended) is the source IP, so a
 * spoofed left-most entry must not pass.
 */

const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  },
}));

const mockSendEmail = jest.fn();
jest.mock('@/lib/email', () => ({
  sendAuthorizationResultEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { NextRequest } from 'next/server';
import { PUT } from '../route';

const ORIGINAL_ALLOWLIST = process.env.FAS_CALLBACK_ALLOWED_IPS;

function put(body: unknown, headers: Record<string, string> = {}, number = 'EXT-1') {
  return PUT(
    new NextRequest(`http://localhost/api/fas/${number}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ externalResponseNumber: number }) },
  );
}

const plan = {
  id: 7,
  userId: 3,
  customName: 'My <plan>',
  uplan: JSON.stringify({ state: 'processing', operationVolumes: [] }),
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FAS_CALLBACK_ALLOWED_IPS;
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFindFirst.mockResolvedValue(plan);
  mockUpdate.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue({ email: 'owner@example.com' });
  mockSendEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  if (ORIGINAL_ALLOWLIST === undefined) delete process.env.FAS_CALLBACK_ALLOWED_IPS;
  else process.env.FAS_CALLBACK_ALLOWED_IPS = ORIGINAL_ALLOWLIST;
});

describe('FAS callback with FAS_CALLBACK_ALLOWED_IPS unset (legacy contract)', () => {
  it('ACCEPTED -> aprobado, rewrites uplan.state, emails the owner, answers 200 {success:true}', async () => {
    const res = await put({ state: 'ACCEPTED', message: 'ok' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockFindFirst).toHaveBeenCalledWith({ where: { externalResponseNumber: 'EXT-1' } });
    const data = mockUpdate.mock.calls[0][0].data;
    expect(mockUpdate.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(data.authorizationStatus).toBe('aprobado');
    expect(data.authorizationMessage).toBe('ok');
    expect(JSON.parse(data.uplan)).toEqual({ state: 'ACCEPTED', operationVolumes: [] });
    expect(mockSendEmail).toHaveBeenCalledWith('owner@example.com', 'My <plan>', 'aprobado', 'ok', plan.uplan);
  });

  it.each(['REJECTED', 'DENIED', 'accepted', 'Accepted', 'PENDING', 'anything'])(
    'state %s -> denegado (only the exact string ACCEPTED approves)',
    async (state) => {
      const res = await put({ state });

      expect(res.status).toBe(200);
      expect(mockUpdate.mock.calls[0][0].data.authorizationStatus).toBe('denegado');
    },
  );

  it('serialises an object message to a JSON string and leaves authorizationMessage untouched when absent', async () => {
    await put({ state: 'REJECTED', message: { scr_dispatch: { sent: true } } });
    expect(mockUpdate.mock.calls[0][0].data.authorizationMessage).toBe('{"scr_dispatch":{"sent":true}}');

    mockUpdate.mockClear();
    await put({ state: 'REJECTED' });
    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty('authorizationMessage');
  });

  it('keeps the exact error bodies: invalid JSON 400, missing state 400, unknown number 404', async () => {
    const badJson = await put('{nope');
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toEqual({ error: 'Invalid JSON body' });

    const noState = await put({ message: 'x' });
    expect(noState.status).toBe(400);
    expect(await noState.json()).toEqual({ error: 'Missing required field: state' });

    mockFindFirst.mockResolvedValue(null);
    const missing = await put({ state: 'ACCEPTED' }, {}, 'NOPE');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'FlightPlan not found' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('answers 500 {error:"Internal server error"} when the DB write fails', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'));

    const res = await put({ state: 'ACCEPTED' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });

  it.each([
    ['no IP headers', {}],
    ['a foreign IP', { 'x-forwarded-for': '203.0.113.99' }],
    ['a spoofed chain', { 'x-forwarded-for': '10.0.0.5, 203.0.113.99', 'x-real-ip': '203.0.113.98' }],
  ])('accepts the callback regardless of source IP (%s)', async (_label, headers) => {
    const res = await put({ state: 'ACCEPTED' }, headers);

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it.each(['', '   ', ' , ,'])('an empty/blank allowlist (%j) behaves as unset', async (value) => {
    process.env.FAS_CALLBACK_ALLOWED_IPS = value;

    const res = await put({ state: 'ACCEPTED' }, { 'x-forwarded-for': '203.0.113.99' });

    expect(res.status).toBe(200);
  });
});

describe('FAS callback with FAS_CALLBACK_ALLOWED_IPS set (SEC-01)', () => {
  beforeEach(() => {
    process.env.FAS_CALLBACK_ALLOWED_IPS = '10.0.0.5, 10.0.0.6';
  });

  async function expectForbidden(headers: Record<string, string>) {
    const res = await put({ state: 'ACCEPTED' }, headers);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
    // nothing observable happens for a rejected caller
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  }

  it('rejects a request with no IP headers at all', async () => {
    await expectForbidden({});
  });

  it('rejects an IP that is not on the list', async () => {
    await expectForbidden({ 'x-forwarded-for': '203.0.113.99' });
    await expectForbidden({ 'x-real-ip': '203.0.113.99' });
  });

  it('rejects the left-most-only spoof: an allowed IP followed by the attacker (proxy-appended) IP', async () => {
    await expectForbidden({ 'x-forwarded-for': '10.0.0.5, 203.0.113.99' });
  });

  it('rejects an allowed IP in X-Real-IP when X-Forwarded-For names someone else (XFF wins)', async () => {
    await expectForbidden({ 'x-forwarded-for': '203.0.113.99', 'x-real-ip': '10.0.0.5' });
  });

  it('rejects a near-miss of an allowed IP (no substring/prefix matching)', async () => {
    await expectForbidden({ 'x-forwarded-for': '10.0.0.50' });
    await expectForbidden({ 'x-forwarded-for': '10.0.0.' });
  });

  it('accepts an allowed IP as the right-most entry, even behind spoofed ones, and processes the callback', async () => {
    const res = await put({ state: 'ACCEPTED', message: 'ok' }, { 'x-forwarded-for': '203.0.113.99, 10.0.0.5' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUpdate.mock.calls[0][0].data.authorizationStatus).toBe('aprobado');
  });

  it('accepts every entry of the comma-separated list', async () => {
    expect((await put({ state: 'REJECTED' }, { 'x-forwarded-for': '10.0.0.6' })).status).toBe(200);
  });

  it('falls back to X-Real-IP when there is no X-Forwarded-For', async () => {
    expect((await put({ state: 'ACCEPTED' }, { 'x-real-ip': '10.0.0.5' })).status).toBe(200);
  });

  it('normalises the ::ffff: IPv4-mapped prefix on the request side', async () => {
    expect((await put({ state: 'ACCEPTED' }, { 'x-forwarded-for': '::ffff:10.0.0.5' })).status).toBe(200);
    expect((await put({ state: 'ACCEPTED' }, { 'x-forwarded-for': '::FFFF:10.0.0.5' })).status).toBe(200);
  });

  it('normalises the ::ffff: prefix on the allowlist side too', async () => {
    process.env.FAS_CALLBACK_ALLOWED_IPS = '::ffff:10.0.0.5';

    expect((await put({ state: 'ACCEPTED' }, { 'x-forwarded-for': '10.0.0.5' })).status).toBe(200);
  });

  it('still reports 400/404 only to allowed callers (the IP check runs first)', async () => {
    const res = await put('{nope', { 'x-forwarded-for': '203.0.113.99' });
    expect(res.status).toBe(403);

    const allowed = await put('{nope', { 'x-forwarded-for': '10.0.0.5' });
    expect(allowed.status).toBe(400);
  });
});
