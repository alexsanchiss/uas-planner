/**
 * Fail fast in production: refuse to start the server without JWT_SECRET instead of
 * failing on the first authenticated request. Skipped during `next build` (no env there).
 * Dynamic import keeps bcrypt/jsonwebtoken out of the edge bundle.
 */
export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { getJwtSecret } = await import('@/lib/auth');
    getJwtSecret();
  }
}
