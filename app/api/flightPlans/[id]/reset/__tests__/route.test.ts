/**
 * POST /api/flightPlans/[id]/reset: a reused plan must not carry the previous flight's activation.
 *
 * Bug: reset left activatedAt (and the other activation columns) untouched, so after re-processing and a
 * new FAS approval the Plan Activation page showed the old activation and kept the button disabled.
 * Real JWT auth; prisma, FAS cancellation and email are faked.
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const mockPlanFindUnique = jest.fn();
const mockPlanUpdate = jest.fn();
const mockCsvDeleteMany = jest.fn();
const mockUserFindUnique = jest.fn();
const mockTransaction = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    flightPlan: {
      findUnique: (...a: unknown[]) => mockPlanFindUnique(...a),
      update: (...a: unknown[]) => mockPlanUpdate(...a),
    },
    csvResult: { deleteMany: (...a: unknown[]) => mockCsvDeleteMany(...a) },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

const mockSendCancellation = jest.fn();
jest.mock('@/lib/fas', () => ({
  sendFasCancellation: (...a: unknown[]) => mockSendCancellation(...a),
}));

const mockSendDeletionEmail = jest.fn();
jest.mock('@/lib/email', () => ({
  sendPlanDeletionEmail: (...a: unknown[]) => mockSendDeletionEmail(...a),
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { CLEARED_ACTIVATION } from '@/lib/activation';
import { POST } from '../route';

const OWNER = 10;

// An approved plan that was already activated and flown
const flownPlan = () => ({
  id: 5,
  userId: OWNER,
  customName: 'Reused plan',
  status: 'procesado',
  csvResult: 1,
  fileContent: '{"plan":true}',
  authorizationStatus: 'aprobado',
  externalResponseNumber: 'EXT-1',
  uplan: null,
});

async function reset(userId: number | null = OWNER, id = '5') {
  const headers: Record<string, string> = {};
  if (userId !== null) headers.Authorization = `Bearer ${generateToken(userId)}`;
  return POST(new NextRequest(`http://localhost/api/flightPlans/${id}/reset`, { method: 'POST', headers }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockPlanFindUnique.mockResolvedValue(flownPlan());
  mockUserFindUnique.mockResolvedValue({ email: 'owner@example.com' });
  mockSendCancellation.mockResolvedValue(undefined);
  mockSendDeletionEmail.mockResolvedValue(undefined);
  mockCsvDeleteMany.mockReturnValue('csv-op');
  mockPlanUpdate.mockImplementation((args: unknown) => ({ op: 'plan-update', args }));
  mockTransaction.mockImplementation(async () => [{ count: 1 }, { id: 5 }]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('activation of the previous flight', () => {
  it('is cleared: the reset update writes every activation column back to its schema default', async () => {
    const res = await reset();

    expect(res.status).toBe(200);
    expect(mockPlanUpdate).toHaveBeenCalledTimes(1);
    const { where, data } = mockPlanUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: 5 });

    // every key of the shared constant is written...
    for (const [key, value] of Object.entries(CLEARED_ACTIVATION)) {
      expect(data).toHaveProperty(key, value);
    }
    // ...and the constant itself is pinned to the schema defaults (fails if it is emptied or drifts)
    expect(Object.keys(CLEARED_ACTIVATION).sort()).toEqual(
      ['activatedAt', 'activationMessage', 'activationStatus', 'lastActivationAttempt', 'termsAcceptedAt'],
    );
    expect(data.activationStatus).toBe('no activable');
    expect(data.activatedAt).toBeNull();
    expect(data.activationMessage).toBeNull();
    expect(data.termsAcceptedAt).toBeNull();
    expect(data.lastActivationAttempt).toBeNull();
  });

  it('is cleared in the same update that drops the authorization, atomically with the CSV delete', async () => {
    await reset();

    const { data } = mockPlanUpdate.mock.calls[0][0];
    expect(data).toMatchObject({
      status: 'sin procesar',
      authorizationStatus: 'sin autorización',
      externalResponseNumber: null,
      activatedAt: null,
    });
    expect(mockTransaction).toHaveBeenCalledWith(['csv-op', expect.objectContaining({ op: 'plan-update' })]);
  });

  it('still cancels the approved plan in FAS and emails the owner', async () => {
    await reset();

    expect(mockSendCancellation).toHaveBeenCalledWith('EXT-1');
    expect(mockSendDeletionEmail).toHaveBeenCalledWith('owner@example.com', 'Reused plan');
  });
});

describe('guards (unchanged)', () => {
  it('401 without a token, 400 for a bad id: nothing is written', async () => {
    expect((await reset(null)).status).toBe(401);
    expect((await reset(OWNER, 'abc')).status).toBe(400);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });

  it('404 for a missing plan', async () => {
    mockPlanFindUnique.mockResolvedValue(null);

    expect((await reset()).status).toBe(404);
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });

  it('403 for a foreign plan', async () => {
    mockPlanFindUnique.mockResolvedValue({ ...flownPlan(), userId: 99 });

    expect((await reset()).status).toBe(403);
    expect(mockPlanUpdate).not.toHaveBeenCalled();
    expect(mockSendCancellation).not.toHaveBeenCalled();
  });

  it('400 for an externally uploaded plan (no fileContent) and for an already unprocessed one', async () => {
    mockPlanFindUnique.mockResolvedValue({ ...flownPlan(), fileContent: null });
    expect((await reset()).status).toBe(400);

    mockPlanFindUnique.mockResolvedValue({ ...flownPlan(), status: 'sin procesar' });
    const res = await reset();
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('ALREADY_UNPROCESSED');

    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });
});
