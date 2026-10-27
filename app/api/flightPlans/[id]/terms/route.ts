/**
 * FAS Terms and Conditions Proxy API - App Router
 *
 * Fetches the terms and conditions for an approved flight plan from the
 * external FAS (Flight Authorization System) and forwards them to the client.
 *
 * Authentication: Bearer token required (JWT)
 * Authorization: User can only access terms for their own flight plans
 *
 * Endpoint:
 * - GET /api/flightPlans/[id]/terms - Fetch T&C for an approved flight plan
 *
 * Prerequisites:
 * - Flight plan must exist and belong to the authenticated user
 * - authorizationStatus must be 'aprobado'
 * - externalResponseNumber must be set
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { getFasBaseUrl, fasFetch } from '@/lib/fas';
import { parseId } from '@/lib/http';

/**
 * Params type for dynamic route
 */
interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/flightPlans/[id]/terms
 * Proxy request to the FAS to retrieve terms and conditions for an approved flight plan.
 *
 * Authorization: User can only fetch terms for their own plans.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // Authenticate the request
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;
  const id = parseId(idParam);

  if (id === null) {
    return NextResponse.json(
      { error: 'Invalid flight plan ID' },
      { status: 400 }
    );
  }

  try {
    // Fetch the flight plan and verify ownership
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        authorizationStatus: true,
        externalResponseNumber: true,
      },
    });

    if (!flightPlan) {
      return NextResponse.json(
        { error: 'Plan de vuelo no encontrado' },
        { status: 404 }
      );
    }

    // Authorization check: ensure user owns this flight plan
    if (flightPlan.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Only approved plans have terms
    if (flightPlan.authorizationStatus !== 'aprobado') {
      return NextResponse.json(
        { error: 'El plan no está aprobado' },
        { status: 400 }
      );
    }

    // Must have an external response number to query FAS
    if (!flightPlan.externalResponseNumber) {
      return NextResponse.json(
        { error: 'El plan no tiene número de respuesta externo' },
        { status: 400 }
      );
    }

    // Proxy GET to FAS terms endpoint
    const baseUrl = getFasBaseUrl();
    const termsUrl = `${baseUrl}/terms/${encodeURIComponent(flightPlan.externalResponseNumber)}`;

    let fasResponse: Response;
    try {
      fasResponse = await fasFetch(termsUrl, { method: 'GET' });
    } catch (networkError) {
      const message =
        networkError instanceof Error ? networkError.message : String(networkError);
      console.error('[Terms] FAS network error:', message);
      return NextResponse.json(
        { error: 'FAS unavailable', message },
        { status: 502 }
      );
    }

    if (!fasResponse.ok) {
      const message = `FAS returned ${fasResponse.status} ${fasResponse.statusText}`;
      console.error('[Terms] FAS non-2xx response:', message);
      return NextResponse.json(
        { error: 'FAS unavailable', message },
        { status: 502 }
      );
    }

    // Forward the FAS JSON response verbatim
    const data = await fasResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Terms] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
