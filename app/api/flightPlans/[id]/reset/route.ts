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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { sendPlanDeletionEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

/**
 * FAS API URL - defaults to production server if not configured.
 */
const FAS_API_URL = process.env.FAS_API_URL || 'http://158.42.167.56:8000/uplan';

/**
 * Derive the FAS base URL by removing the /uplan path suffix.
 */
function getFasBaseUrl(): string {
  try {
    const url = new URL(FAS_API_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return FAS_API_URL.replace(/\/uplan\/?$/, '');
  }
}

/**
 * Send a cancellation request to the FAS for an approved flight plan.
 * Fire-and-forget: failures are logged but do not block the reset.
 */
async function sendFasCancellation(externalResponseNumber: string): Promise<void> {
  const baseUrl = getFasBaseUrl();
  const cancelUrl = `${baseUrl}/uplan_cancelation/${encodeURIComponent(externalResponseNumber)}`;

  try {
    const response = await fetch(cancelUrl, { method: 'DELETE' });
    if (!response.ok) {
      console.warn(
        `[FAS Cancellation] Non-OK response for ${externalResponseNumber}: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.warn(
      `[FAS Cancellation] Failed to cancel ${externalResponseNumber}:`,
      error instanceof Error ? error.message : error
    );
  }
}

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
        fileContent: true,
        authorizationStatus: true,
        externalResponseNumber: true,
        uplan: true, // Need full uplan to extract waypoints
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

    // Block reset for externally uploaded plans (no file content to re-process)
    if (!flightPlan.fileContent) {
      return NextResponse.json(
        { error: 'Cannot reset an externally uploaded plan' },
        { status: 400 }
      );
    }

    // Check if plan is already unprocessed (nothing to reset)
    if (flightPlan.status === 'sin procesar') {
      return NextResponse.json(
        { error: 'El plan ya está sin procesar', code: 'ALREADY_UNPROCESSED' },
        { status: 400 }
      );
    }

    // If the plan was approved by FAS, cancel it and notify the user
    if (flightPlan.authorizationStatus === 'aprobado') {
      if (flightPlan.externalResponseNumber) {
        sendFasCancellation(flightPlan.externalResponseNumber).catch(() => {});
      }

      // Notify user via email (fire-and-forget)
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (owner?.email) {
        sendPlanDeletionEmail(owner.email, flightPlan.customName)
          .catch(err => logger.error('Failed to send plan reset email', {
            userId,
            planId: id,
            error: err instanceof Error ? err.message : String(err),
          }));
      }
    }

    // 2. Perform reset in a transaction
    // Delete CSV result (if exists) and reset flight plan fields
    // IMPORTANT: Preserve waypoints from flightDetails when resetting uplan
    
    // First, extract waypoints from current uplan if they exist
    let waypointsToPreserve: unknown = null;
    if (flightPlan.uplan) {
      try {
        const currentUplan = typeof flightPlan.uplan === 'string' 
          ? JSON.parse(flightPlan.uplan)
          : flightPlan.uplan;
        
        if (currentUplan && typeof currentUplan === 'object') {
          const flightDetails = (currentUplan as Record<string, unknown>).flightDetails as Record<string, unknown> | undefined;
          if (flightDetails?.waypoints) {
            waypointsToPreserve = flightDetails.waypoints;
            console.log('[Reset] Preserving waypoints:', waypointsToPreserve);
          }
        }
      } catch (error) {
        console.warn('[Reset] Failed to parse uplan for waypoint preservation:', error);
      }
    }
    
    // Build the uplan to set (null or minimal structure with waypoints)
    const resetUplan = waypointsToPreserve 
      ? JSON.stringify({ flightDetails: { waypoints: waypointsToPreserve } })
      : null;
    
    const [deletedCsvResult, updatedPlan] = await prisma.$transaction([
      // Delete CSV result by the flight plan's ID (1:1 relationship)
      prisma.csvResult.deleteMany({
        where: { id },
      }),
      // Reset flight plan to initial state (preserving waypoints)
      prisma.flightPlan.update({
        where: { id },
        data: {
          status: 'sin procesar',
          csvResult: null,
          authorizationStatus: 'sin autorización',
          authorizationMessage: null,
          uplan: resetUplan, // null or minimal structure with waypoints
          externalResponseNumber: null,
          machineAssignedId: null,
        },
        include: {
          folder: true,
        },
      }),
    ]);

    // console.log(`Flight plan ${id} reset successfully`);

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
