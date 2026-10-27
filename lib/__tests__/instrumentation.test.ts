/**
 * instrumentation.ts: the production server refuses to start without JWT_SECRET (fail fast), but
 * `next build`, dev and the edge runtime are left alone.
 *
 * Next.js calls register() once when the server boots. It must REJECT only for a real production
 * node server: NODE_ENV=production, NEXT_RUNTIME=nodejs and not in the build phase.
 */

import { register } from '../../instrumentation';

const KEYS = ['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE', 'JWT_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

// NODE_ENV is typed read-only in @types/node; the env itself is a plain mutable bag
const env = process.env as Record<string, string | undefined>;

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    if (key in values) env[key] = values[key];
    else delete env[key];
  }
}

beforeAll(() => {
  for (const key of KEYS) saved[key] = env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
});

describe('register()', () => {
  it('rejects with the JWT_SECRET configuration error in a production node server without the secret', async () => {
    setEnv({ NODE_ENV: 'production', NEXT_RUNTIME: 'nodejs' });

    await expect(register()).rejects.toThrow(/JWT_SECRET environment variable is not set/);
  });

  it('also rejects for an empty secret', async () => {
    setEnv({ NODE_ENV: 'production', NEXT_RUNTIME: 'nodejs', JWT_SECRET: '' });

    await expect(register()).rejects.toThrow(/JWT_SECRET/);
  });

  it('starts when the secret is set', async () => {
    setEnv({ NODE_ENV: 'production', NEXT_RUNTIME: 'nodejs', JWT_SECRET: 'a-real-secret' });

    await expect(register()).resolves.toBeUndefined();
  });

  it.each([
    ['during `next build` (no env there)', { NODE_ENV: 'production', NEXT_RUNTIME: 'nodejs', NEXT_PHASE: 'phase-production-build' }],
    ['in development (next.config.mjs already complains)', { NODE_ENV: 'development', NEXT_RUNTIME: 'nodejs' }],
    ['under jest / test', { NODE_ENV: 'test', NEXT_RUNTIME: 'nodejs' }],
    ['in the edge runtime (bcrypt cannot load there)', { NODE_ENV: 'production', NEXT_RUNTIME: 'edge' }],
  ])('does nothing %s even without the secret', async (_label, values) => {
    setEnv(values);

    await expect(register()).resolves.toBeUndefined();
  });
});
