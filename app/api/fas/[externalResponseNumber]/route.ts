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

    // Parse request body
    let body: { state?: string; message?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { state, message } = body;

    // Validate required fields
    if (!state) {
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
      return NextResponse.json(
        { error: "FlightPlan not found" },
        { status: 404 }
      );
    }

    // Update authorization status and message
    await prisma.flightPlan.update({
      where: { id: flightPlan.id },
      data: {
        authorizationStatus: state === "ACCEPTED" ? "aprobado" : "denegado",
        authorizationMessage: message ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in FAS PUT callback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
