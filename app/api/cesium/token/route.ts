import { NextRequest, NextResponse } from 'next/server';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(userId: string): { allowed: boolean; count: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now - userLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return { allowed: true, count: 1 };
  }

  userLimit.count++;
  if (userLimit.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, count: userLimit.count };
  }
  return { allowed: true, count: userLimit.count };
}

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (isAuthError(auth)) return auth;

  const userId = auth.userId;
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const timestamp = new Date().toISOString();

  // Check rate limit
  const { allowed, count } = checkRateLimit(String(userId));

  if (!allowed) {
    console.log(JSON.stringify({ event: 'cesium_token_rate_limited', userId, timestamp, ip }));
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Audit log
  console.log(JSON.stringify({ event: 'cesium_token_accessed', userId, timestamp, ip }));

  const token = process.env.CESIUM_ION_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Cesium token not configured' }, { status: 500 });
  }

  return NextResponse.json({ token });
}
