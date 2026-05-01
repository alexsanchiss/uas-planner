/**
 * Accept Alternative API
 *
 * POST /api/flightPlans/[id]/accept-alternative
 *
 * Accepts the alternative trajectory proposed by the SCRS (Segmented Conflict
 * Resolution System) when a flight plan has been denied by the FAS.
 *
 * This endpoint:
 * 1. Validates the plan is denied and has an SCRS alternative
 * 2. Builds new waypoints from the alternative route
 * 3. Regenerates the fileContent (QGC .plan format)
 * 4. Updates the uplan with the new waypoints (clears operationVolumes)
 * 5. Resets the plan to "sin procesar" for reprocessing
 *
 * Authentication: Bearer token required (JWT)
 * Authorization:  User can only accept alternatives for their own plans
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, isAuthError } from '@/lib/auth-middleware';
import { parseScrsAlternative } from '@/lib/scrs';
import { buildQgcPlan, QgcWaypoint } from '@/lib/qgc-plan';

/**
 * Params type for dynamic route (Next.js 15 App Router)
 */
interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Parse and validate the flight plan ID from route params.
 */
function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * POST /api/flightPlans/[id]/accept-alternative
 *
 * Accepts the SCRS-proposed alternative trajectory for a denied flight plan
 * and resets the plan for reprocessing with the new waypoints.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // 1. Authenticate
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return auth;
  }

  const { userId } = auth;
  const { id: idParam } = await params;
  const id = parseId(idParam);

  if (id === null) {
    return NextResponse.json(
      { error: 'Invalid flight plan ID' },
      { status: 400 }
    );
  }

  try {
    // 2. Load the flight plan
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id },
    });

    // 3. Existence and ownership checks
    if (!flightPlan) {
      return NextResponse.json(
        { error: 'Plan de vuelo no encontrado' },
        { status: 404 }
      );
    }

    if (flightPlan.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 4. Validate the plan is in denied status
    if (flightPlan.authorizationStatus !== 'denegado') {
      return NextResponse.json(
        {
          error: `Cannot accept an alternative for a plan with status "${flightPlan.authorizationStatus}". Plan must be denied ("denegado").`,
        },
        { status: 400 }
      );
    }

    // 5. Parse the SCRS alternative from the authorization message
    const alternative = parseScrsAlternative(flightPlan.authorizationMessage);
    if (!alternative) {
      return NextResponse.json(
        { error: 'No SCRS alternative available for this plan' },
        { status: 400 }
      );
    }

    const { flatWaypoints } = alternative;

    // 6. Build QGC waypoints
    // Cruise altitude is taken from the first waypoint (all share the same alt)
    const cruiseAlt = flatWaypoints[0].alt;
    const last = flatWaypoints[flatWaypoints.length - 1];

    // Map scrs waypoints (lat/lon) to QgcWaypoint (lat/lng), preserving cruise altitude
    const qgcWaypoints: QgcWaypoint[] = flatWaypoints.map((wp) => ({
      lat: wp.lat,
      lng: wp.lon,
      alt: wp.alt,
    }));

    // Ensure the last waypoint has altitude 0 (landing)
    // We replace the last entry or append a landing waypoint if it differs
    if (qgcWaypoints[qgcWaypoints.length - 1].alt !== 0) {
      qgcWaypoints.push({
        lat: last.lat,
        lng: last.lon,
        alt: 0,
      });
    } else {
      qgcWaypoints[qgcWaypoints.length - 1].alt = 0;
    }

    // 7. Regenerate fileContent (QGC .plan JSON)
    const newFileContent = JSON.stringify(buildQgcPlan(qgcWaypoints));

    // 8. Update the uplan: replace waypoints and clear operationVolumes
    let updatedUplanString: string | null = null;
    if (flightPlan.uplan) {
      try {
        const currentUplan =
          typeof flightPlan.uplan === 'string'
            ? JSON.parse(flightPlan.uplan)
            : flightPlan.uplan;

        if (currentUplan && typeof currentUplan === 'object') {
          const uplan = currentUplan as Record<string, unknown>;

          // Build new waypoints in uplan format: {time, lat, lon, h}
          const newUplanWaypoints = flatWaypoints.map((wp, index) => ({
            time: index,
            lat: wp.lat,
            lon: wp.lon,
            h: wp.alt,
          }));
          // Add landing waypoint at altitude 0
          newUplanWaypoints.push({
            time: flatWaypoints.length,
            lat: last.lat,
            lon: last.lon,
            h: 0,
          });

          // Preserve all existing flightDetails fields except waypoints
          const existingFlightDetails =
            (uplan.flightDetails as Record<string, unknown> | undefined) ?? {};
          const { waypoints: _oldWaypoints, ...restFlightDetails } =
            existingFlightDetails;
          void _oldWaypoints; // intentionally discarded

          const updatedUplan = {
            ...uplan,
            flightDetails: {
              ...restFlightDetails,
              waypoints: newUplanWaypoints,
            },
            operationVolumes: [],
          };

          updatedUplanString = JSON.stringify(updatedUplan);
        }
      } catch (parseError) {
        console.warn('[accept-alternative] Failed to parse/update uplan:', parseError);
        // Continue without updating uplan rather than failing the whole request
        updatedUplanString = null;
      }
    } else {
      // No existing uplan — create a minimal one with the new waypoints
      const newUplanWaypoints = flatWaypoints.map((wp, index) => ({
        time: index,
        lat: wp.lat,
        lon: wp.lon,
        h: wp.alt,
      }));
      newUplanWaypoints.push({
        time: flatWaypoints.length,
        lat: last.lat,
        lon: last.lon,
        h: 0,
      });

      updatedUplanString = JSON.stringify({
        flightDetails: { waypoints: newUplanWaypoints },
        operationVolumes: [],
      });
    }

    // 9. Persist changes in a single transaction
    const [, updatedPlan] = await prisma.$transaction([
      // Delete associated CSV result (if exists) — same PK as flightPlan (1:1)
      prisma.csvResult.deleteMany({ where: { id } }),
      // Reset the flight plan for reprocessing with the new alternative waypoints
      prisma.flightPlan.update({
        where: { id },
        data: {
          fileContent: newFileContent,
          uplan: updatedUplanString,
          status: 'sin procesar',
          csvResult: null,
          authorizationStatus: 'sin autorización',
          authorizationMessage: null,
          externalResponseNumber: null,
          machineAssignedId: null,
        },
        include: { folder: true },
      }),
    ]);

    // NOTE: No FAS cancellation needed — the plan was denied, not approved.
    // NOTE: No deletion email needed — the plan was denied, not approved.

    return NextResponse.json({ flightPlan: updatedPlan });
  } catch (error) {
    console.error('[accept-alternative] Error:', error);
    return NextResponse.json(
      { error: 'Error al aceptar la alternativa' },
      { status: 500 }
    );
  }
}
