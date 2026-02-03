import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * POST /api/flightPlans/[id]/geoawareness
 * 
 * NOTE: This endpoint NO LONGER calls the geoawareness service directly via HTTP POST.
 * The geoawareness service ONLY works via WebSocket connection.
 * 
 * This endpoint now simply:
 * 1. Validates the flight plan has the required data
 * 2. Returns the uspaceIdentifier for WebSocket connection
 * 3. The client (GeoawarenessViewer) connects via WebSocket using useGeoawarenessWebSocket
 * 
 * WebSocket URL format: ws://{NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP}/{GEOAWARENESS_ENDPOINT}{uspaceIdentifier}
 * Example: ws://sna-server.upvnet.upv.es:8002/ws/gas/VLCUspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const logPrefix = '[Geoawareness API]';
  
  try {
    const planId = parseInt(params.id, 10)
    
    console.log(`${logPrefix} 🔍 POST request for plan ID: ${planId}`);
    
    if (isNaN(planId)) {
      console.error(`${logPrefix} ❌ Invalid plan ID provided`);
      return NextResponse.json(
        { error: 'Invalid flight plan ID' },
        { status: 400 }
      )
    }

    console.log(`${logPrefix} 📊 Fetching flight plan from database...`);
    
    // Get the flight plan with its U-Plan and geoawarenessData
    const plan = await prisma.flightPlan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        customName: true,
        uplan: true,
        geoawarenessData: true,
      },
    });

    if (!plan) {
      console.error(`${logPrefix} ❌ Flight plan not found in database`);
      return NextResponse.json(
        { error: 'Flight plan not found' },
        { status: 404 }
      );
    }

    console.log(`${logPrefix} ✅ Found plan: "${plan.customName}" (ID: ${plan.id})`);

    if (!plan.uplan) {
      console.error(`${logPrefix} ❌ Plan has no U-Plan data`);
      return NextResponse.json(
        { error: 'Flight plan has no U-Plan data. Process the plan first.' },
        { status: 400 }
      );
    }

    console.log(`${logPrefix} ✅ U-Plan data exists`);

    if (!plan.geoawarenessData) {
      console.error(`${logPrefix} ❌ Plan has no geoawareness data (no U-Space identifier)`);
      return NextResponse.json(
        { error: 'Flight plan has no geoawareness data. Please ensure the plan was created with a U-Space selected.' },
        { status: 400 }
      );
    }

    console.log(`${logPrefix} ✅ Geoawareness data exists, extracting U-Space identifier...`);

    // Parse geoawarenessData to extract uspaceIdentifier
    let uspaceIdentifier: string;
    try {
      const geoawarenessData = typeof plan.geoawarenessData === 'string' 
        ? JSON.parse(plan.geoawarenessData) 
        : plan.geoawarenessData;
      
      uspaceIdentifier = geoawarenessData.uspace_identifier;
      
      console.log(`${logPrefix} 📍 Extracted U-Space identifier: "${uspaceIdentifier}"`);
      console.log(`${logPrefix} 📋 Full geoawareness data:`, JSON.stringify(geoawarenessData, null, 2));
    } catch (error) {
      console.error(`${logPrefix} ❌ Failed to parse geoawarenessData:`, error);
      return NextResponse.json(
        { error: 'Invalid geoawareness data format in flight plan.' },
        { status: 500 }
      );
    }

    if (!uspaceIdentifier) {
      console.error(`${logPrefix} ❌ No uspace_identifier found in geoawarenessData`);
      return NextResponse.json(
        { error: 'Flight plan has no U-Space identifier in geoawareness data.' },
        { status: 400 }
      );
    }

    // Parse U-Plan if it's a string
    const uplan = typeof plan.uplan === 'string' ? JSON.parse(plan.uplan) : plan.uplan;

    // Check if operationVolumes exist
    if (!uplan.operationVolumes || !Array.isArray(uplan.operationVolumes)) {
      console.error(`${logPrefix} ❌ U-Plan has no operation volumes`);
      return NextResponse.json(
        { error: 'U-Plan has no operation volumes' },
        { status: 400 }
      );
    }

    const volumeCount = uplan.operationVolumes.length;
    console.log(`${logPrefix} ✅ U-Plan has ${volumeCount} operation volume(s)`);

    // Get WebSocket configuration
    const serviceIp = process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP;
    const endpoint = process.env.GEOAWARENESS_ENDPOINT || 'ws/gas/';

    if (!serviceIp) {
      console.error(`${logPrefix} ❌ NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP not configured in environment`);
      return NextResponse.json(
        { error: 'Geoawareness service not configured' },
        { status: 503 }
      );
    }

    // Construct WebSocket URL for reference
    const wsUrl = `ws://${serviceIp}/${endpoint}${uspaceIdentifier}`;
    
    console.log(`${logPrefix} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${logPrefix} 🎯 GEOAWARENESS CONNECTION INFO:`);
    console.log(`${logPrefix} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${logPrefix} 📡 Service IP: ${serviceIp}`);
    console.log(`${logPrefix} 🔗 Endpoint: ${endpoint}`);
    console.log(`${logPrefix} 🆔 U-Space ID: ${uspaceIdentifier}`);
    console.log(`${logPrefix} 🌐 WebSocket URL: ${wsUrl}`);
    console.log(`${logPrefix} 📦 Operation Volumes: ${volumeCount}`);
    console.log(`${logPrefix} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${logPrefix} 💡 NOTE: Geoawareness data will be fetched via WebSocket`);
    console.log(`${logPrefix} 💡 The client should connect using useGeoawarenessWebSocket hook`);
    console.log(`${logPrefix} 💡 HTTP POST to geoawareness service is DEPRECATED and NO LONGER WORKS`);
    console.log(`${logPrefix} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Return validation success with WebSocket connection info
    return NextResponse.json({
      success: true,
      message: 'Flight plan validated. Connect via WebSocket to receive geoawareness data.',
      uspaceIdentifier: uspaceIdentifier,
      wsUrl: wsUrl,
      operationVolumesCount: volumeCount,
      // No longer calling HTTP endpoint - WebSocket only
      deprecated_http_note: 'HTTP POST to geoawareness service no longer works. Use WebSocket connection instead.',
    });

  } catch (error) {
    console.error('[Geoawareness API] ❌ Internal error:', error)
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
