/**
 * POST /api/contact - request validation (zod 4 `error` option on z.enum) and happy path.
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
  mockWithAuth.mockResolvedValue({ userId: 42 });
  mockFindUnique.mockResolvedValue({ email: 'user@example.com' });
});

describe('POST /api/contact', () => {
  it('creates a ticket and sends both emails for a valid body', async () => {
    const res = await post(valid);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ticketNumber).toMatch(/^UPPS-\d{8}-[0-9A-F]{4}$/);
    expect(mockTicketEmail).toHaveBeenCalledWith('user@example.com', body.ticketNumber, valid.subject, valid.category);
    expect(mockNotifyEmail).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unknown category', { ...valid, category: 'Other' }],
    ['wrong-case category', { ...valid, category: 'bug report' }],
    ['missing category', { subject: valid.subject, description: valid.description }],
    ['null category', { ...valid, category: null }],
  ])('returns the custom "Invalid category" message for %s', async (_label, payload) => {
    const res = await post(payload);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Validation failed', message: 'Invalid category' });
    expect(mockTicketEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['empty subject', { ...valid, subject: '' }, 'Subject is required'],
    ['subject over 200 chars', { ...valid, subject: 's'.repeat(201) }, 'Subject too long'],
    ['short description', { ...valid, description: 'too short' }, 'Description must be at least 10 characters'],
    ['description over 5000 chars', { ...valid, description: 'd'.repeat(5001) }, 'Description too long'],
  ])('returns the custom message for %s', async (_label, payload, message) => {
    const res = await post(payload);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Validation failed', message });
  });

  it('returns 400 with a generic non-empty message when fields are missing entirely', async () => {
    const res = await post({});
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });

  it('does not run validation or emails when authentication fails', async () => {
    mockWithAuth.mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

    const res = await post(valid);

    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
