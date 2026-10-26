/**
 * lib/rate-limit.ts: checkRateLimit window/ceiling and getClientIp, which shares the single
 * client-IP rule of lib/http.getSourceIp (right-most X-Forwarded-For) with the FAS callback.
 */

import { checkRateLimit, getClientIp } from '../rate-limit';

let keyCounter = 0;
const freshKey = () => `test-key-${++keyCounter}`;

describe('checkRateLimit', () => {
  it('allows `max` hits then refuses, reporting the time left in the window', () => {
    const key = freshKey();

    for (let i = 1; i <= 3; i++) {
      expect(checkRateLimit(key, 3, 60_000)).toMatchObject({ allowed: true, remaining: 3 - i });
    }
    const blocked = checkRateLimit(key, 3, 60_000);

    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.resetIn).toBeGreaterThan(0);
    expect(blocked.resetIn).toBeLessThanOrEqual(60_000);
  });

  it('keys are independent and the window restarts once it has elapsed', () => {
    const a = freshKey();
    const b = freshKey();
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);

    checkRateLimit(a, 1, 1000);
    expect(checkRateLimit(a, 1, 1000).allowed).toBe(false);
    expect(checkRateLimit(b, 1, 1000).allowed).toBe(true);

    now.mockReturnValue(1_000_000 + 1001);
    expect(checkRateLimit(a, 1, 1000).allowed).toBe(true);
    now.mockRestore();
  });
});

describe('getClientIp', () => {
  const ip = (headers: Record<string, string>) => getClientIp(new Request('http://localhost/', { headers }));

  it('uses the right-most X-Forwarded-For entry, never a client-supplied left-most one', () => {
    expect(ip({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 198.51.100.9' })).toBe('198.51.100.9');
    expect(ip({ 'x-forwarded-for': '198.51.100.9' })).toBe('198.51.100.9');
  });

  it('falls back to X-Real-IP, normalises ::ffff:, and answers "unknown" without headers', () => {
    expect(ip({ 'x-real-ip': '10.0.0.5' })).toBe('10.0.0.5');
    expect(ip({ 'x-forwarded-for': '::ffff:198.51.100.9' })).toBe('198.51.100.9');
    expect(ip({})).toBe('unknown');
  });
});
