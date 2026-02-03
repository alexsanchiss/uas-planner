import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * POST /api/flightPlans/[id]/geoawareness
 * 
 * Calls the geoawareness service with the flight plan's U-Plan data
 * and stores the response in the database.
 * 
 * The geoawareness service expects the U-Plan operationVolumes and returns
 * a GeoJSON FeatureCollection with geozones that intersect the operation volumes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const planId = parseInt(params.id, 10)
    
    if (isNaN(planId)) {
      return NextResponse.json(
        { error: 'Invalid flight plan ID' },
        { status: 400 }
      )
    }

    // Get the flight plan with its U-Plan and geoawarenessData
    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: {
        uplan: true,
        geoawarenessData: true, // Include geoawarenessData to extract uspaceIdentifier
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Flight plan not found' },
        { status: 404 }
      );
    }

    if (!plan.uplan) {
      return NextResponse.json(
        { error: 'Flight plan has no U-Plan data. Process the plan first.' },
        { status: 400 }
      );
    }

    if (!plan.geoawarenessData) {
      return NextResponse.json(
        { error: 'Flight plan has no geoawareness data. Please ensure the plan is processed correctly.' },
        { status: 400 }
      );
    }

    // Parse geoawarenessData to extract uspaceIdentifier
    let uspaceIdentifier;
    try {
      const geoawarenessData = typeof plan.geoawarenessData === 'string' 
        ? JSON.parse(plan.geoawarenessData) 
        : plan.geoawarenessData;
      uspaceIdentifier = geoawarenessData.uspace_identifier;
    } catch (error) {
      console.error('[Geoawareness] Failed to parse geoawarenessData:', error);
      return NextResponse.json(
        { error: 'Invalid geoawareness data format in flight plan.' },
        { status: 500 }
      );
    }

    if (!uspaceIdentifier) {
      return NextResponse.json(
        { error: 'Flight plan has no U-Space identifier in geoawareness data.' },
        { status: 400 }
      );
    }

    // Parse U-Plan if it's a string
    const uplan = typeof plan.uplan === 'string' ? JSON.parse(plan.uplan) : plan.uplan;

    // Check if operationVolumes exist
    if (!uplan.operationVolumes || !Array.isArray(uplan.operationVolumes)) {
      return NextResponse.json(
        { error: 'U-Plan has no operation volumes' },
        { status: 400 }
      );
    }

    // Get geoawareness service configuration
    // Use NEXT_PUBLIC_ variable as unified geoawareness service IP
    const serviceIp = process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP;
    const endpoint = process.env.GEOAWARENESS_ENDPOINT || 'geozones_searcher_by_volumes';

    if (!serviceIp) {
      return NextResponse.json(
        { error: 'Geoawareness service not configured' },
        { status: 503 }
      );
    }

    // Call the geoawareness service with the U-Space identifier
    const serviceUrl = `http://${serviceIp}/${endpoint}${uspaceIdentifier}`;

    console.log(`[Geoawareness] Calling service at: ${serviceUrl}`);

    try {
      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationVolumes: uplan.operationVolumes,
        }),
        // Timeout after 30 seconds
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Geoawareness] Service returned error: ${response.status} - ${errorText}`);
        return NextResponse.json(
          { error: `Geoawareness service error: ${response.status}` },
          { status: 502 }
        );
      }

      const geoawarenessData = await response.json();

      console.log(`[Geoawareness] Received response with ${geoawarenessData.features?.length || 0} features`);

      // Store the response in the database
      await prisma.flightPlan.update({
        where: { id: planId },
        data: {
          geoawarenessData: geoawarenessData,
        },
      });

      return NextResponse.json({
        success: true,
        geoawareness: geoawarenessData,
        featuresCount: geoawarenessData.features?.length || 0,
      });

    } catch (fetchError) {
      console.error('[Geoawareness] Failed to connect to service:', fetchError);

      // Check if it's a timeout
      if (fetchError instanceof Error && fetchError.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Geoawareness service timeout. The service may be slow or unavailable.' },
          { status: 504 }
        );
      }

      // Network error
      return NextResponse.json(
        { error: 'Failed to connect to geoawareness service. Please check if the service is running.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('[Geoawareness] Internal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/flightPlans/[id]/geoawareness
 * 
 * Returns the stored geoawareness response for a flight plan.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const planId = parseInt(params.id, 10)
    
    if (isNaN(planId)) {
      return NextResponse.json(
        { error: 'Invalid flight plan ID' },
        { status: 400 }
      )
    }

    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        customName: true,
        geoawarenessData: true,
      },
    })

    if (!plan) {
      return NextResponse.json(
        { error: 'Flight plan not found' },
        { status: 404 }
      )
    }

    if (!plan.geoawarenessData) {
      return NextResponse.json(
        { error: 'No geoawareness data available for this flight plan' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      planId: plan.id,
      planName: plan.customName,
      geoawareness: plan.geoawarenessData,
    })

  } catch (error) {
    console.error('[Geoawareness] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
