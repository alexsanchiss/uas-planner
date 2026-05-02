process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn(),
  isAuthError: jest.fn(),
}));

import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../route';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockIsAuthError = isAuthError as jest.MockedFunction<typeof isAuthError>;
const mockTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>;

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/flightPlans/history${query}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

async function json(res: NextResponse) {
  return res.json();
}

const now = Date.now();

const activatedPlan = {
  id: 1, customName: 'Plan Activated', status: 'procesado',
  authorizationStatus: 'aprobado', activationStatus: 'autorizado_despegue',
  activatedAt: new Date(now - 120_000), activationMessage: '{}',
  scheduledAt: new Date(now - 180_000), externalResponseNumber: 'EXT-001',
};

const expiredApprovedPlan = {
  id: 2, customName: 'Plan Expired', status: 'procesado',
  authorizationStatus: 'aprobado', activationStatus: 'ventana_pasada',
  activatedAt: null, activationMessage: null,
  scheduledAt: new Date(now - 120_000), externalResponseNumber: 'EXT-002',
};

const deniedPlan = {
  id: 3, customName: 'Plan Denied', status: 'procesado',
  authorizationStatus: 'denegado', activationStatus: 'no activable',
  activatedAt: null, activationMessage: null,
  scheduledAt: new Date(now - 3600_000), externalResponseNumber: null,
};

const withdrawnPlan = {
  id: 4, customName: 'Plan Withdrawn', status: 'sin procesar',
  authorizationStatus: 'withdrawn', activationStatus: 'no activable',
  activatedAt: null, activationMessage: null,
  scheduledAt: null, externalResponseNumber: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/flightPlans/history', () => {
  describe('authentication', () => {
    it('returns 401 when withAuth returns an error', async () => {
      mockWithAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
      mockIsAuthError.mockReturnValue(true);

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });
  });

  describe('historical plan queries', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns activated plans', async () => {
      mockTransaction.mockResolvedValue([[activatedPlan], 1] as never);

      const res = await GET(makeRequest());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.plans).toHaveLength(1);
      expect(body.plans[0].id).toBe(1);
    });

    it('returns approved plans past their window', async () => {
      mockTransaction.mockResolvedValue([[expiredApprovedPlan], 1] as never);

      const res = await GET(makeRequest());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.plans[0].authorizationStatus).toBe('aprobado');
    });

    it('returns denegado plans', async () => {
      mockTransaction.mockResolvedValue([[deniedPlan], 1] as never);

      const res = await GET(makeRequest());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.plans[0].authorizationStatus).toBe('denegado');
    });

    it('returns withdrawn plans', async () => {
      mockTransaction.mockResolvedValue([[withdrawnPlan], 1] as never);

      const res = await GET(makeRequest());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.plans[0].authorizationStatus).toBe('withdrawn');
    });

    it('returns empty array when no historical plans', async () => {
      mockTransaction.mockResolvedValue([[], 0] as never);

      const res = await GET(makeRequest());
      const body = await json(res);

      expect(res.status).toBe(200);
      expect(body.plans).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      mockWithAuth.mockResolvedValue({ userId: 42 });
      mockIsAuthError.mockReturnValue(false);
    });

    it('returns total count alongside plans', async () => {
      mockTransaction.mockResolvedValue([[activatedPlan], 5] as never);

      const res = await GET(makeRequest());
      const body = await json(res);

      expect(body.total).toBe(5);
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
    });

    it('respects limit and offset query params', async () => {
      mockTransaction.mockResolvedValue([[activatedPlan], 10] as never);

      const res = await GET(makeRequest('?limit=10&offset=5'));
      const body = await json(res);

      expect(body.limit).toBe(10);
      expect(body.offset).toBe(5);
    });

    it('caps limit at 100', async () => {
      mockTransaction.mockResolvedValue([[], 0] as never);

      const res = await GET(makeRequest('?limit=500'));
      const body = await json(res);

      expect(body.limit).toBe(100);
    });
  });
});
