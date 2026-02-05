import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * POST /api/flightPlans/[id]/geoawareness
 * 
 * Validates flight plan has U-Space data and returns uspaceIdentifier for WebSocket connection.
 * WebSocket URL: ws://{IP}/ws/gas/{uspaceIdentifier}
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const planId = parseInt(id, 10)
    
    if (isNaN(planId)) {
      return NextResponse.json({ error: 'Invalid flight plan ID' }, { status: 400 })
    }

    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: { id: true, customName: true, uplan: true, geoawarenessData: true },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Flight plan not found' }, { status: 404 });
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

    const wsUrl = `ws://${process.env.GEOAWARENESS_SERVICE_IP}/ws/gas/${uspaceIdentifier}`;

    return NextResponse.json({
      success: true,
      uspaceIdentifier,
      wsUrl,
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
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const planId = parseInt(id, 10)
    
    if (isNaN(planId)) {
      return NextResponse.json({ error: 'Invalid flight plan ID' }, { status: 400 })
    }

    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: { id: true, customName: true, geoawarenessData: true },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Flight plan not found' }, { status: 404 })
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
