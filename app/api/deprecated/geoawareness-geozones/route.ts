import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated This endpoint is deprecated and kept only as a fallback for useGeoawarenessWebSocket.
 * The primary method for fetching geozones is via WebSocket at /ws/gas/{uspaceId}.
 * This endpoint may be removed in a future version.
 * 
 * TASK-095: Moved from /api/geoawareness/geozones to /api/deprecated/geoawareness-geozones
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

    console.log(`[Geozones API] Fetching geozones for U-space: ${uspaceId}`);

    // Use NEXT_PUBLIC_ variable as unified geoawareness service IP
    const serviceIp = process.env.NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP;
    const endpoint = process.env.GEOAWARENESS_ENDPOINT || 'geozones_searcher_by_volumes';

    if (!serviceIp) {
      console.warn('[Geozones API] NEXT_PUBLIC_GEOAWARENESS_SERVICE_IP not configured, using fallback data');
      return NextResponse.json({
        success: true,
        geozones: FALLBACK_GEOZONES,
        count: FALLBACK_GEOZONES.length,
        fallback: true,
        message: 'Using fallback geozones - service not configured',
      });
    }

    // Try to fetch from the geoawareness service
    // The service expects a POST request with the U-space ID
    const serviceUrl = `http://${serviceIp}/geozones_searcher_by_volumes/${uspaceId}`;
    
    console.log(`[Geozones API] Attempting to fetch from: ${serviceUrl}`);

    try {
      const response = await fetch(serviceUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Geozones API] Service error: ${response.status} - ${errorText}`);
        throw new Error(`Service returned ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Geozones API] ✅ Received response from service`);

      // The service may return data in different formats, normalize it
      let geozones: GeozoneData[] = [];
      
      if (Array.isArray(data)) {
        geozones = data;
      } else if (data.geozones_data && Array.isArray(data.geozones_data)) {
        geozones = data.geozones_data;
      } else if (data.features && Array.isArray(data.features)) {
        // GeoJSON format
        geozones = data.features.map((feature: { properties?: { identifier?: string }; geometry: GeozoneGeometry }) => ({
          uas_geozones_identifier: feature.properties?.identifier || `geozone-${Math.random().toString(36).substr(2, 9)}`,
          geometry: feature.geometry,
          properties: feature.properties || {},
        }));
      }

      console.log(`[Geozones API] ✅ Returning ${geozones.length} geozones`);

      return NextResponse.json({
        success: true,
        geozones,
        count: geozones.length,
        fallback: false,
      });

    } catch (fetchError) {
      console.error('[Geozones API] ❌ Failed to connect to geoawareness service:', fetchError);
      console.log('[Geozones API] 📋 Returning fallback geozones');
      
      return NextResponse.json({
        success: true,
        geozones: FALLBACK_GEOZONES,
        count: FALLBACK_GEOZONES.length,
        fallback: true,
        message: 'Using fallback geozones - service unavailable',
      });
    }

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
