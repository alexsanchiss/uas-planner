import { NextRequest, NextResponse } from 'next/server';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { idSchema, csvResultBulkFetchSchema, csvResultDeleteSchema } from '@/lib/validators';
import prisma from '@/lib/prisma';

/**
 * Ownership: csvResult.id == flightPlan.id, so a CSV belongs to the caller only if
 * a flight plan with that id has userId == caller. Returns the owned subset of ids.
 */
async function ownedPlanIds(userId: number, ids: number[]): Promise<number[]> {
  const plans = await prisma.flightPlan.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  });
  return plans.map((p) => p.id);
}

/**
 * GET /api/csvResult?id=123
 * 
 * Fetch a single CSV result by ID.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  if (!idParam) {
    return NextResponse.json(
      { error: 'ID parameter required for GET' },
      { status: 400 }
    );
  }

  const idResult = idSchema.safeParse(idParam);
  if (!idResult.success) {
    return NextResponse.json(
      { error: 'Invalid ID format', details: idResult.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const [ownedId] = await ownedPlanIds(userId, [idResult.data]);
    const csvResult = ownedId === undefined
      ? null
      : await prisma.csvResult.findUnique({ where: { id: ownedId } });

    if (!csvResult) {
      return NextResponse.json(
        { error: 'CSV no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ csvResult: csvResult.csvResult });
  } catch (error) {
    console.error('Error fetching individual CSV:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/csvResult
 * 
 * Bulk fetch CSV results with plan names.
 * Body: { ids: [123, 456, 789] }
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
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

  const parseResult = csvResultBulkFetchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'ids[] is required', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { ids } = parseResult.data;

  try {
    // Only the caller's plans (ownership), then their CSV content
    const plans = await prisma.flightPlan.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, customName: true },
    });
    const csvs = await prisma.csvResult.findMany({
      where: { id: { in: plans.map((p) => p.id) } },
      select: { id: true, csvResult: true },
    });

    // MERGE DATA: Combine plan names with CSV content
    const nameById = new Map<number, string>(plans.map((p) => [p.id, p.customName]));
    const items = csvs
      .map((c) => ({
        id: c.id,
        customName: nameById.get(c.id) || `plan_${c.id}`,
        csvResult: c.csvResult as unknown as string,
      }))
      .filter((it) => typeof it.csvResult === 'string');

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error bulk fetching CSV results:', error);
    return NextResponse.json(
      { error: 'Error fetching CSV results' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/csvResult
 * 
 * Delete CSV results (individual or bulk).
 * Body: { id: 123 } or { ids: [123, 456, 789] }
 * Requires authentication.
 */
export async function DELETE(request: NextRequest) {
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

  const parseResult = csvResultDeleteSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'id or ids[] required for DELETE', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { id, ids } = parseResult.data;

  try {
    if (id !== undefined) {
      // INDIVIDUAL CSV DELETION: Remove single CSV result
      const [ownedId] = await ownedPlanIds(userId, [id]);
      if (ownedId === undefined) {
        return NextResponse.json({ error: 'CSV no encontrado' }, { status: 404 });
      }
      await prisma.csvResult.delete({
        where: { id: ownedId },
      });
      return new NextResponse(null, { status: 204 });
    }

    if (ids && ids.length > 0) {
      // BULK CSV DELETION: Remove multiple CSV results
      const result = await prisma.csvResult.deleteMany({
        where: { id: { in: await ownedPlanIds(userId, ids) } },
      });
      return NextResponse.json({ deletedCount: result.count });
    }

    return NextResponse.json(
      { error: 'id or ids[] required for DELETE' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting CSV results:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
