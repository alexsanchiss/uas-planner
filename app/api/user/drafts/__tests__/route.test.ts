/**
 * POST /api/user/drafts and PATCH /api/user/drafts/[id] - draftData uses z.record(z.string(), z.unknown())
 * (the zod 4 signature; zod 3 allowed z.record(z.unknown())).
 */

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    uplanDraft: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const mockWithAuth = jest.fn();
jest.mock('@/lib/auth-middleware', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
  isAuthError: (value: unknown) => value instanceof Response,
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { PATCH } from '../[id]/route';

function request(method: string, body: unknown) {
  return new NextRequest('http://localhost/api/user/drafts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const nested = { dataOwnerIdentifier: { sac: 'ESP', sic: 'UPV' }, flightDetails: { waypoints: [[1, 2, 3]] }, empty: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockWithAuth.mockResolvedValue({ userId: 42 });
});

describe('POST /api/user/drafts', () => {
  it('stores an arbitrary nested JSON object untouched', async () => {
    mockCreate.mockResolvedValue({ id: 1, name: 'd' });

    const res = await POST(request('POST', { name: 'd', draftData: nested }));

    expect(res.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data).toEqual({ userId: 42, name: 'd', draftData: nested });
  });

  it('accepts an empty object', async () => {
    mockCreate.mockResolvedValue({ id: 1, name: 'd' });

    expect((await POST(request('POST', { name: 'd', draftData: {} }))).status).toBe(201);
  });

  it.each([
    ['array', []],
    ['null', null],
    ['string', 'x'],
    ['number', 5],
    ['missing', undefined],
  ])('rejects draftData as %s with 400 and fieldErrors.draftData', async (_label, draftData) => {
    const res = await POST(request('POST', { name: 'd', draftData }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details.fieldErrors.draftData).toEqual([expect.any(String)]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an empty name with the custom message', async () => {
    const res = await POST(request('POST', { name: '', draftData: {} }));

    expect(res.status).toBe(400);
    expect((await res.json()).details.fieldErrors.name).toEqual(['Name is required']);
  });
});

describe('PATCH /api/user/drafts/[id]', () => {
  const params = { params: Promise.resolve({ id: '9' }) };

  beforeEach(() => {
    mockFindFirst.mockResolvedValue({ id: 9 });
    mockUpdate.mockResolvedValue({ id: 9, name: 'renamed' });
  });

  it('updates only the provided fields', async () => {
    const res = await PATCH(request('PATCH', { name: 'renamed' }), params);

    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][0].data).toEqual({ name: 'renamed' });
  });

  it('accepts a replacement draftData object', async () => {
    const res = await PATCH(request('PATCH', { draftData: nested }), params);

    expect(res.status).toBe(200);
    expect(mockUpdate.mock.calls[0][0].data).toEqual({ draftData: nested });
  });

  it.each([
    ['array', [1]],
    ['null', null],
  ])('rejects draftData as %s', async (_label, draftData) => {
    const res = await PATCH(request('PATCH', { draftData }), params);

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
