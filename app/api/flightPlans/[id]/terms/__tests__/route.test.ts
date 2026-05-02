/**
 * Unit tests for GET /api/flightPlans/[id]/terms
 *
 * Covers:
 * 1. 401 - no auth / invalid token
 * 2. 404 - flight plan not found
 * 3. 403 - wrong owner
 * 4. 400 - plan not approved
 * 5. 400 - no externalResponseNumber
 * 6. 502 - FAS network error
 * 7. 200 - FAS returns terms JSON → forwarded verbatim
 */

// Set env before any imports
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
process.env.FAS_API_URL = 'http://fas-test.local/uplan';

// ---- Mocks ----------------------------------------------------------------

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn(),
  isAuthError: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---- Imports ----------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../route';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

// ---- Helpers ----------------------------------------------------------------

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockIsAuthError = isAuthError as jest.MockedFunction<typeof isAuthError>;
const mockFindUnique = prisma.flightPlan.findUnique as jest.MockedFunction<
  typeof prisma.flightPlan.findUnique
>;

/**
 * Build a minimal NextRequest for GET /api/flightPlans/[id]/terms
 */
function makeRequest(token = 'valid-token'): NextRequest {
  return new NextRequest('http://localhost/api/flightPlans/1/terms', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Build the route params Promise as the App Router provides them
 */
function makeParams(id = '1') {
  return { params: Promise.resolve({ id }) };
}

/**
 * Read the JSON body from a NextResponse
 */
async function json(res: NextResponse) {
  return res.json();
}

// ---- Base flight plan fixture ----------------------------------------------

const basePlan = {
  id: 1,
  userId: 42,
  authorizationStatus: 'aprobado',
  externalResponseNumber: 'EXT-001',
};

// ---- Tests ------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/flightPlans/[id]/terms', () => {
  // ---- 1. 401 — no auth ---------------------------------------------------
  describe('authentication', () => {
    it('returns 401 when withAuth returns an error response', async () => {
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
      mockWithAuth.mockResolvedValue(errorResponse);
      mockIsAuthError.mockReturnValue(true);

      const res = await GET(makeRequest('bad-token'), makeParams());

      expect(res.status).toBe(401);
    });
  });

  // ---- 2. 404 — plan not found -------------------------------------------
  describe('flight plan lookup', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 404 when flight plan does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(404);
      expect(body.error).toBe('Plan de vuelo no encontrado');
    });
  });

  // ---- 3. 403 — wrong owner -----------------------------------------------
  describe('ownership check', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 99 }); // different user
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 403 when the plan belongs to a different user', async () => {
      mockFindUnique.mockResolvedValue({ ...basePlan } as never); // userId: 42

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(403);
      expect(body.error).toBe('Access denied');
    });
  });

  // ---- 4. 400 — plan not approved ----------------------------------------
  describe('authorization status check', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 400 when plan is not aprobado', async () => {
      mockFindUnique.mockResolvedValue({
        ...basePlan,
        authorizationStatus: 'pendiente',
      } as never);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(400);
      expect(body.error).toBe('El plan no está aprobado');
    });

    it('returns 400 when plan has sin autorización status', async () => {
      mockFindUnique.mockResolvedValue({
        ...basePlan,
        authorizationStatus: 'sin autorización',
      } as never);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(400);
      expect(body.error).toBe('El plan no está aprobado');
    });
  });

  // ---- 5. 400 — no externalResponseNumber ---------------------------------
  describe('externalResponseNumber check', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 400 when externalResponseNumber is null', async () => {
      mockFindUnique.mockResolvedValue({
        ...basePlan,
        externalResponseNumber: null,
      } as never);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(400);
      expect(body.error).toBe('El plan no tiene número de respuesta externo');
    });

    it('returns 400 when externalResponseNumber is empty string', async () => {
      mockFindUnique.mockResolvedValue({
        ...basePlan,
        externalResponseNumber: '',
      } as never);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(400);
      expect(body.error).toBe('El plan no tiene número de respuesta externo');
    });
  });

  // ---- 6. 502 — FAS network error -----------------------------------------
  describe('FAS proxy errors', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
      mockFindUnique.mockResolvedValue({ ...basePlan } as never);
    });

    it('returns 502 when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(502);
      expect(body.error).toBe('FAS unavailable');
      expect(body.message).toContain('ECONNREFUSED');
    });

    it('returns 502 when FAS responds with a non-2xx status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(502);
      expect(body.error).toBe('FAS unavailable');
      expect(body.message).toContain('503');
    });
  });

  // ---- 7. 200 — success, FAS terms forwarded verbatim --------------------
  describe('successful proxy', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
      mockFindUnique.mockResolvedValue({ ...basePlan } as never);
    });

    it('returns 200 and forwards FAS JSON response verbatim', async () => {
      const termsPayload = {
        title: 'Terms and Conditions',
        content: 'You agree to fly safely.',
        version: '1.0',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => termsPayload,
      } as Response);

      const res = await GET(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body).toEqual(termsPayload);
    });

    it('calls the correct FAS URL with the encoded externalResponseNumber', async () => {
      const termsPayload = { terms: 'ok' };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => termsPayload,
      } as Response);

      await GET(makeRequest(), makeParams());

      expect(mockFetch).toHaveBeenCalledWith(
        'http://fas-test.local/terms/EXT-001',
        { method: 'GET' }
      );
    });
  });
});
