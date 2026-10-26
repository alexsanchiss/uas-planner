/**
 * POST /api/flightPlans/[id]/uplan: the outbound FAS submission (E4).
 *
 * Pins what must stay byte-compatible with FAS: POST to FAS_API_URL (same default), body = the
 * U-Plan JSON, `Content-Type: application/json`, no auth header; the response (string or JSON) is
 * stored as externalResponseNumber; 400 -> withdrawn, other 4xx -> denegado with FAS's status;
 * 500 -> retry. The only addition is the 30 s axios timeout, whose expiry is a network error
 * (503, nothing persisted) like any other. Real JWT auth; axios and prisma are faked.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const mockPlanFindUnique = jest.fn();
const mockPlanUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: (...a: unknown[]) => mockPlanFindUnique(...a),
      update: (...a: unknown[]) => mockPlanUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    csvResult: { findUnique: jest.fn() },
  },
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...a: unknown[]) => mockAxiosPost(...a),
    isAxiosError: (e: unknown) => typeof e === 'object' && e !== null && (e as { isAxiosError?: boolean }).isAxiosError === true,
  },
}));

// The external-U-Plan path under test never generates from a CSV; skip geodesy (ESM) entirely
jest.mock('@/lib/uplan/tray_to_uplan', () => ({ trayToUplan: jest.fn() }));

const mockSendResultEmail = jest.fn();
jest.mock('@/lib/email', () => ({
  sendAuthorizationResultEmail: (...a: unknown[]) => mockSendResultEmail(...a),
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';

const OWNER = 10;
const ORIGINAL_FAS_API_URL = process.env.FAS_API_URL;

const storedUplan = { operationVolumes: [{ timeBegin: '2030-01-01T10:00:00Z' }], state: 'processing', flightDetails: { a: 1 } };

const plan = () => ({
  id: 5,
  userId: OWNER,
  customName: 'External plan',
  scheduledAt: new Date('2030-01-01T10:00:00Z'),
  csvResult: 0,
  uplan: JSON.stringify(storedUplan),
});

// The route is re-imported for every call so FAS_API_URL is read from the env of THAT test, whether
// the implementation reads it at import time (old per-route copy) or per call (lib/fas.ts).
async function submit(userId: number | null = OWNER) {
  jest.resetModules();
  const { POST } = await import('../route');
  const headers: Record<string, string> = {};
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return POST(new NextRequest('http://localhost/api/flightPlans/5/uplan', { method: 'POST', headers }), {
    params: Promise.resolve({ id: '5' }),
  });
}

function axiosError(status: number | null, data?: unknown, message = 'Request failed') {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: status === null ? undefined : { status, data },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FAS_API_URL;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockPlanFindUnique.mockResolvedValue(plan());
  mockPlanUpdate.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue({ email: 'owner@example.com' });
  mockSendResultEmail.mockResolvedValue(undefined);
  mockAxiosPost.mockResolvedValue({ data: 'EXT-12345' });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  if (ORIGINAL_FAS_API_URL === undefined) delete process.env.FAS_API_URL;
  else process.env.FAS_API_URL = ORIGINAL_FAS_API_URL;
});

describe('FAS request', () => {
  it('posts to the historical default URL when FAS_API_URL is unset', async () => {
    await submit();

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    expect(mockAxiosPost.mock.calls[0][0]).toBe('http://158.42.167.56:8000/uplan');
  });

  it('posts to FAS_API_URL when set', async () => {
    process.env.FAS_API_URL = 'http://fas-test.local:9000/uplan';

    await submit();

    expect(mockAxiosPost.mock.calls[0][0]).toBe('http://fas-test.local:9000/uplan');
  });

  it('sends the U-Plan JSON as body with Content-Type application/json and no other header', async () => {
    await submit();

    const [, body, config] = mockAxiosPost.mock.calls[0];
    expect(body).toMatchObject({ operationVolumes: storedUplan.operationVolumes, state: 'processing', flightDetails: { a: 1 } });
    expect(Number.isNaN(Date.parse(body.creationTime))).toBe(false);
    expect(body.updateTime).toBe(body.creationTime);
    expect(config.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('adds only a 30 s timeout to the request config', async () => {
    await submit();

    const config = mockAxiosPost.mock.calls[0][2];
    expect(Object.keys(config).sort()).toEqual(['headers', 'timeout']);
    expect(config.timeout).toBe(30_000);
  });
});

describe('FAS response handling (unchanged)', () => {
  it('stores a string answer verbatim as externalResponseNumber and answers {uplan, authorizationMessage}', async () => {
    const res = await submit();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.authorizationMessage).toBe('EXT-12345');
    expect(body.uplan.operationVolumes).toEqual(storedUplan.operationVolumes);
    expect(mockPlanUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 5 },
      data: { authorizationStatus: 'pendiente', authorizationMessage: 'FAS procesando...', externalResponseNumber: 'EXT-12345' },
    });
  });

  it('stringifies a JSON answer', async () => {
    mockAxiosPost.mockResolvedValue({ data: { id: 77 } });

    const res = await submit();

    expect((await res.json()).authorizationMessage).toBe('{"id":77}');
    expect(mockPlanUpdate.mock.calls[0][0].data.externalResponseNumber).toBe('{"id":77}');
  });

  it('FAS 400 -> plan withdrawn, FAS body and status passed through, owner emailed', async () => {
    mockAxiosPost.mockRejectedValue(axiosError(400, { detail: 'outside service area' }, 'Request failed with status code 400'));

    const res = await submit();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'withdrawn', message: { detail: 'outside service area' } });
    expect(mockPlanUpdate.mock.calls[0][0].data).toMatchObject({
      authorizationStatus: 'withdrawn',
      authorizationMessage: '{"detail":"outside service area"}',
      externalResponseNumber: 'error: Request failed with status code 400',
    });
    expect(mockSendResultEmail).toHaveBeenCalledWith('owner@example.com', 'External plan', 'withdrawn', expect.any(String), expect.any(String));
  });

  it('other FAS 4xx -> plan denegado with the same status, no email', async () => {
    mockAxiosPost.mockRejectedValue(axiosError(422, 'bad shape'));

    const res = await submit();

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'denegado', message: 'bad shape' });
    expect(mockPlanUpdate.mock.calls[0][0].data).toMatchObject({ authorizationStatus: 'denegado', authorizationMessage: 'bad shape' });
    expect(mockSendResultEmail).not.toHaveBeenCalled();
  });

  it('FAS 500 is retried after a back-off and then succeeds', async () => {
    jest.useFakeTimers();
    mockAxiosPost.mockRejectedValueOnce(axiosError(500, 'oops')).mockResolvedValueOnce({ data: 'EXT-2' });

    let done = false;
    const pending = submit().then((r) => {
      done = true;
      return r;
    });
    for (let i = 0; i < 10 && !done; i++) await jest.advanceTimersByTimeAsync(1000);
    const res = await pending;

    expect(res.status).toBe(200);
    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    expect(mockPlanUpdate.mock.calls[0][0].data.externalResponseNumber).toBe('EXT-2');
  });

  it('a timeout / network error (no HTTP response) is 503, persists nothing and lets the user retry', async () => {
    mockAxiosPost.mockRejectedValue(axiosError(null, undefined, 'timeout of 30000ms exceeded'));

    const res = await submit();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'FAS communication error. Please try again later.',
      message: 'timeout of 30000ms exceeded',
    });
    expect(mockPlanUpdate).not.toHaveBeenCalled();
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });
});

describe('guards (unchanged)', () => {
  it('401 without a token, 403 for a foreign plan, 400 without schedule: FAS is never called', async () => {
    expect((await submit(null)).status).toBe(401);

    mockPlanFindUnique.mockResolvedValue({ ...plan(), userId: 99 });
    expect((await submit()).status).toBe(403);

    mockPlanFindUnique.mockResolvedValue({ ...plan(), scheduledAt: null });
    expect((await submit()).status).toBe(400);

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});
