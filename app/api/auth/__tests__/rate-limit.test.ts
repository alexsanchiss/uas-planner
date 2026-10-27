/**
 * Rate limits added in F4 (SEC-10): signup 5/h and resend-verification 3/h per IP.
 * Over the limit: 429 + Retry-After (seconds, <= the 1 h window) and the handler body never runs.
 * Each test uses its own IP so the module-level in-memory counter never leaks between tests.
 */

const mockFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));
jest.mock('@/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

import { POST as signup } from '../signup/route';
import { POST as resend } from '../resend-verification/route';

let ipCounter = 0;
const freshIp = () => `198.51.100.${++ipCounter}`;

function post(handler: typeof signup, ip: string | null, body: unknown = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ip) headers['x-forwarded-for'] = ip;
  return handler(new Request('http://localhost/api/auth', { method: 'POST', headers, body: JSON.stringify(body) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
});

describe.each([
  ['POST /api/auth/signup', signup, 5, 'Too many sign-up attempts. Please try again later.'],
  ['POST /api/auth/resend-verification', resend, 3, 'Too many verification requests. Please try again later.'],
] as const)('%s rate limit', (_name, handler, limit, message) => {
  it(`allows ${limit} requests per IP per hour, then answers 429 with Retry-After`, async () => {
    const ip = freshIp();

    for (let i = 0; i < limit; i++) {
      // invalid body on purpose: the request is validated (400) but still counts
      expect((await post(handler, ip)).status).toBe(400);
    }
    const blocked = await post(handler, ip);

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: message });
    const retryAfter = Number(blocked.headers.get('Retry-After'));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(3590);
    expect(retryAfter).toBeLessThanOrEqual(3600);
  });

  it('keeps blocking once blocked and does no work (no DB lookup) for blocked callers', async () => {
    const ip = freshIp();
    for (let i = 0; i < limit; i++) await post(handler, ip, { email: `u${i}@example.com` });
    mockFindUnique.mockClear();

    for (let i = 0; i < 3; i++) {
      expect((await post(handler, ip, { email: 'victim@example.com' })).status).toBe(429);
    }
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('counts per IP: another IP is unaffected', async () => {
    const noisy = freshIp();
    for (let i = 0; i <= limit; i++) await post(handler, noisy);

    expect((await post(handler, noisy)).status).toBe(429);
    expect((await post(handler, freshIp())).status).toBe(400);
  });
});

it('signup and resend-verification keep independent counters for the same IP', async () => {
  const ip = freshIp();
  for (let i = 0; i < 5; i++) await post(signup, ip);

  expect((await post(signup, ip)).status).toBe(429);
  expect((await post(resend, ip)).status).toBe(400);
});

describe('the rate-limit key is the proxy-appended (right-most) address', () => {
  const withChain = (handler: typeof signup, chain: string) =>
    handler(
      new Request('http://localhost/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': chain },
        body: '{}',
      }),
    );

  it.each([
    ['signup', signup, 5],
    ['resend-verification', resend, 3],
  ] as const)('%s: rotating the client-controlled left-most entries does not reset the budget', async (_name, handler, limit) => {
    const real = freshIp();
    for (let i = 0; i < limit; i++) expect((await withChain(handler, `192.0.2.${i + 1}, ${real}`)).status).toBe(400);

    const blocked = await withChain(handler, `192.0.2.250, ${real}`);

    expect(blocked.status).toBe(429);
  });

  it('the ::ffff: form of an address shares the bucket of the plain form', async () => {
    const real = freshIp();
    for (let i = 0; i < 3; i++) await withChain(resend, real);

    expect((await withChain(resend, `::ffff:${real}`)).status).toBe(429);
  });
});
