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

    // External UPLANs (imported) have uplan but no csvResult
    const isExternalUplan = !flightPlan.csvResult && flightPlan.uplan;

    if (!isExternalUplan && !flightPlan.csvResult) {
      return NextResponse.json(
        { error: 'No CSV result associated with this flight plan' },
        { status: 400 }
      );
    }

    let uplan: any;

    if (isExternalUplan) {
      // External UPLAN - use existing data without regeneration
      if (typeof flightPlan.uplan === 'string') {
        try {
          uplan = JSON.parse(flightPlan.uplan);
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid UPLAN data format' },
            { status: 400 }
          );
        }
      } else if (flightPlan.uplan && typeof flightPlan.uplan === 'object') {
        uplan = flightPlan.uplan;
      } else {
        return NextResponse.json(
          { error: 'UPLAN data not available' },
          { status: 400 }
        );
      }

      // Validate that external UPLAN has operation volumes
      if (!uplan.operationVolumes || !Array.isArray(uplan.operationVolumes) || uplan.operationVolumes.length === 0) {
        return NextResponse.json(
          { error: 'External UPLAN has no operation volumes' },
          { status: 400 }
        );
      }

      // Update creationTime and updateTime to current UTC time
      const currentTime = new Date().toISOString();
      uplan.creationTime = currentTime;
      uplan.updateTime = currentTime;
    } else {
      // Internal plan - regenerate UPLAN from CSV trajectory
      // 2. Get the CSV result (1:1 relationship via same ID)
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

      // 3. Generate the U-Plan from trajectory
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

      uplan = trayToUplan({
        scheduledAt: scheduledAtPosix,
        csv: csvResult.csvResult,
        ...(uplanDetails ? { uplan: uplanDetails } : {}),
      });

      // Update creationTime and updateTime to current UTC time before sending to FAS
      const currentTime = new Date().toISOString();
      uplan.creationTime = currentTime;
      uplan.updateTime = currentTime;
    }

    // console.log('Plan procesado');

    // 4. Send U-Plan to external FAS API with retry logic for 500 errors
    const MAX_RETRIES = 5;
    let lastError: unknown = null;
    let externalResponseNumber = String(null);
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
        lastError = err;
        
        // Check if it's a 500 error that we should retry
        const is500Error = axios.isAxiosError(err) && err.response?.status === 500;
        
        if (is500Error && attempt < MAX_RETRIES) {
          console.warn(`FAS returned 500 error. Retry ${attempt}/${MAX_RETRIES}`);
          // Wait a bit before retrying (exponential backoff: 1s, 2s, 4s, 8s)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
          continue;
        }
        
        // If we exhausted all retries with 500 errors, revert to 'sin autorización'
        if (is500Error && attempt === MAX_RETRIES) {
          console.error(`FAS returned 500 error after ${MAX_RETRIES} attempts. Reverting to 'sin autorización'`);
          return NextResponse.json(
            { error: 'FAS temporarily unavailable. Please try again later.' },
            { status: 503 }
          );
        }
        
        // For non-500 errors, mark as denied
        console.error('Error enviando U-Plan a la API externa:', err);

        // Handle axios errors with response data (400, 404, etc.)
        if (axios.isAxiosError(err) && err.response?.data) {
          const uplanString = JSON.stringify(uplan);
          
          // Serialize the error response data to JSON string for Prisma
          const authMessageString = typeof err.response.data === 'string'
            ? err.response.data
            : JSON.stringify(err.response.data);

          await prisma.flightPlan.update({
            where: { id },
            data: {
              uplan: uplanString,
              authorizationStatus: 'denegado',
              authorizationMessage: authMessageString,
              externalResponseNumber: `error: ${err.message}`,
            },
          });

          return NextResponse.json(
            { error: 'denegado', message: err.response.data },
            { status: err.response.status }
          );
        }

        // Handle other errors (network, timeout, etc.)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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
    }
    
    // This should never be reached, but TypeScript requires a return statement
    return NextResponse.json(
      { error: 'Unexpected error during authorization' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error generando U-Plan:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
