process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';
process.env.FAS_API_URL = 'http://fas-test.local/uplan';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn(),
  isAuthError: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockIsAuthError = isAuthError as jest.MockedFunction<typeof isAuthError>;
const mockFindUnique = prisma.flightPlan.findUnique as jest.MockedFunction<typeof prisma.flightPlan.findUnique>;
const mockUpdate = prisma.flightPlan.update as jest.MockedFunction<typeof prisma.flightPlan.update>;

function makeRequest(body: unknown = { termsAccepted: true }): NextRequest {
  return new NextRequest('http://localhost/api/flightPlans/1/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
  });
}

function makeParams(id = '1') {
  return { params: Promise.resolve({ id }) };
}

async function json(res: NextResponse) {
  return res.json();
}

const now = Date.now();
const basePlan = {
  id: 1,
  userId: 42,
  authorizationStatus: 'aprobado',
  scheduledAt: new Date(now),
  externalResponseNumber: 'EXT-001',
  lastActivationAttempt: null,
  activationStatus: 'activable',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/flightPlans/[id]/activate', () => {
  describe('authentication', () => {
    it('returns 401 when withAuth returns an error response', async () => {
      mockWithAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      mockIsAuthError.mockReturnValue(true);

      const res = await POST(makeRequest(), makeParams());
      expect(res.status).toBe(401);
    });
  });

  describe('body validation', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 400 when termsAccepted is false', async () => {
      const res = await POST(makeRequest({ termsAccepted: false }), makeParams());
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error).toBe('Debe aceptar los términos');
    });

    it('returns 400 when termsAccepted is missing', async () => {
      const res = await POST(makeRequest({}), makeParams());
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error).toBe('Debe aceptar los términos');
    });
  });

  describe('flight plan checks', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 404 when plan does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);
      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(404);
      expect(body.error).toBe('Plan de vuelo no encontrado');
    });

    it('returns 403 when plan belongs to another user', async () => {
      mockFindUnique.mockResolvedValue({ ...basePlan, userId: 99 } as never);
      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(403);
      expect(body.error).toBe('Access denied');
    });

    it('returns 400 when plan is not aprobado', async () => {
      mockFindUnique.mockResolvedValue({ ...basePlan, authorizationStatus: 'denegado' } as never);
      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error).toBe('El plan no está aprobado');
    });

    it('returns 400 when externalResponseNumber is null', async () => {
      mockFindUnique.mockResolvedValue({ ...basePlan, externalResponseNumber: null } as never);
      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error).toBe('El plan no tiene número de respuesta externo');
    });
  });

  describe('cooldown check', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 429 when last attempt was less than 5s ago', async () => {
      const recentAttempt = new Date(now - 2000); // 2s ago
      mockFindUnique.mockResolvedValue({ ...basePlan, lastActivationAttempt: recentAttempt } as never);

      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(429);
      expect(body.error).toBe('Cooldown activo');
      expect(body.retryAt).toBeDefined();
    });

    it('allows activation when last attempt was more than 5s ago', async () => {
      const oldAttempt = new Date(now - 10000); // 10s ago
      mockFindUnique.mockResolvedValue({ ...basePlan, lastActivationAttempt: oldAttempt } as never);
      mockUpdate.mockResolvedValue({ ...basePlan } as never);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'authorized' }),
      } as Response);
      mockUpdate.mockResolvedValue({ ...basePlan, activationStatus: 'autorizado_despegue', activatedAt: new Date() } as never);

      const res = await POST(makeRequest(), makeParams());
      expect(res.status).toBe(200);
    });
  });

  describe('window validation', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns 400 when window is not yet open (scheduledAt 5min in future)', async () => {
      const futureScheduledAt = new Date(now + 5 * 60 * 1000); // 5min from now
      mockFindUnique.mockResolvedValue({ ...basePlan, scheduledAt: futureScheduledAt } as never);

      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error).toBe('Ventana no abierta');
    });

    it('returns 400 when window is closed (scheduledAt 5min in past)', async () => {
      const pastScheduledAt = new Date(now - 5 * 60 * 1000); // 5min ago
      mockFindUnique.mockResolvedValue({ ...basePlan, scheduledAt: pastScheduledAt } as never);

      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.error).toBe('Ventana cerrada');
    });
  });

  describe('FAS activation call', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
      mockFindUnique.mockResolvedValue({ ...basePlan } as never);
      // First update call (persist attempt start)
      mockUpdate.mockResolvedValueOnce({ ...basePlan, activationStatus: 'activando' } as never);
    });

    it('returns 200 with activationStatus=autorizado_despegue on FAS success', async () => {
      const fasResponse = { status: 'authorized', message: 'OK' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fasResponse,
      } as Response);

      const activatedPlan = { ...basePlan, activationStatus: 'autorizado_despegue', activatedAt: new Date() };
      mockUpdate.mockResolvedValueOnce(activatedPlan as never);

      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.message).toBe('Activación autorizada');
      expect(body.flightPlan.activationStatus).toBe('autorizado_despegue');
    });

    it('returns 200 with error info and activationStatus=denegado_activacion on FAS failure', async () => {
      mockFetch.mockRejectedValue(new Error('FAS server error'));

      const deniedPlan = { ...basePlan, activationStatus: 'denegado_activacion' };
      mockUpdate.mockResolvedValueOnce(deniedPlan as never);

      const res = await POST(makeRequest(), makeParams());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.error).toBe('Activación denegada');
      expect(body.retryAt).toBeDefined();
    });

    it('sets correct FAS activation URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
      mockUpdate.mockResolvedValueOnce({ ...basePlan } as never);

      await POST(makeRequest(), makeParams());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/activation/EXT-001'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
