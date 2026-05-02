/**
 * GET /api/flightPlans/history
 *
 * Returns historical flight plans for the authenticated user.
 * A plan is "historical" when it matches any of:
 *   - activatedAt IS NOT NULL  (was activated at some point)
 *   - scheduledAt < now - 60s  AND  authorizationStatus = 'aprobado'  (window passed)
 *   - authorizationStatus IN ('denegado', 'withdrawn')  (finalized negative)
 *
 * Query params:
 *   limit  — default 50, max 100
 *   offset — default 0
 *
 * Authentication: Bearer token required (JWT)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  // Parse and clamp pagination params
  const searchParams = request.nextUrl.searchParams;
  const rawLimit  = parseInt(searchParams.get('limit')  ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const limit  = Number.isFinite(rawLimit)  ? Math.min(Math.max(rawLimit,  1), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  const now = new Date();
  const windowCutoff = new Date(now.getTime() - 60 * 1000); // now - 60s

  const where = {
    userId,
    OR: [
      // 1. Was activated at some point
      { activatedAt: { not: null } },
      // 2. Approved plan whose scheduled window has passed
      {
        authorizationStatus: 'aprobado' as const,
        scheduledAt: { lt: windowCutoff },
      },
      // 3. Finalized negative authorization
      { authorizationStatus: { in: ['denegado', 'withdrawn'] } },
    ],
  };

  try {
    const [plans, total] = await prisma.$transaction([
      prisma.flightPlan.findMany({
        where,
        select: {
          id: true,
          customName: true,
          status: true,
          authorizationStatus: true,
          activationStatus: true,
          activatedAt: true,
          activationMessage: true,
          scheduledAt: true,
          externalResponseNumber: true,
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.flightPlan.count({ where }),
    ]);

    return NextResponse.json({ plans, total, limit, offset });
  } catch (error) {
    console.error('[GET /api/flightPlans/history] Error:', error);
    return NextResponse.json(
      { error: 'Error fetching flight plan history' },
      { status: 500 }
    );
  }
}
