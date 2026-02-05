import { NextResponse } from 'next/server'

/**
 * U-Space boundary point
 */
interface USpaceBoundaryPoint {
  latitude: number
  longitude: number
}

/**
 * U-Space data structure from the geoawareness service
 */
interface USpace {
  name: string
  id: string
  boundary: USpaceBoundaryPoint[]
}

/**
 * Response from the geoawareness service
 */
interface USpacesResponse {
  u_spaces: USpace[]
}

/**
 * Hardcoded test U-spaces for development/testing
 */
function getTestUspaces(): USpace[] {
  return [
    {
      id: 'CVUspace',
      name: 'CVUspace',
      boundary: [
        { latitude: 37.8, longitude: -1.6 },
        { latitude: 37.8, longitude: 0.6 },
        { latitude: 40.8, longitude: 0.6 },
        { latitude: 40.8, longitude: -1.6 },
        { latitude: 37.8, longitude: -1.6 },
      ],
    },
    {
      id: 'PuertoVLC',
      name: 'PuertoVLC',
      boundary: [
        { latitude: 39.41991545, longitude: -0.31788648 },
        { latitude: 39.42323459, longitude: -0.31254964 },
        { latitude: 39.42973963, longitude: -0.30910652 },
        { latitude: 39.43332378, longitude: -0.30273675 },
        { latitude: 39.44354423, longitude: -0.2915466 },
        { latitude: 39.45455941, longitude: -0.28603761 },
        { latitude: 39.46265378, longitude: -0.30876222 },
        { latitude: 39.46278647, longitude: -0.31995235 },
        { latitude: 39.46159223, longitude: -0.32993741 },
        { latitude: 39.46026538, longitude: -0.33303621 },
        { latitude: 39.45548832, longitude: -0.33028172 },
        { latitude: 39.45455941, longitude: -0.32821584 },
        { latitude: 39.45097635, longitude: -0.32873231 },
        { latitude: 39.44964924, longitude: -0.32632213 },
        { latitude: 39.44407512, longitude: -0.32580566 },
        { latitude: 39.44221699, longitude: -0.32752722 },
        { latitude: 39.4418188, longitude: -0.33131646 },
        { latitude: 39.43863329, longitude: -0.33406952 },
        { latitude: 39.43836783, longitude: -0.33837304 },
        { latitude: 39.42894312, longitude: -0.34181617 },
        { latitude: 39.41991545, longitude: -0.31788648 },
      ],
    },
    {
      id: 'VLCUspace',
      name: 'VLCUspace',
      boundary: [
        { latitude: 39.4150, longitude: -0.4257 },
        { latitude: 39.4150, longitude: -0.2800 },
        { latitude: 39.4988, longitude: -0.2800 },
        { latitude: 39.4988, longitude: -0.4257 },
        { latitude: 39.4150, longitude: -0.4257 },
      ],
    },
  ]
}

/**
 * GET /api/geoawareness/uspaces
 * 
 * Proxy endpoint for fetching the list of available U-spaces from the
 * geoawareness service. This avoids CORS issues when calling from the client.
 * 
 * Environment variables:
 * - GEOAWARENESS_SERVICE_IP: IP address of the geoawareness service
 * - GEOAWARENESS_USPACES_ENDPOINT: Endpoint for U-spaces list (default: 'uspaces')
 *   - Set to "PRUEBA" to use hardcoded test data
 * 
 * @returns List of U-spaces with their boundaries
 */
export async function GET() {
  try {
    // Get geoawareness service configuration
    const serviceIp = process.env.GEOAWARENESS_SERVICE_IP
    const endpoint = process.env.GEOAWARENESS_USPACES_ENDPOINT || 'uspaces'

    // Check if we're in test mode with hardcoded data
    if (endpoint === 'PRUEBA') {
      // console.log('[USpaces] Using hardcoded test U-spaces (PRUEBA mode)')
      const testUspaces = getTestUspaces()
      return NextResponse.json({
        success: true,
        uspaces: testUspaces,
        count: testUspaces.length,
      })
    }

    if (!serviceIp) {
      console.warn('[USpaces] GEOAWARENESS_SERVICE_IP not configured')
      return NextResponse.json(
        { error: 'Geoawareness service not configured' },
        { status: 503 }
      )
    }

    const serviceUrl = `http://${serviceIp}/${endpoint}`
    
    // console.log(`[USpaces] Fetching U-spaces from: ${serviceUrl}`)

    try {
      const response = await fetch(serviceUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Timeout after 15 seconds
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[USpaces] Service returned error: ${response.status} - ${errorText}`)
        return NextResponse.json(
          { error: `Failed to fetch U-spaces: ${response.status}` },
          { status: 502 }
        )
      }

      const data: USpacesResponse = await response.json()
      
      // console.log(`[USpaces] Received ${data.u_spaces?.length || 0} U-spaces`)

      // Validate response structure
      if (!data.u_spaces || !Array.isArray(data.u_spaces)) {
        console.error('[USpaces] Invalid response structure:', data)
        return NextResponse.json(
          { error: 'Invalid response from geoawareness service' },
          { status: 502 }
        )
      }

      // Return the U-spaces list
      return NextResponse.json({
        success: true,
        uspaces: data.u_spaces,
        count: data.u_spaces.length,
      })

    } catch (fetchError) {
      console.error('[USpaces] Failed to connect to service:', fetchError)
      
      // Check if it's a timeout
      if (fetchError instanceof Error && fetchError.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Geoawareness service timeout. The service may be slow or unavailable.' },
          { status: 504 }
        )
      }

      // Network error
      return NextResponse.json(
        { error: 'Failed to connect to geoawareness service. Please check if the service is running.' },
        { status: 503 }
      )
    }

  } catch (error) {
    console.error('[USpaces] Internal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
