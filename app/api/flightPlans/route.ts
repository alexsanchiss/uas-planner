/**
 * Flight Plans API - App Router
 * 
 * Unified endpoint for all flight plan operations (CRUD + bulk operations).
 * 
 * Authentication: Bearer token required (JWT)
 * Security: userId is extracted from token, never from request body
 * 
 * Endpoints:
 * - GET    /api/flightPlans - List all flight plans for authenticated user
 * - POST   /api/flightPlans - Create flight plan(s)
 * - PUT    /api/flightPlans - Update flight plan(s)
 * - DELETE /api/flightPlans - Delete flight plan(s)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import {
  flightPlanDeleteSchema,
  safeParseBody,
} from '@/lib/validators';
import { z } from 'zod';

/**
 * FAS API URL - defaults to production server if not configured.
 * The base URL (without /uplan path) is used for cancellation requests.
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
 * Fire-and-forget: failures are logged but do not block deletion.
 */
async function sendFasCancellation(externalResponseNumber: string): Promise<void> {
  const baseUrl = getFasBaseUrl();
  const cancelUrl = `${baseUrl}/uplan_cancelation/${encodeURIComponent(externalResponseNumber)}`;

  try {
    const response = await fetch(cancelUrl, { method: 'PUT' });
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

// Constants for bulk operation limits
const MAX_BULK_IDS = 100000;
const MAX_BULK_ITEMS = 2000;
const CHUNK_SIZE = 200;

/**
 * GET /api/flightPlans
 * List all flight plans for the authenticated user
 * 
 * Query params: none required (userId from token)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  try {
    const flightPlans = await prisma.flightPlan.findMany({
      where: { userId },
      include: {
        folder: true,
      },
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(flightPlans);
  } catch (error) {
    console.error('Error fetching flight plans:', error);
    return NextResponse.json(
      { error: 'Error fetching flight plans' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flightPlans
 * Create one or multiple flight plans
 * 
 * Single: { customName, status, fileContent, folderId?, uplan?, scheduledAt? }
 * Bulk:   { items: [{ customName, status, fileContent, ... }] }
 * 
 * Note: userId is taken from the auth token for security
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Helper to convert input to database record
  const toRecord = (p: {
    customName: string;
    status: string;
    fileContent: string;
    folderId?: number | null;
    uplan?: unknown;
    scheduledAt?: string | null;
    geoawarenessData?: unknown;
  }) => ({
    customName: p.customName,
    status: p.status,
    fileContent: p.fileContent,
    userId, // Always from auth token
    folderId: p.folderId ?? null,
    uplan: p.uplan !== undefined && p.uplan !== null ? JSON.stringify(p.uplan) : null,
    scheduledAt: p.scheduledAt ?? null,
    geoawarenessData: p.geoawarenessData !== undefined && p.geoawarenessData !== null ? p.geoawarenessData : Prisma.DbNull,
  });

  try {
    // Check if this is a bulk create request
    if (typeof body === 'object' && body !== null && 'items' in body) {
      // Validate bulk create schema (but without userId since we use the token)
      const bulkSchema = z.object({
        items: z.array(
          z.object({
            customName: z.string().min(1).max(255),
            status: z.string(),
            fileContent: z.string().min(1),
            folderId: z.number().int().positive().nullable().optional(),
            uplan: z.unknown().nullable().optional(),
            scheduledAt: z.string().nullable().optional(),
            geoawarenessData: z.unknown().nullable().optional(),
          })
        ).min(1).max(MAX_BULK_ITEMS),
      });

      const result = safeParseBody(bulkSchema, body);
      if (!result.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: result.errors },
          { status: 400 }
        );
      }

      const data = result.data.items.map(toRecord);
      await prisma.flightPlan.createMany({ data });

      // Return recently created items
      const created = await prisma.flightPlan.findMany({
        where: {
          userId,
          folderId: data[0].folderId,
        },
        orderBy: { id: 'desc' },
        take: data.length,
      });

      return NextResponse.json(
        { createdCount: data.length, items: created },
        { status: 201 }
      );
    }

    // Individual create
    const singleSchema = z.object({
      customName: z.string().min(1).max(255),
      status: z.string(),
      fileContent: z.string().min(1),
      folderId: z.number().int().positive().nullable().optional(),
      uplan: z.unknown().nullable().optional(),
      scheduledAt: z.string().nullable().optional(),
      geoawarenessData: z.unknown().nullable().optional(),
    });

    const result = safeParseBody(singleSchema, body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.errors },
        { status: 400 }
      );
    }

    const record = toRecord(result.data);
    await prisma.flightPlan.createMany({ data: [record] });

    // Fetch the created record
    const newPlan = await prisma.flightPlan.findFirst({
      where: {
        customName: record.customName,
        userId,
        folderId: record.folderId,
      },
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(newPlan, { status: 201 });
  } catch (error) {
    console.error('Error creating flight plan:', error);
    return NextResponse.json(
      { error: 'Error creating flight plan' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/flightPlans
 * Update one or multiple flight plans
 * 
 * Single:       { id, data: { status?, customName?, ... } }
 * Bulk uniform: { ids: [1, 2, 3], data: { status: "en cola" } }
 * Bulk items:   { items: [{ id: 1, data: {...} }, { id: 2, data: {...} }] }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Helper to sanitize update data to only allowed fields
  const sanitizeData = (d: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (typeof d.customName === 'string') out.customName = d.customName;
    if (typeof d.status === 'string') out.status = d.status;
    if (typeof d.fileContent === 'string') out.fileContent = d.fileContent;
    if (typeof d.authorizationStatus === 'string') out.authorizationStatus = d.authorizationStatus;
    if (d.authorizationMessage !== undefined) out.authorizationMessage = d.authorizationMessage;
    if (d.uplan !== undefined) {
      // Convert uplan to JSON string for database storage
      out.uplan = d.uplan !== null && d.uplan !== undefined ? JSON.stringify(d.uplan) : null;
    }
    if (d.scheduledAt !== undefined) out.scheduledAt = d.scheduledAt;
    if (typeof d.csvResult === 'number' || d.csvResult === null) out.csvResult = d.csvResult;
    if (typeof d.machineAssignedId === 'number' || d.machineAssignedId === null) out.machineAssignedId = d.machineAssignedId;
    if (typeof d.folderId === 'number' || d.folderId === null) out.folderId = d.folderId;
    // TASK-045: Allow updating geoawarenessData (for storing uspace_identifier)
    if (d.geoawarenessData !== undefined) out.geoawarenessData = d.geoawarenessData;
    return out;
  };

  try {
    const bodyObj = body as Record<string, unknown>;

    // CASE 1: Per-item updates (different data for each plan)
    if (Array.isArray(bodyObj.items) && bodyObj.items.length > 0) {
      const items = bodyObj.items.slice(0, MAX_BULK_ITEMS).filter(
        (it: unknown) => it && typeof it === 'object' && 'id' in it && Number.isFinite(Number((it as Record<string, unknown>).id))
      ) as Array<{ id: number; data: Record<string, unknown> }>;

      if (items.length === 0) {
        return NextResponse.json(
          { error: 'No valid items provided' },
          { status: 400 }
        );
      }

      // Process in chunks to avoid transaction timeouts
      const chunks: typeof items[] = [];
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }

      let total = 0;
      for (const chunk of chunks) {
        const ops = chunk
          .map((it) => {
            const id = Number(it.id);
            const d = sanitizeData(it.data || {});
            if (Object.keys(d).length === 0) return null;
            // Ensure user can only update their own plans
            return prisma.flightPlan.updateMany({
              where: { id, userId },
              data: d,
            });
          })
          .filter(Boolean) as ReturnType<typeof prisma.flightPlan.updateMany>[];

        if (ops.length > 0) {
          const results = await prisma.$transaction(ops);
          total += results.reduce((sum, r) => sum + r.count, 0);
        }
      }

      return NextResponse.json({ count: total });
    }

    // CASE 2: Single update with { id, data }
    if (bodyObj.id !== undefined && bodyObj.data !== undefined) {
      const id = Number(bodyObj.id);
      if (!Number.isFinite(id)) {
        return NextResponse.json(
          { error: 'Invalid id' },
          { status: 400 }
        );
      }

      const updateData = sanitizeData(bodyObj.data as Record<string, unknown>);
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No supported fields in data' },
          { status: 400 }
        );
      }

      // Ensure user can only update their own plans
      const result = await prisma.flightPlan.updateMany({
        where: { id, userId },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json(
          { error: 'Flight plan not found or access denied' },
          { status: 404 }
        );
      }

      const updated = await prisma.flightPlan.findUnique({ where: { id } });
      return NextResponse.json(updated);
    }

    // CASE 3: Bulk uniform update with { ids, data }
    if (Array.isArray(bodyObj.ids) && bodyObj.data !== undefined) {
      const targetIds = (bodyObj.ids as unknown[])
        .slice(0, MAX_BULK_IDS)
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x));

      if (targetIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid ids provided' },
          { status: 400 }
        );
      }

      const updateData = sanitizeData(bodyObj.data as Record<string, unknown>);
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No supported fields in data' },
          { status: 400 }
        );
      }

      // Ensure user can only update their own plans
      const result = await prisma.flightPlan.updateMany({
        where: { id: { in: targetIds }, userId },
        data: updateData,
      });

      return NextResponse.json({ count: result.count });
    }

    return NextResponse.json(
      { error: 'Provide either { id, data }, { ids, data }, or { items }' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating flight plans:', error);
    return NextResponse.json(
      { error: 'Error updating flight plans' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flightPlans
 * Delete one or multiple flight plans (and associated CSV results)
 * 
 * Single: { id: 123 }
 * Bulk:   { ids: [123, 456, 789] }
 * 
 * Note: CSV results are automatically deleted in the same transaction
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const result = safeParseBody(flightPlanDeleteSchema, body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.errors },
      { status: 400 }
    );
  }

  const { id, ids } = result.data;

  // Collect all IDs to delete
  const rawIds: number[] = ids ?? (id !== undefined ? [id] : []);
  const targetIds = rawIds.slice(0, MAX_BULK_IDS).filter((x) => Number.isFinite(x));

  if (targetIds.length === 0) {
    return NextResponse.json(
      { error: 'No valid ids provided' },
      { status: 400 }
    );
  }

  try {
    // First, get the flight plans that belong to this user along with their csvResult IDs
    const userPlans = await prisma.flightPlan.findMany({
      where: {
        id: { in: targetIds },
        userId,
      },
      select: { id: true, csvResult: true, customName: true, authorizationStatus: true, externalResponseNumber: true },
    });

    const userPlanIds = userPlans.map((p) => p.id);

    if (userPlanIds.length === 0) {
      return NextResponse.json(
        { error: 'No flight plans found or access denied' },
        { status: 404 }
      );
    }

    // Send FAS cancellation for approved plans before deleting
    const approvedPlans = userPlans.filter(
      (p) => p.authorizationStatus === 'aprobado' && p.externalResponseNumber
    );
    if (approvedPlans.length > 0) {
      const cancellationResults = await Promise.allSettled(
        approvedPlans.map((p) => sendFasCancellation(p.externalResponseNumber!))
      );
      const failed = cancellationResults.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`[FAS Cancellation] ${failed}/${approvedPlans.length} bulk cancellations failed`);
      }
    }

    // Extract the actual csvResult IDs from the flight plans (filter out nulls)
    const csvResultIds = userPlanIds;

    // Delete in transaction: CSV results first, then flight plans
    const [deletedCsvResult, deletedPlansResult] = await prisma.$transaction([
      prisma.csvResult.deleteMany({ where: { id: { in: csvResultIds } } }),
      prisma.flightPlan.deleteMany({ where: { id: { in: userPlanIds } } }),
    ]);

    const deletedCsvs = deletedCsvResult.count;
    const deletedPlans = deletedPlansResult.count;

    // Log successful deletion
    
    return NextResponse.json({
      deletedPlans,
      deletedCsvs,
      totalDeleted: deletedPlans + deletedCsvs,
      message: `Successfully deleted ${deletedPlans} flight plans and ${deletedCsvs} CSV results`,
    });
  } catch (error) {
    console.error('Error deleting flight plans:', error);
    return NextResponse.json(
      { error: 'Error deleting flight plans' },
      { status: 500 }
    );
  }
}
