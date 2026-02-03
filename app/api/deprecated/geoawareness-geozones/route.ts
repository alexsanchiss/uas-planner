import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated This endpoint is deprecated and kept only as a fallback for useGeoawarenessWebSocket.
 * 
 * CRITICAL: The geoawareness service ONLY works via WebSocket at ws://{IP}/ws/gas/{uspaceId}
 * HTTP protocol (geozones_searcher_by_volumes) is NO LONGER SUPPORTED and returns 404.
 * 
 * This endpoint now returns fallback geozones directly without attempting any HTTP connection
 * to the geoawareness service. It provides static test data for Valencia area.
 * 
 * The primary connection method is WebSocket via useGeoawarenessWebSocket hook.
 * This fallback endpoint is only called when WebSocket connection fails after max retries.
 * 
 * TASK-095: Moved from /api/geoawareness/geozones to /api/deprecated/geoawareness-geozones
 * Updated: Removed HTTP calls to defunct geozones_searcher_by_volumes endpoint
 */

/**
 * Geozone geometry structure
 */
interface GeozoneGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

/**
 * Geozone data structure
 */
interface GeozoneData {
  uas_geozones_identifier: string;
  geometry: GeozoneGeometry;
  properties: Record<string, unknown>;
}

/**
 * Fallback geozones for Valencia area (WGS84 coordinates)
 */
const FALLBACK_GEOZONES: GeozoneData[] = [
  {
    uas_geozones_identifier: 'ESVC-1',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3584, 39.4742],
        [-0.3607, 39.4746],
        [-0.3596, 39.4771],
        [-0.3576, 39.4765],
        [-0.3584, 39.4742],
      ]],
    },
    properties: {
      name: 'Mestalla geozone/Geozona Mestalla',
      type: 'CONDITIONAL',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-1',
    },
  },
  {
    uas_geozones_identifier: 'ESVC-2',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3179, 39.4199],
        [-0.3125, 39.4232],
        [-0.3091, 39.4297],
        [-0.3027, 39.4333],
        [-0.2915, 39.4435],
        [-0.2860, 39.4546],
        [-0.3088, 39.4627],
        [-0.3200, 39.4628],
        [-0.3299, 39.4616],
        [-0.3330, 39.4603],
        [-0.3303, 39.4555],
        [-0.3282, 39.4546],
        [-0.3287, 39.4510],
        [-0.3263, 39.4496],
        [-0.3258, 39.4441],
        [-0.3275, 39.4422],
        [-0.3313, 39.4418],
        [-0.3341, 39.4386],
        [-0.3384, 39.4384],
        [-0.3418, 39.4289],
        [-0.3179, 39.4199],
      ]],
    },
    properties: {
      name: 'Geozona Puerto València/Valencia Port geozone',
      type: 'CONDITIONAL',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-2',
    },
  },
  {
    uas_geozones_identifier: 'ESVC-3',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3266, 39.4601],
        [-0.3237, 39.4602],
        [-0.3285, 39.4922],
        [-0.3303, 39.4922],
        [-0.3296, 39.4904],
        [-0.3295, 39.4813],
        [-0.3291, 39.4807],
        [-0.3282, 39.4650],
        [-0.3276, 39.4646],
        [-0.3266, 39.4601],
      ]],
    },
    properties: {
      name: 'Valencia Beach geozone / Geozona Playa de Valencia',
      type: 'CONDITIONAL',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-3',
    },
  },
  {
    uas_geozones_identifier: 'ESVC-4',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.3811, 39.4682],
        [-0.3802, 39.4699],
        [-0.3755, 39.4690],
        [-0.3755, 39.4669],
        [-0.3781, 39.4674],
        [-0.3784, 39.4674],
        [-0.3811, 39.4682],
      ]],
    },
    properties: {
      name: 'Geozona BioParc Valencia / BioParc Valencia geozone',
      type: 'PROHIBITED',
      region: 'Valencian-Community',
      country: 'ESP',
      identifier: 'ESVC-4',
    },
  },
];

/**
 * GET /api/geoawareness/geozones
 * 
 * Fetches geozones for a given U-space from the geoawareness service.
 * Falls back to hardcoded test data when the service is unavailable.
 * 
 * Query Parameters:
 * - uspaceId: The U-space identifier to fetch geozones for
 * 
 * Environment Variables:
 * - GEOAWARENESS_SERVICE_IP: IP address of the geoawareness service
 * - GEOAWARENESS_ENDPOINT: Endpoint for geozone queries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uspaceId = searchParams.get('uspaceId');

    if (!uspaceId) {
      return NextResponse.json(
        { error: 'uspaceId query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[Geozones API] 📋 Fetching geozones for U-space: ${uspaceId}`);
    console.log(`[Geozones API] ⚠️  This is a DEPRECATED fallback endpoint`);
    console.log(`[Geozones API] ℹ️  The geoawareness service ONLY works via WebSocket: ws://{IP}/ws/gas/{uspaceId}`);
    console.log(`[Geozones API] ℹ️  HTTP protocol (geozones_searcher_by_volumes) is NO LONGER SUPPORTED`);
    console.log(`[Geozones API] 📋 Returning fallback geozones directly (no HTTP call attempted)`);

    // CRITICAL: DO NOT attempt HTTP connection to the geoawareness service
    // The service ONLY works via WebSocket at ws://{IP}/ws/gas/{uspaceId}
    // HTTP endpoint geozones_searcher_by_volumes is completely deprecated and non-functional
    
    // Return fallback geozones immediately
    return NextResponse.json({
      success: true,
      geozones: FALLBACK_GEOZONES,
      count: FALLBACK_GEOZONES.length,
      fallback: true,
      message: 'Using fallback geozones - geoawareness service only accessible via WebSocket (ws://IP/ws/gas/uspaceId)',
    });

  } catch (error) {
    console.error('[Geozones API] Internal error:', error);
    
    // Even on internal error, return fallback data
    return NextResponse.json({
      success: true,
      geozones: FALLBACK_GEOZONES,
      count: FALLBACK_GEOZONES.length,
      fallback: true,
      message: 'Using fallback geozones - internal error',
    });
  }
}
