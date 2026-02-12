/**
 * Individual Flight Plan API - App Router
 * 
 * RESTful endpoint for single flight plan operations by ID.
 * 
 * Authentication: Bearer token required (JWT)
 * Authorization: User can only access their own flight plans
 * 
 * Endpoints:
 * - GET    /api/flightPlans/[id] - Get a single flight plan by ID
 * - PUT    /api/flightPlans/[id] - Update a single flight plan by ID
 * - DELETE /api/flightPlans/[id] - Delete a single flight plan by ID (with CSV cascade)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { flightPlanUpdateDataSchema, safeParseBody } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

/**
 * FAS API URL - defaults to production server if not configured.
 * The base URL (without /uplan path) is used for cancellation requests.
 */
const FAS_API_URL = process.env.FAS_API_URL || 'http://158.42.167.56:8000/uplan';

/**
 * Derive the FAS base URL by removing the /uplan path suffix.
 * e.g. "http://158.42.167.56:8000/uplan" → "http://158.42.167.56:8000"
 */
function getFasBaseUrl(): string {
  try {
    const url = new URL(FAS_API_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    // Fallback: strip trailing path segments
    return FAS_API_URL.replace(/\/uplan\/?$/, '');
  }
}

/**
 * Send a cancellation request to the FAS for an approved flight plan.
 * This is fire-and-forget: failures are logged but do not block deletion.
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
 * Prisma update data type for flightPlan
 * Using a custom type that maps to Prisma's unchecked update input
 */
type FlightPlanUpdateData = {
  customName?: string;
  status?: string;
  fileContent?: string;
  authorizationStatus?: string;
  authorizationMessage?: Prisma.InputJsonValue | null;
  uplan?: string | null;
  scheduledAt?: Date | string | null;
  csvResult?: number | null;
  machineAssignedId?: number | null;
  folderId?: number | null;
  externalResponseNumber?: string | null;
};

/**
 * Sanitize update data to only include allowed fields with correct types
 * This ensures the data matches Prisma's expected input format
 */
function sanitizeUpdateData(
  data: Record<string, unknown>
): FlightPlanUpdateData {
  const out: FlightPlanUpdateData = {};
  
  if (typeof data.customName === 'string') out.customName = data.customName;
  if (typeof data.status === 'string') out.status = data.status;
  if (typeof data.fileContent === 'string') out.fileContent = data.fileContent;
  if (typeof data.authorizationStatus === 'string') out.authorizationStatus = data.authorizationStatus;
  if (data.authorizationMessage !== undefined) out.authorizationMessage = data.authorizationMessage as Prisma.InputJsonValue | null;
  if (data.uplan !== undefined) {
    // Convert uplan to JSON string for database storage
    out.uplan = data.uplan !== null && data.uplan !== undefined ? JSON.stringify(data.uplan) : null;
  }
  if (data.scheduledAt !== undefined) {
    out.scheduledAt = data.scheduledAt === null ? null : new Date(data.scheduledAt as string);
  }
  if (typeof data.csvResult === 'number' || data.csvResult === null) out.csvResult = data.csvResult;
  if (typeof data.machineAssignedId === 'number' || data.machineAssignedId === null) out.machineAssignedId = data.machineAssignedId;
  if (typeof data.folderId === 'number' || data.folderId === null) out.folderId = data.folderId;
  if (typeof data.externalResponseNumber === 'string' || data.externalResponseNumber === null) out.externalResponseNumber = data.externalResponseNumber;
  
  return out;
}

/**
 * GET /api/flightPlans/[id]
 * Get a single flight plan by ID
 * 
 * Authorization: User can only access their own flight plans
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
      include: {
        folder: true,
      },
    });

    if (!flightPlan) {
      return NextResponse.json(
        { error: 'Flight plan not found' },
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

    return NextResponse.json(flightPlan);
  } catch (error) {
    console.error('Error fetching flight plan:', error);
    return NextResponse.json(
      { error: 'Error fetching flight plan' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/flightPlans/[id]
 * Update a single flight plan by ID
 * 
 * Body: { customName?, status?, fileContent?, authorizationStatus?, ... }
 * 
 * Authorization: User can only update their own flight plans
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate the update data
  const result = safeParseBody(flightPlanUpdateDataSchema, body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.errors },
      { status: 400 }
    );
  }

  try {
    // First check if the flight plan exists and belongs to the user
    const existing = await prisma.flightPlan.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Flight plan not found' },
        { status: 404 }
      );
    }

    // Authorization check: ensure user owns this flight plan
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Sanitize and prepare update data for Prisma
    const updateData = sanitizeUpdateData(result.data as Record<string, unknown>);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    // Perform the update
    const updated = await prisma.flightPlan.update({
      where: { id },
      data: updateData as Prisma.flightPlanUncheckedUpdateInput,
      include: {
        folder: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating flight plan:', error);
    return NextResponse.json(
      { error: 'Error updating flight plan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flightPlans/[id]
 * Delete a single flight plan by ID
 * 
 * Also deletes the associated CSV result in the same transaction
 * 
 * Authorization: User can only delete their own flight plans
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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
    // First check if the flight plan exists, belongs to the user, and get its csvResult ID
    const existing = await prisma.flightPlan.findUnique({
      where: { id },
      select: {
        userId: true,
        csvResult: true,
        customName: true,
        authorizationStatus: true,
        externalResponseNumber: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Flight plan not found' },
        { status: 404 }
      );
    }

    // Authorization check: ensure user owns this flight plan
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // If the plan was approved by FAS, send a cancellation request before deleting
    if (existing.authorizationStatus === 'aprobado' && existing.externalResponseNumber) {
      await sendFasCancellation(existing.externalResponseNumber);
    }

    // Get the actual csvResult ID from the flight plan (may be different from flightPlan.id)
    const csvResultId = existing.csvResult;

    // Delete in transaction: CSV result first (if exists), then flight plan
    // Use the actual csvResult ID from the flightPlan record, not the flightPlan ID
    const operations: ReturnType<typeof prisma.csvResult.delete | typeof prisma.flightPlan.delete>[] = [];
    
    if (csvResultId !== null) {
      operations.push(prisma.csvResult.delete({ where: { id: csvResultId } }));
    }
    operations.push(prisma.flightPlan.delete({ where: { id } }));
    
    const results = await prisma.$transaction(operations);
    
    // Extract deleted plan from results (last operation)
    const deletedPlan = results[results.length - 1] as { id: number; customName: string };
    const deletedCsvResult = csvResultId !== null;

    // Log successful deletion
    //console.log(`[DELETE] Successfully deleted flight plan id=${id}${deletedCsvResult ? ` and csvResult id=${csvResultId}` : ''}`);

    return NextResponse.json({
      message: 'Flight plan deleted successfully',
      deletedPlan: {
        id: deletedPlan.id,
        customName: deletedPlan.customName,
      },
      deletedCsvResult,
    });
  } catch (error) {
    console.error('Error deleting flight plan:', error);
    return NextResponse.json(
      { error: 'Error deleting flight plan' },
      { status: 500 }
    );
  }
}
