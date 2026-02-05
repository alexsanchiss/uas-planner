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

    const { state, message } = body;

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

    // Determine new status based on FAS response
    const newStatus = state === "ACCEPTED" ? "aprobado" : "denegado";
    const authMessage = typeof message === 'string' ? message : (message ? JSON.stringify(message) : null);

    console.log('[FAS Callback] BEFORE UPDATE - id:', flightPlan.id, 'oldStatus:', flightPlan.authorizationStatus, 'oldMessage:', flightPlan.authorizationMessage);
    console.log('[FAS Callback] UPDATE DATA - newStatus:', newStatus, 'newMessage:', authMessage);

    // Update using Prisma ORM with explicit transaction
    const updatedPlan = await prisma.$transaction(async (tx) => {
      const updated = await tx.flightPlan.update({
        where: { id: flightPlan.id },
        data: {
          authorizationStatus: newStatus,
          authorizationMessage: authMessage,
        },
      });
      
      console.log('[FAS Callback] TRANSACTION UPDATE RESULT - id:', updated.id, 'status:', updated.authorizationStatus, 'message:', updated.authorizationMessage);
      
      // Verify immediately within the same transaction
      const verified = await tx.flightPlan.findUnique({
        where: { id: flightPlan.id },
        select: { id: true, authorizationStatus: true, authorizationMessage: true }
      });
      
      console.log('[FAS Callback] TRANSACTION VERIFICATION - id:', verified?.id, 'status:', verified?.authorizationStatus, 'message:', verified?.authorizationMessage);
      
      return updated;
    });

    console.log('[FAS Callback] FINAL RESULT - Successfully updated flightPlan:', updatedPlan.id, 'finalStatus:', updatedPlan.authorizationStatus);
    return NextResponse.json({ 
      success: true, 
      id: updatedPlan.id,
      authorizationStatus: updatedPlan.authorizationStatus,
      authorizationMessage: updatedPlan.authorizationMessage
    });
  } catch (error) {
    console.error('[FAS Callback] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
