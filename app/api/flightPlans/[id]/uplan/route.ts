/**
 * U-Plan Generation API - App Router
 * 
 * Generates U-Plan format from CSV trajectory data and sends to external FAS API.
 * 
 * Authentication: Bearer token required (JWT)
 * Authorization: User can only generate U-Plan for their own flight plans
 * 
 * Endpoint:
 * - POST /api/flightPlans/[id]/uplan - Generate and submit U-Plan for authorization
 * 
 * Workflow:
 * 1. Validate flight plan exists and belongs to user
 * 2. Verify required data (scheduledAt, CSV result)
 * 3. Generate U-Plan from CSV trajectory
 * 4. Send to external FAS authorization API
 * 5. Update flight plan with authorization status
 * 6. Return result
 * 
 * External API:
 * - Endpoint: Configured via FAS_API_URL env (default: http://158.42.167.56:8000/uplan)
 * - Method: POST
 * - Content-Type: application/json
 * - Payload: Generated U-Plan object
 * 
 * Authorization States:
 * - "FAS procesando..." - Initial processing (sent to FAS)
 * - "denegado" - Authorization denied by FAS
 * - "aprobado" - Authorization approved
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { trayToUplan } from '@/lib/uplan/tray_to_uplan';
import axios from 'axios';

/**
 * FAS API URL - defaults to production server if not configured
 */
const FAS_API_URL = process.env.FAS_API_URL || 'http://158.42.167.56:8000/uplan';

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
 * POST /api/flightPlans/[id]/uplan
 * Generate U-Plan from flight plan CSV and submit to FAS for authorization
 * 
 * Prerequisites:
 * - Flight plan must exist
 * - Flight plan must have scheduledAt set
 * - CSV result must exist for the plan
 * 
 * Authorization: User can only generate U-Plan for their own flight plans
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

    // Validate required data
    if (!flightPlan.scheduledAt) {
      return NextResponse.json(
        { error: 'Faltan datos necesarios (scheduledAt)' },
        { status: 400 }
      );
    }

    if (!flightPlan.csvResult) {
      return NextResponse.json(
        { error: 'No CSV result associated with this flight plan' },
        { status: 400 }
      );
    }

    // 2. Get the CSV result (1:1 relationship via same ID)
    // Note: flightPlan.csvResult is a boolean flag, not an ID
    // The csvResult table uses the same ID as flightPlan (flightPlan.id = csvResult.id)
    const csvResult = await prisma.csvResult.findUnique({
      where: { id },
    });

    if (!csvResult) {
      return NextResponse.json(
        { error: 'CSV no encontrado' },
        { status: 404 }
      );
    }

    if (!csvResult.csvResult) {
      return NextResponse.json(
        { error: 'CSV result data is empty' },
        { status: 400 }
      );
    }

    // 3. Generate the U-Plan
    const scheduledAtPosix = Math.floor(
      new Date(flightPlan.scheduledAt).getTime() / 1000
    );

    // Parse uplan details if stored as string
    let uplanDetails: unknown;
    if (typeof flightPlan.uplan === 'string') {
      try {
        uplanDetails = JSON.parse(flightPlan.uplan);
      } catch {
        uplanDetails = undefined;
      }
    } else if (flightPlan.uplan && typeof flightPlan.uplan === 'object') {
      uplanDetails = flightPlan.uplan;
    }

    const uplan = trayToUplan({
      scheduledAt: scheduledAtPosix,
      csv: csvResult.csvResult,
      ...(uplanDetails ? { uplan: uplanDetails } : {}),
    });

    // Update creationTime and updateTime to current UTC time before sending to FAS
    const currentTime = new Date().toISOString();
    uplan.creationTime = currentTime;
    uplan.updateTime = currentTime;

    console.log('Plan procesado');

    // 4. Send U-Plan to external FAS API
    let externalResponseNumber = String(null);
    
    try {
      const response = await axios.post(
        FAS_API_URL,
        uplan,
        { headers: { 'Content-Type': 'application/json' } }
      );

      externalResponseNumber =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);

      // Convert uplan to JSON string for database storage
      const uplanString = JSON.stringify(uplan);

      // Save as processing (FAS will update status later)
      await prisma.flightPlan.update({
        where: { id },
        data: {
          uplan: uplanString,
          authorizationStatus: 'pendiente',
          authorizationMessage: 'FAS procesando...',
          externalResponseNumber,
        },
      });

      return NextResponse.json({
        uplan,
        authorizationMessage: externalResponseNumber,
      });
    } catch (err: unknown) {
      console.error('Error enviando U-Plan a la API externa:', err);

      // Handle axios errors with response data
      if (axios.isAxiosError(err) && err.response?.data) {
        // Convert uplan to JSON string for database storage
        const uplanString = JSON.stringify(uplan);

        await prisma.flightPlan.update({
          where: { id },
          data: {
            uplan: uplanString,
            authorizationStatus: 'denegado',
            authorizationMessage: err.response.data,
            externalResponseNumber: `error: ${err.message}`,
          },
        });

        return NextResponse.json(
          { error: 'denegado', message: err.response.data },
          { status: 400 }
        );
      }

      // Handle other errors
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Convert uplan to JSON string for database storage
      const uplanString = JSON.stringify(uplan);
      
      await prisma.flightPlan.update({
        where: { id },
        data: {
          uplan: uplanString,
          authorizationStatus: 'denegado',
          authorizationMessage: err instanceof Error 
            ? JSON.parse(JSON.stringify(err)) 
            : String(err),
          externalResponseNumber: `error: ${errorMessage}`,
        },
      });

      return NextResponse.json(
        { error: 'denegado', message: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generando U-Plan:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
