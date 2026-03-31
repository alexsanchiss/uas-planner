// Simple in-memory rate limiter
// For production, use Redis-based solution

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const limiters = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = limiters.get(key);

  if (!entry || now - entry.firstRequest > windowMs) {
    limiters.set(key, { count: 1, firstRequest: now });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  entry.count++;
  const resetIn = windowMs - (now - entry.firstRequest);

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetIn };
}

// Helper to get IP from request
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
