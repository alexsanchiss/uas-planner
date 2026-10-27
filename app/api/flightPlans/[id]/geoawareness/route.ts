import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth, isAuthError } from '@/lib/auth-middleware'

/**
 * POST /api/flightPlans/[id]/geoawareness
 * 
 * Validates flight plan has U-Space data and returns uspaceIdentifier for WebSocket connection.
 * Requires authentication and ownership of the plan. The internal service address is
 * deliberately NOT returned (the client connects through /api/geoawareness/stream).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) {
    return auth
  }

  try {
    const { id } = await params;
    const planId = parseInt(id, 10)
    
    if (isNaN(planId)) {
      return NextResponse.json({ error: 'Invalid flight plan ID' }, { status: 400 })
    }

    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: { id: true, userId: true, customName: true, uplan: true, geoawarenessData: true },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Flight plan not found' }, { status: 404 });
    }

    if (plan.userId !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!plan.uplan) {
      return NextResponse.json({ error: 'Flight plan has no U-Plan data. Process the plan first.' }, { status: 400 });
    }

    if (!plan.geoawarenessData) {
      return NextResponse.json({ error: 'Flight plan has no U-Space data. Ensure plan was created with U-Space selected.' }, { status: 400 });
    }

    // Parse geoawarenessData to extract uspaceIdentifier
    let uspaceIdentifier: string;
    try {
      const geoData = typeof plan.geoawarenessData === 'string' 
        ? JSON.parse(plan.geoawarenessData) 
        : plan.geoawarenessData;
      uspaceIdentifier = geoData.uspace_identifier;
    } catch {
      return NextResponse.json({ error: 'Invalid geoawareness data format.' }, { status: 500 });
    }

    if (!uspaceIdentifier) {
      return NextResponse.json({ error: 'No U-Space identifier in flight plan.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      uspaceIdentifier,
    });

  } catch (error) {
    console.error('[Geoawareness API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/flightPlans/[id]/geoawareness
 * 
 * Returns the stored geoawareness response for a flight plan.
 * Requires authentication and ownership of the plan.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth(request)
  if (isAuthError(auth)) {
    return auth
  }

  try {
    const { id } = await params;
    const planId = parseInt(id, 10)
    
    if (isNaN(planId)) {
      return NextResponse.json({ error: 'Invalid flight plan ID' }, { status: 400 })
    }

    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: { id: true, userId: true, customName: true, geoawarenessData: true },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Flight plan not found' }, { status: 404 })
    }

    if (plan.userId !== auth.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!plan.geoawarenessData) {
      return NextResponse.json({ error: 'No geoawareness data available for this flight plan' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      planId: plan.id,
      planName: plan.customName,
      geoawareness: plan.geoawarenessData,
    })

  } catch (error) {
    console.error('[Geoawareness] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
