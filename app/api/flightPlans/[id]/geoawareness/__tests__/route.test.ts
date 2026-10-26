/**
 * /api/flightPlans/[id]/geoawareness GET + POST: authentication, ownership and no internal
 * address leak (SEC-03). Real JWT auth; only prisma is faked.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
process.env.GEOAWARENESS_SERVICE_IP = '10.99.99.99:8123';

const mockFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { flightPlan: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { GET, POST } from '../route';

const OWNER = 10;
const STRANGER = 20;

const plan = {
  id: 5,
  userId: OWNER,
  customName: 'Secret plan name',
  uplan: '{"operationVolumes":[]}',
  geoawarenessData: { uspace_identifier: 'uspace-7', geozones: ['restricted-zone-geometry'] },
};

function call(handler: typeof GET | typeof POST, userId: number | null, id = '5') {
  const headers: Record<string, string> = {};
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return handler(
    new NextRequest(`http://localhost/api/flightPlans/${id}/geoawareness`, { method: handler === GET ? 'GET' : 'POST', headers }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFindUnique.mockResolvedValue(plan);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each([
  ['POST', POST],
  ['GET', GET],
] as const)('%s /api/flightPlans/[id]/geoawareness', (_name, handler) => {
  it('is 401 without a token and never reads the plan', async () => {
    const res = await call(handler, null);

    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('is 401 with a garbage token', async () => {
    const res = await handler(
      new NextRequest('http://localhost/api/flightPlans/5/geoawareness', { headers: { Authorization: 'Bearer garbage' } }),
      { params: Promise.resolve({ id: '5' }) },
    );

    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("is 403 for a non-owner and discloses nothing about the plan", async () => {
    const res = await call(handler, STRANGER);
    const text = await res.text();

    expect(res.status).toBe(403);
    expect(JSON.parse(text)).toEqual({ error: 'Access denied' });
    expect(text).not.toContain('Secret plan name');
    expect(text).not.toContain('uspace-7');
    expect(text).not.toContain('restricted-zone-geometry');
  });

  it('is 404 for an unknown plan and 400 for a malformed id', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await call(handler, OWNER, '999')).status).toBe(404);
    expect((await call(handler, OWNER, 'abc')).status).toBe(400);
  });
});

describe('POST: owner flow', () => {
  it('returns {success, uspaceIdentifier} and no longer leaks the internal service address (wsUrl)', async () => {
    const res = await call(POST, OWNER);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, uspaceIdentifier: 'uspace-7' });
    expect(body).not.toHaveProperty('wsUrl');
    expect(JSON.stringify(body)).not.toContain('10.99.99.99');
    expect(JSON.stringify(body)).not.toContain('ws://');
  });

  it('keeps its validation errors for the owner (no uplan 400, no U-Space data 400)', async () => {
    mockFindUnique.mockResolvedValue({ ...plan, uplan: null });
    expect((await call(POST, OWNER)).status).toBe(400);

    mockFindUnique.mockResolvedValue({ ...plan, geoawarenessData: null });
    expect((await call(POST, OWNER)).status).toBe(400);
  });
});

describe('GET: owner flow', () => {
  it('returns the plan geoawareness data to the owner', async () => {
    const res = await call(GET, OWNER);

    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).toContain('uspace-7');
  });

  it('is 404 when the owner has no geoawareness data', async () => {
    mockFindUnique.mockResolvedValue({ ...plan, geoawarenessData: null });

    expect((await call(GET, OWNER)).status).toBe(404);
  });
});
