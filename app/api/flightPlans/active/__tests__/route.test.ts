/**
 * Tests for GET /api/flightPlans/active
 */

import { NextRequest } from 'next/server';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
const mockWithAuth = jest.fn();
const mockIsAuthError = jest.fn();

jest.mock('@/lib/auth-middleware', () => ({
  withAuth:    (...args: unknown[]) => mockWithAuth(...args),
  isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}));

// Import after mocks are registered
import { GET } from '../route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/flightPlans/active', {
    method: 'GET',
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/flightPlans/active', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. No auth → 401 ──────────────────────────────────────────────────────────
  it('returns 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
    mockWithAuth.mockResolvedValue(errorResponse);
    mockIsAuthError.mockReturnValue(true);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
  });

  // 2. Returns only aprobado plans within window ──────────────────────────────
  it('returns only aprobado plans within the activation window', async () => {
    mockWithAuth.mockResolvedValue({ userId: 1 });
    mockIsAuthError.mockReturnValue(false);

    const now = new Date();
    const inWindowPlan = {
      id: 1,
      customName: 'Plan A',
      status: 'procesado',
      authorizationStatus: 'aprobado',
      scheduledAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // now + 2h (inside window)
      activationStatus: 'activable',
      activatedAt: null,
      activationMessage: null,
      termsAcceptedAt: null,
      externalResponseNumber: 'EXT-001',
      uplan: null,
      fileContent: null,
    };

    mockFindMany.mockResolvedValue([inWindowPlan]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('plans');
    expect(body.plans).toHaveLength(1);
    expect(body.plans[0].id).toBe(1);
    expect(body.plans[0].authorizationStatus).toBe('aprobado');

    // Verify Prisma was called with the right filters
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.authorizationStatus).toBe('aprobado');
    expect(call.where.scheduledAt).toBeDefined();
    expect(call.where.scheduledAt.not).toBeNull();
    expect(call.where.scheduledAt.gte).toBeInstanceOf(Date);
    expect(call.where.scheduledAt.lte).toBeInstanceOf(Date);
    expect(call.orderBy).toEqual({ scheduledAt: 'asc' });
  });

  // 3. Excludes plans outside window ─────────────────────────────────────────
  it('queries with correct window boundaries (excludes outside plans)', async () => {
    mockWithAuth.mockResolvedValue({ userId: 1 });
    mockIsAuthError.mockReturnValue(false);
    mockFindMany.mockResolvedValue([]);

    const beforeCall = Date.now();
    await GET(makeRequest());
    const afterCall = Date.now();

    const call = mockFindMany.mock.calls[0][0];
    const gte = call.where.scheduledAt.gte as Date;
    const lte = call.where.scheduledAt.lte as Date;

    // Window start should be ~1h before now
    const expectedWindowStartMin = beforeCall - 60 * 60 * 1000 - 100; // small tolerance
    const expectedWindowStartMax = afterCall  - 60 * 60 * 1000 + 100;
    expect(gte.getTime()).toBeGreaterThanOrEqual(expectedWindowStartMin);
    expect(gte.getTime()).toBeLessThanOrEqual(expectedWindowStartMax);

    // Window end should be ~24h after now
    const expectedWindowEndMin = beforeCall + 24 * 60 * 60 * 1000 - 100;
    const expectedWindowEndMax = afterCall  + 24 * 60 * 60 * 1000 + 100;
    expect(lte.getTime()).toBeGreaterThanOrEqual(expectedWindowEndMin);
    expect(lte.getTime()).toBeLessThanOrEqual(expectedWindowEndMax);
  });

  // 4. Returns empty array when no plans match ────────────────────────────────
  it('returns an empty plans array when no plans match', async () => {
    mockWithAuth.mockResolvedValue({ userId: 1 });
    mockIsAuthError.mockReturnValue(false);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ plans: [] });
  });

  // 5. 500 on unexpected DB error ────────────────────────────────────────────
  it('returns 500 on unexpected database error', async () => {
    mockWithAuth.mockResolvedValue({ userId: 1 });
    mockIsAuthError.mockReturnValue(false);
    mockFindMany.mockRejectedValue(new Error('DB connection lost'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});
