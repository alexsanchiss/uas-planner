import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * FAS Callback Endpoint
 * 
 * This endpoint is called by the external FAS (Flight Authorization Service) 
 * to update the authorization status of a flight plan.
 * 
 * NOTE: This endpoint does NOT require JWT authentication as it is called
 * by an external service, not by authenticated users.
 */

interface RouteParams {
  params: Promise<{ externalResponseNumber: string }>;
}

/**
 * PUT /api/fas/[externalResponseNumber]
 * Updates flight plan authorization status from FAS callback
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { externalResponseNumber } = await params;
    console.log('[FAS Callback] Received PUT for:', externalResponseNumber);

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      console.log('[FAS Callback] Request body:', JSON.stringify(body));
    } catch {
      console.error('[FAS Callback] Invalid JSON body');
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { state, ...restOfBody } = body;

    // Validate required fields
    if (!state) {
      console.error('[FAS Callback] Missing state field');
      return NextResponse.json(
        { error: "Missing required field: state" },
        { status: 400 }
      );
    }

    // Find the flight plan by externalResponseNumber
    const flightPlan = await prisma.flightPlan.findFirst({
      where: { externalResponseNumber },
    });

    if (!flightPlan) {
      console.error('[FAS Callback] FlightPlan not found:', externalResponseNumber);
      return NextResponse.json(
        { error: "FlightPlan not found" },
        { status: 404 }
      );
    }

    console.log('[FAS Callback] Found flightPlan id:', flightPlan.id);

    // Update authorization status and message
    // Store the entire body (minus state) as the authorization message
    const authMessage = Object.keys(restOfBody).length > 0
      ? JSON.stringify(restOfBody)
      : null;
    
    const newStatus = state === "ACCEPTED" ? "aprobado" : "denegado";
    console.log('[FAS Callback] Updating status to:', newStatus, 'message:', authMessage);
    
    await prisma.flightPlan.update({
      where: { id: flightPlan.id },
      data: {
        authorizationStatus: newStatus,
        authorizationMessage: authMessage,
      },
    });

    console.log('[FAS Callback] Successfully updated flightPlan:', flightPlan.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in FAS PUT callback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
