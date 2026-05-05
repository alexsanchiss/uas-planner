export interface ScrsWaypoint {
  lat: number
  lon: number
  alt: number
}

export interface ScrsSegment {
  segment: number
  start: ScrsWaypoint
  end: ScrsWaypoint
  solutionMethod: string
  routePath: ScrsWaypoint[]
}

export interface ScrsAlternative {
  uplanId: string
  segments: ScrsSegment[]
  /** Waypoints concatenados de todos los segmentos en orden, sin duplicados en las costuras */
  flatWaypoints: ScrsWaypoint[]
}

const COORD_TOLERANCE = 1e-9

function geoJsonPointToWaypoint(point: unknown): ScrsWaypoint | null {
  if (
    typeof point !== 'object' ||
    point === null ||
    (point as Record<string, unknown>).type !== 'Point'
  ) {
    return null
  }
  const coords = (point as Record<string, unknown>).coordinates
  if (!Array.isArray(coords) || coords.length < 3) {
    return null
  }
  const [lon, lat, alt] = coords as number[]
  if (typeof lon !== 'number' || typeof lat !== 'number' || typeof alt !== 'number') {
    return null
  }
  return { lat, lon, alt }
}

function waypointsEqual(a: ScrsWaypoint, b: ScrsWaypoint): boolean {
  return (
    Math.abs(a.lat - b.lat) < COORD_TOLERANCE &&
    Math.abs(a.lon - b.lon) < COORD_TOLERANCE &&
    Math.abs(a.alt - b.alt) < COORD_TOLERANCE
  )
}

/**
 * Parsea el authorizationMessage del FAS y extrae la alternativa SCRS si existe.
 * Devuelve null si:
 * - El mensaje es null/undefined/vacío
 * - No contiene scr_dispatch
 * - scr_dispatch.sent !== true
 * - scr_dispatch.status_code !== 200
 * - scr_dispatch.response.status !== 'success'
 * - scr_dispatch.response.segments es vacío o no existe
 */
export function parseScrsAlternative(
  authorizationMessage: string | null | undefined
): ScrsAlternative | null {
  if (!authorizationMessage) {
    return null
  }

  try {
    let parsed: unknown
    if (typeof authorizationMessage === 'string') {
      parsed = JSON.parse(authorizationMessage)
    } else {
      parsed = authorizationMessage
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }

    const root = parsed as Record<string, unknown>
    const scrDispatch = root.scr_dispatch

    if (typeof scrDispatch !== 'object' || scrDispatch === null) {
      return null
    }

    const dispatch = scrDispatch as Record<string, unknown>

    if (dispatch.sent !== true) {
      return null
    }

    if (dispatch.status_code !== 200) {
      return null
    }

    const response = dispatch.response
    if (typeof response !== 'object' || response === null) {
      return null
    }

    const resp = response as Record<string, unknown>

    if (resp.status !== 'success') {
      return null
    }

    const uplanId = resp.uplan_id
    if (typeof uplanId !== 'string' || !uplanId) {
      return null
    }

    const rawSegments = resp.segments
    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      return null
    }

    const segments: ScrsSegment[] = []

    for (const rawSeg of rawSegments) {
      if (typeof rawSeg !== 'object' || rawSeg === null) {
        return null
      }
      const seg = rawSeg as Record<string, unknown>

      const segmentNumber = seg.segment
      if (typeof segmentNumber !== 'number') {
        return null
      }

      const start = geoJsonPointToWaypoint(seg.start)
      if (!start) {
        return null
      }

      const end = geoJsonPointToWaypoint(seg.end)
      if (!end) {
        return null
      }

      const solutionMethod =
        typeof seg.solution_method === 'string' ? seg.solution_method : ''

      if (solutionMethod === 'FAILED' || typeof seg.error === 'string') {
        return null
      }

      let routePath: ScrsWaypoint[] = []
      if (Array.isArray(seg.route_path) && seg.route_path.length > 0) {
        for (const rawPoint of seg.route_path) {
          const wp = geoJsonPointToWaypoint(rawPoint)
          if (!wp) {
            return null
          }
          routePath.push(wp)
        }
      } else {
        routePath = [start, end]
      }

      segments.push({
        segment: segmentNumber,
        start,
        end,
        solutionMethod,
        routePath,
      })
    }

    // Sort segments by segment number
    segments.sort((a, b) => a.segment - b.segment)

    // Build flatWaypoints with deduplication at seams
    const flatWaypoints: ScrsWaypoint[] = []
    for (let i = 0; i < segments.length; i++) {
      const { routePath } = segments[i]
      for (let j = 0; j < routePath.length; j++) {
        const wp = routePath[j]
        // Deduplicate: if this is the first point of a non-first segment,
        // and it equals the last appended waypoint, skip it
        if (
          j === 0 &&
          i > 0 &&
          flatWaypoints.length > 0 &&
          waypointsEqual(flatWaypoints[flatWaypoints.length - 1], wp)
        ) {
          continue
        }
        flatWaypoints.push(wp)
      }
    }

    return {
      uplanId,
      segments,
      flatWaypoints,
    }
  } catch {
    return null
  }
}
