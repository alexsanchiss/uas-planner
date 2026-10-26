/**
 * POST /api/contact rate limit (SEC-10): 5 valid tickets per user per hour, each one sends two
 * emails. Over the limit: 429 + Retry-After and no emails. Invalid submissions are not counted.
 */

const mockFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}));

const mockWithAuth = jest.fn();
jest.mock('@/lib/auth-middleware', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
  isAuthError: (value: unknown) => value instanceof Response,
}));

const mockTicketEmail = jest.fn().mockResolvedValue(undefined);
const mockNotifyEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/email', () => ({
  sendContactTicketEmail: (...args: unknown[]) => mockTicketEmail(...args),
  sendContactNotificationEmail: (...args: unknown[]) => mockNotifyEmail(...args),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import { NextRequest } from 'next/server';
import { POST } from '../route';

const valid = { subject: 'Cannot upload plan', category: 'Bug Report', description: 'The upload button does nothing.' };
let userCounter = 1000;

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithAuth.mockResolvedValue({ userId: ++userCounter });
  mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
});

describe('POST /api/contact rate limit', () => {
  it('allows 5 tickets per hour, then 429 with Retry-After and sends no more emails', async () => {
    for (let i = 0; i < 5; i++) expect((await post(valid)).status).toBe(200);
    expect(mockNotifyEmail).toHaveBeenCalledTimes(5);

    const blocked = await post(valid);

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Too many support tickets. Please try again later.' });
    const retryAfter = Number(blocked.headers.get('Retry-After'));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(3590);
    expect(retryAfter).toBeLessThanOrEqual(3600);
    expect(mockNotifyEmail).toHaveBeenCalledTimes(5);
    expect(mockTicketEmail).toHaveBeenCalledTimes(5);
  });

  it('is per user: another user is not blocked', async () => {
    for (let i = 0; i < 6; i++) await post(valid);
    expect((await post(valid)).status).toBe(429);

    mockWithAuth.mockResolvedValue({ userId: ++userCounter });

    expect((await post(valid)).status).toBe(200);
  });

  it('does not count invalid submissions against the budget', async () => {
    for (let i = 0; i < 10; i++) expect((await post({ ...valid, subject: '' })).status).toBe(400);

    for (let i = 0; i < 5; i++) expect((await post(valid)).status).toBe(200);
  });
});
