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
 * GET /api/geoawareness/uspaces
 * 
 * Proxy endpoint for fetching the list of available U-spaces from the
 * geoawareness service. This avoids CORS issues when calling from the client.
 * 
 * Environment variables:
 * - GEOAWARENESS_SERVICE_IP: IP address of the geoawareness service
 * - GEOAWARENESS_USPACES_ENDPOINT: Endpoint for U-spaces list (default: 'uspaces')
 * 
 * @returns List of U-spaces with their boundaries
 */
export async function GET() {
  try {
    // Get geoawareness service configuration
    const serviceIp = process.env.GEOAWARENESS_SERVICE_IP
    const endpoint = process.env.GEOAWARENESS_USPACES_ENDPOINT || 'uspaces'

    if (!serviceIp) {
      console.warn('[USpaces] GEOAWARENESS_SERVICE_IP not configured')
      return NextResponse.json(
        { error: 'Geoawareness service not configured' },
        { status: 503 }
      )
    }

    const serviceUrl = `http://${serviceIp}/${endpoint}`
    
    console.log(`[USpaces] Fetching U-spaces from: ${serviceUrl}`)

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
      
      console.log(`[USpaces] Received ${data.u_spaces?.length || 0} U-spaces`)

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
