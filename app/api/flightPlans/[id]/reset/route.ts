/**
 * Flight Plan Reset API - App Router
 * 
 * Resets a flight plan to its initial unprocessed state.
 * 
 * Authentication: Bearer token required (JWT)
 * Authorization: User can only reset their own flight plans
 * 
 * Endpoint:
 * - POST /api/flightPlans/[id]/reset - Reset a flight plan to initial state
 * 
 * Reset Actions:
 * 1. Delete associated csvResult (if exists)
 * 2. Clear authorizationStatus (set to "sin autorización")
 * 3. Clear authorizationMessage (set to null)
 * 4. Set status to "sin procesar"
 * 5. Clear uplan (set to null)
 * 6. Clear externalResponseNumber (set to null)
 * 7. Clear machineAssignedId (set to null)
 */

import { Prisma } from '@prisma/client';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';

/**
 * Params type for dynamic route
 */
interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Parse and validate the flight plan ID from route params
 */
function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * POST /api/flightPlans/[id]/reset
 * Reset a flight plan to its initial unprocessed state
 * 
 * This endpoint:
 * - Deletes the associated CSV result
 * - Clears authorization status and message
 * - Sets status back to "sin procesar"
 * - Clears U-Plan data and external response number
 * - Clears machine assignment
 * 
 * Authorization: User can only reset their own flight plans
 */
export async function POST(
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
    // 1. Get the flight plan and verify ownership
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        customName: true,
        status: true,
        csvResult: true,
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

    // Check if plan is already unprocessed (nothing to reset)
    if (flightPlan.status === 'sin procesar') {
      return NextResponse.json(
        { error: 'El plan ya está sin procesar', code: 'ALREADY_UNPROCESSED' },
        { status: 400 }
      );
    }

    // 2. Perform reset in a transaction
    // Delete CSV result (if exists) and reset flight plan fields
    const [deletedCsvResult, updatedPlan] = await prisma.$transaction([
      // Delete CSV result by the flight plan's csvResult ID (if it exists)
      prisma.csvResult.deleteMany({
        where: { id: flightPlan.csvResult ?? -1 },
      }),
      // Reset flight plan to initial state
      prisma.flightPlan.update({
        where: { id },
        data: {
          status: 'sin procesar',
          csvResult: null,
          authorizationStatus: 'sin autorización',
          authorizationMessage: Prisma.DbNull,
          uplan: Prisma.DbNull,
          externalResponseNumber: null,
          machineAssignedId: null,
        },
        include: {
          folder: true,
        },
      }),
    ]);

    console.log(`Flight plan ${id} reset successfully`);

    return NextResponse.json({
      message: 'Plan de vuelo reiniciado correctamente',
      flightPlan: updatedPlan,
      csvResultDeleted: deletedCsvResult.count > 0,
    });
  } catch (error) {
    console.error('Error resetting flight plan:', error);
    return NextResponse.json(
      { error: 'Error al reiniciar el plan de vuelo' },
      { status: 500 }
    );
  }
}
