/**
 * lib/auth.ts: the JWT secret is required at USE time, never at import time.
 *
 * - importing the module without JWT_SECRET must not throw (builds compile without env);
 * - signing/verifying/decoding without it must throw a clear configuration error, never come
 *   back as "invalid token" (null), which would silently log everybody out / hide the misconfig.
 */

const ORIGINAL_SECRET = process.env.JWT_SECRET;

type AuthModule = typeof import('../auth');

async function loadAuthWithoutSecret(): Promise<AuthModule> {
  jest.resetModules();
  delete process.env.JWT_SECRET;
  return import('../auth');
}

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;
});

describe('lib/auth without JWT_SECRET', () => {
  it('can be imported without throwing', async () => {
    await expect(loadAuthWithoutSecret()).resolves.toBeDefined();
  });

  it.each([
    ['generateToken', (a: AuthModule) => a.generateToken(1)],
    ['generateRefreshToken', (a: AuthModule) => a.generateRefreshToken(1)],
    ['verifyToken', (a: AuthModule) => a.verifyToken('any.token.here')],
    ['verifyRefreshToken', (a: AuthModule) => a.verifyRefreshToken('any.token.here')],
    ['decodeToken', (a: AuthModule) => a.decodeToken('any.token.here')],
    ['getJwtSecret', (a: AuthModule) => a.getJwtSecret()],
  ])('%s throws a clear JWT_SECRET configuration error', async (_name, run) => {
    const auth = await loadAuthWithoutSecret();

    expect(() => run(auth)).toThrow(/JWT_SECRET environment variable is not set/);
  });

  it('treats an empty JWT_SECRET as missing', async () => {
    const auth = await loadAuthWithoutSecret();
    process.env.JWT_SECRET = '';

    expect(() => auth.generateToken(1)).toThrow(/JWT_SECRET/);
  });

  it('does not report a missing secret as an invalid token (verify never returns null for it)', async () => {
    const auth = await loadAuthWithoutSecret();
    let result: unknown = 'not-called';

    try {
      result = auth.verifyToken('x.y.z');
    } catch {
      result = 'threw';
    }

    expect(result).toBe('threw');
  });
});

describe('lib/auth reads the secret lazily', () => {
  it('works with a secret set after import and keeps rejecting forged/foreign tokens with null', async () => {
    const auth = await loadAuthWithoutSecret();
    process.env.JWT_SECRET = 'secret-one-for-tests-only';

    const access = auth.generateToken(7);
    const refresh = auth.generateRefreshToken(7);

    expect(auth.verifyToken(access)).toEqual({ userId: 7 });
    expect(auth.verifyRefreshToken(refresh)).toEqual({ userId: 7 });
    // access and refresh tokens are not interchangeable
    expect(auth.verifyToken(refresh)).toBeNull();
    expect(auth.verifyRefreshToken(access)).toBeNull();
    // a token signed under another secret is simply invalid (null), not a crash
    process.env.JWT_SECRET = 'secret-two-for-tests-only';
    expect(auth.verifyToken(access)).toBeNull();
    expect(auth.verifyToken('garbage')).toBeNull();
  });
});
