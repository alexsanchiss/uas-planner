/**
 * GET /api/flightPlans/active
 *
 * Returns approved flight plans for the authenticated user that are within
 * the activation window: scheduledAt between (now - 1h) and (now + 24h).
 *
 * Authentication: Bearer token required (JWT)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);   // now - 1h
  const windowEnd   = new Date(now.getTime() + 24 * 60 * 60 * 1000); // now + 24h

  try {
    const plans = await prisma.flightPlan.findMany({
      where: {
        userId,
        authorizationStatus: 'aprobado',
        scheduledAt: {
          not: null,
          gte: windowStart,
          lte: windowEnd,
        },
      },
      select: {
        id: true,
        customName: true,
        status: true,
        authorizationStatus: true,
        scheduledAt: true,
        activationStatus: true,
        activatedAt: true,
        activationMessage: true,
        termsAcceptedAt: true,
        externalResponseNumber: true,
        uplan: true,
        fileContent: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('[GET /api/flightPlans/active] Error:', error);
    return NextResponse.json(
      { error: 'Error fetching active flight plans' },
      { status: 500 }
    );
  }
}
