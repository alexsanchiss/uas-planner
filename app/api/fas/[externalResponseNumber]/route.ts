import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

/**
 * FAS Callback Endpoint
 * 
 * This endpoint is called by the external FAS (Flight Authorization Service) 
 * to update the authorization status of a flight plan.
 * 
 * NOTE: This endpoint does NOT require JWT authentication as it is called
 * by an external service, not by authenticated users.
 * 
 * NOTE: Uses a fresh PrismaClient instance to avoid any connection pooling
 * or caching issues that might prevent updates from persisting.
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
  // Create a fresh Prisma client for this request to avoid any connection issues
  const prisma = new PrismaClient();
  const timestamp = new Date().toISOString();
  
  try {
    const { externalResponseNumber } = await params;
    console.log(`[FAS Callback ${timestamp}] Received PUT for:`, externalResponseNumber);

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      console.log(`[FAS Callback ${timestamp}] Request body:`, JSON.stringify(body));
    } catch {
      console.error(`[FAS Callback ${timestamp}] Invalid JSON body`);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { state, ...restOfBody } = body;

    // Validate required fields
    if (!state) {
      console.error(`[FAS Callback ${timestamp}] Missing state field`);
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
      console.error(`[FAS Callback ${timestamp}] FlightPlan not found:`, externalResponseNumber);
      return NextResponse.json(
        { error: "FlightPlan not found" },
        { status: 404 }
      );
    }

    console.log(`[FAS Callback ${timestamp}] Found flightPlan id:`, flightPlan.id);
    console.log(`[FAS Callback ${timestamp}] BEFORE update - status:`, flightPlan.authorizationStatus, 'message:', flightPlan.authorizationMessage);

    // Update authorization status and message
    // Store the entire body (minus state) as the authorization message
    const authMessage = Object.keys(restOfBody).length > 0
      ? JSON.stringify(restOfBody)
      : null;
    
    const newStatus = state === "ACCEPTED" ? "aprobado" : "denegado";
    console.log(`[FAS Callback ${timestamp}] Updating to - status:`, newStatus, 'message:', authMessage);
    
    // Use $executeRaw for direct SQL to bypass any ORM caching
    const updateResult = await prisma.$executeRaw`
      UPDATE flightplan 
      SET authorizationStatus = ${newStatus}, 
          authorizationMessage = ${authMessage}
      WHERE id = ${flightPlan.id}
    `;
    
    console.log(`[FAS Callback ${timestamp}] Raw SQL update affected rows:`, updateResult);
    
    // Verify with raw SQL query
    const verifyResult = await prisma.$queryRaw<Array<{id: number, authorizationStatus: string, authorizationMessage: string | null}>>`
      SELECT id, authorizationStatus, authorizationMessage 
      FROM flightplan 
      WHERE id = ${flightPlan.id}
    `;
    
    console.log(`[FAS Callback ${timestamp}] AFTER update verification (raw SQL):`, JSON.stringify(verifyResult));

    console.log(`[FAS Callback ${timestamp}] Successfully updated flightPlan:`, flightPlan.id);
    return NextResponse.json({ 
      success: true, 
      updatedRows: updateResult,
      verification: verifyResult[0] || null
    });
  } catch (error) {
    console.error(`[FAS Callback ${timestamp}] Error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    // Always disconnect to clean up
    await prisma.$disconnect();
  }
}
