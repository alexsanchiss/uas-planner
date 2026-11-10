/**
 * PUT /api/flightPlans/simulation
 * Set the simulation settings (airframe + wind) of a set of the caller's plans.
 *
 * Body: { ids: number[], airframe: 'multirotor'|'fixedwing', wind: null | { speed, direction, gust? } }
 * 200 { updated }, 400 validation, 404 any id not the caller's,
 * 409 { error, ids } when some plan is not editable (status not 'sin procesar'/'error', or authorization approved/pending).
 * Static segment: Next.js resolves it before the sibling dynamic `[id]` route.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { AUTH_LOCKED_STATUSES, safeParseBody, simulationUpdateSchema } from '@/lib/validators';

/** Statuses in which the runner is not (and will not soon be) using the plan's settings. */
const EDITABLE_STATUSES = ['sin procesar', 'error'];

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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = safeParseBody(simulationUpdateSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.errors }, { status: 400 });
  }
  const { ids, airframe, wind } = parsed.data;

  try {
    const plans = await prisma.flightPlan.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, status: true, authorizationStatus: true },
    });
    if (plans.length !== ids.length) {
      return NextResponse.json({ error: 'Flight plan not found' }, { status: 404 });
    }

    const notEditable = plans
      .filter((p) => !EDITABLE_STATUSES.includes(p.status) || AUTH_LOCKED_STATUSES.includes(p.authorizationStatus))
      .map((p) => p.id);
    if (notEditable.length > 0) {
      return NextResponse.json({ error: 'Some plans cannot be edited', ids: notEditable }, { status: 409 });
    }

    // Same conditions in the WHERE: a plan queued between the check and the write is left untouched.
    const result = await prisma.flightPlan.updateMany({
      where: {
        id: { in: ids },
        userId,
        status: { in: EDITABLE_STATUSES },
        authorizationStatus: { notIn: AUTH_LOCKED_STATUSES },
      },
      data: {
        simAirframe: airframe,
        windSpeed: wind ? wind.speed : null,
        windDirection: wind ? wind.direction % 360 : null,
        windGust: wind ? (wind.gust ?? null) : null,
      },
    });
    if (result.count !== ids.length) {
      return NextResponse.json({ error: 'Some plans changed state, retry' }, { status: 409 });
    }
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('Error updating simulation settings:', error);
    return NextResponse.json({ error: 'Error updating simulation settings' }, { status: 500 });
  }
}
