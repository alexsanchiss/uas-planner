/**
 * SCRS (Segmented Conflict Resolution System) utilities
 *
 * Parses the alternative trajectory proposed by the FAS when a U-Plan is denied.
 * The alternative is embedded in the `authorizationMessage` field of a denied
 * flight plan, under the `scr_dispatch.response` key.
 */

/**
 * A single flat waypoint extracted from an SCRS alternative trajectory.
 * Uses `lon` (not `lng`) to match the GeoJSON convention used by the FAS.
 */
export interface ScrsWaypoint {
  lat: number;
  lon: number;
  alt: number;
}

/**
 * The parsed SCRS alternative, containing the flat list of waypoints
 * collected from all route_path points across all segments.
 */
export interface ScrsAlternative {
  flatWaypoints: ScrsWaypoint[];
}

/**
 * Parse the SCRS alternative trajectory from an authorizationMessage string.
 *
 * Expects the message to be a JSON object with a `scr_dispatch.response.segments`
 * array. Each segment has a `route_path` array of GeoJSON Points with
 * `coordinates: [lon, lat, alt]`.
 *
 * @param authorizationMessage - The raw authorizationMessage from the flight plan
 * @returns The parsed alternative, or null if unavailable / malformed
 */
export function parseScrsAlternative(
  authorizationMessage: string | null | undefined
): ScrsAlternative | null {
  if (!authorizationMessage) return null;

  let parsed: unknown;
  try {
    parsed =
      typeof authorizationMessage === 'string'
        ? JSON.parse(authorizationMessage)
        : authorizationMessage;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const msg = parsed as Record<string, unknown>;
  const scrDispatch = msg.scr_dispatch as Record<string, unknown> | undefined;
  if (!scrDispatch || typeof scrDispatch !== 'object') return null;

  const response = scrDispatch.response as Record<string, unknown> | undefined;
  if (!response || typeof response !== 'object') return null;

  const segments = response.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;

  const flatWaypoints: ScrsWaypoint[] = [];

  for (const segment of segments) {
    if (!segment || typeof segment !== 'object') continue;
    const seg = segment as Record<string, unknown>;
    const routePath = seg.route_path;
    if (!Array.isArray(routePath)) continue;

    for (const point of routePath) {
      if (!point || typeof point !== 'object') continue;
      const pt = point as Record<string, unknown>;
      const coordinates = pt.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 3) continue;

      const lon = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      const alt = Number(coordinates[2]);

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(alt)) {
        continue;
      }

      flatWaypoints.push({ lat, lon, alt });
    }
  }

  // Deduplicate consecutive duplicate waypoints that appear at segment junctions
  const deduplicated: ScrsWaypoint[] = [];
  for (const wp of flatWaypoints) {
    const prev = deduplicated[deduplicated.length - 1];
    if (prev && prev.lat === wp.lat && prev.lon === wp.lon && prev.alt === wp.alt) {
      continue;
    }
    deduplicated.push(wp);
  }

  if (deduplicated.length === 0) return null;

  return { flatWaypoints: deduplicated };
}
