/**
 * forgot-password / reset-password hash the reset token with HMAC(JWT_SECRET). Before F4 a missing
 * JWT_SECRET silently meant HMAC with an EMPTY key (a publicly known key). Now the routes must fail
 * (500) and must not store or look up a token hashed with an empty key.
 */

const mockUserFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockUserUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));
const mockSendReset = jest.fn();
jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: (...a: unknown[]) => mockSendReset(...a),
}));

import crypto from 'crypto';
import { POST as forgot } from '../forgot-password/route';
import { POST as reset } from '../reset-password/route';

const ORIGINAL_SECRET = process.env.JWT_SECRET;
let ipCounter = 0;

function post(handler: typeof forgot, body: unknown) {
  return handler(
    new Request('http://localhost/api/auth/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `203.0.113.${++ipCounter}` },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUserFindUnique.mockResolvedValue({ id: 1, email: 'u@example.com' });
  mockUserFindFirst.mockResolvedValue({ id: 1 });
  mockUserUpdate.mockResolvedValue({});
  mockSendReset.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;
});

describe('without JWT_SECRET', () => {
  beforeEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('forgot-password fails with 500, stores nothing and sends no email', async () => {
    const res = await post(forgot, { email: 'u@example.com' });

    expect(res.status).toBe(500);
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSendReset).not.toHaveBeenCalled();
  });

  it('reset-password fails with 500 and never looks up a token hashed with an empty key', async () => {
    const res = await post(reset, { token: 'a'.repeat(64), newPassword: 'Str0ng-passw0rd!', confirmPassword: 'Str0ng-passw0rd!' });

    expect(res.status).toBe(500);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('with JWT_SECRET', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'reset-secret-for-tests-only';
  });

  it('forgot-password stores HMAC-SHA256(JWT_SECRET, rawToken) and emails the raw token', async () => {
    const res = await post(forgot, { email: 'u@example.com' });

    expect(res.status).toBe(200);
    const rawToken = mockSendReset.mock.calls[0][1] as string;
    const expected = crypto.createHmac('sha256', 'reset-secret-for-tests-only').update(rawToken).digest('hex');
    expect(mockUserUpdate.mock.calls[0][0].data.passwordResetToken).toBe(expected);
    expect(mockUserUpdate.mock.calls[0][0].data.passwordResetToken).not.toBe(
      crypto.createHmac('sha256', '').update(rawToken).digest('hex'),
    );
  });
});
