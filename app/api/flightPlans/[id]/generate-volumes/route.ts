/**
 * POST /api/flightPlans/[id]/generate-volumes
 * 
 * Generates operation volumes on-demand for a single flight plan.
 * Used when viewing U-Plan map or before sending to FAS.
 * 
 * Authentication: Bearer token required (JWT)
 * Authorization: User can only generate volumes for their own flight plans
 * 
 * Behavior depends on NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA env:
 * - "true" (default): Generates volumes + random placeholder data for all uplan fields
 * - "false": Generates only 4D volumes, user must fill other fields manually
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { trayToUplan } from '@/lib/uplan/tray_to_uplan';

/**
 * Environment variable to control random data generation
 */
const GENERATE_RANDOM_UPLAN_DATA = process.env.NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA !== 'false';

/**
 * Params type for dynamic route (Next.js 15 App Router)
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
 * POST /api/flightPlans/[id]/generate-volumes
 * Generate operation volumes for a single flight plan
 * 
 * Prerequisites:
 * - Flight plan must exist
 * - Flight plan must belong to the authenticated user
 * - Flight plan must have scheduledAt set
 * - CSV result must exist for the plan
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // 1. Authenticate the request
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
    // 2. Get the flight plan
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
    });

    if (!flightPlan) {
      return NextResponse.json(
        { error: 'Flight plan not found' },
        { status: 404 }
      );
    }

    // 3. Verify ownership
    if (flightPlan.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 4. Verify plan is processed (csvResult flag exists)
    if (!flightPlan.csvResult) {
      return NextResponse.json(
        { error: 'Flight plan has not been processed yet (no CSV result)' },
        { status: 400 }
      );
    }

    // Validate scheduledAt
    if (!flightPlan.scheduledAt) {
      return NextResponse.json(
        { error: 'Flight plan is missing scheduledAt' },
        { status: 400 }
      );
    }

    // 5. Get the CSV data (1:1 relationship via same ID)
    const csvResultRecord = await prisma.csvResult.findUnique({
      where: { id },
    });

    if (!csvResultRecord?.csvResult) {
      return NextResponse.json(
        { error: 'CSV data not found' },
        { status: 404 }
      );
    }

    // console.log(`[GenerateVolumes] Plan ${id}: Starting volume generation for user ${userId}`);

    // 6. Parse existing uplan details if available
    let existingUplan: unknown;
    if (typeof flightPlan.uplan === 'string') {
      try {
        existingUplan = JSON.parse(flightPlan.uplan);
      } catch {
        existingUplan = undefined;
      }
    } else if (flightPlan.uplan && typeof flightPlan.uplan === 'object') {
      existingUplan = flightPlan.uplan;
    }

    // 7. Generate the U-Plan with volumes
    // trayToUplan handles the GENERATE_RANDOM_UPLAN_DATA logic internally:
    // - If true: generates complete uplan with random placeholder data
    // - If false: generates only operation volumes
    const scheduledAtPosix = Math.floor(
      new Date(flightPlan.scheduledAt).getTime() / 1000
    );

    const newUplan = trayToUplan({
      scheduledAt: scheduledAtPosix,
      csv: csvResultRecord.csvResult,
      ...(existingUplan ? { uplan: existingUplan } : {}),
    });

    // Count generated volumes
    const volumesGenerated = Array.isArray(newUplan.operationVolumes) 
      ? newUplan.operationVolumes.length 
      : 0;

    // 8. Save the updated uplan to database
    const uplanString = JSON.stringify(newUplan);

    await prisma.flightPlan.update({
      where: { id },
      data: {
        uplan: uplanString,
      },
    });

    // console.log(
    //   `[GenerateVolumes] ✅ Plan ${id}: Generated ${volumesGenerated} volumes ` +
    //   `(randomData: ${GENERATE_RANDOM_UPLAN_DATA})`
    // );

    // 9. Return success response
    return NextResponse.json({
      success: true,
      volumesGenerated,
      randomDataGenerated: GENERATE_RANDOM_UPLAN_DATA,
      uplan: newUplan,
    });
  } catch (error) {
    console.error(`[GenerateVolumes] ❌ Plan ${id}: Failed`, error);
    return NextResponse.json(
      { 
        error: 'Failed to generate volumes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
