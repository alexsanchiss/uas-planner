/**
 * QGroundControl Plan Builder
 * ============================
 *
 * Builds the JSON structure for a QGroundControl (.plan) flight plan file.
 * Extracted from PlanGenerator.tsx so it can be reused by other parts of the
 * application (e.g. the accept-alternative endpoint).
 */

export interface QgcWaypoint {
  lat: number
  lng: number
  alt?: number          // Altitude in metres, default 0
  pauseDuration?: number  // Hold time in seconds, default 0
  speed?: number          // Speed in m/s (used for first waypoint set-speed item)
  flyOverMode?: boolean   // true = fly-over (pass directly over), false = fly-by (smooth curve)
}

/**
 * Builds the JSON of a flight plan in QGroundControl (.plan) format.
 *
 * The generated structure matches the format produced by PlanGenerator.tsx:
 *  - First item: MAV_CMD_DO_CHANGE_SPEED (178) using the speed of the first waypoint
 *  - Second item: TAKEOFF (22) for the first waypoint
 *  - Intermediate items: NAV_WAYPOINT (16) for every waypoint except first and last
 *  - Last item: LAND (21) with Altitude 0 and params[6] = 0
 *
 * @param waypoints  Ordered list of waypoints (must have at least 1 entry).
 * @param opts.homeAltitude  Override the planned home position altitude (metres).
 *                           Defaults to NEXT_PUBLIC_PLANNED_HOME_ALTITUDE env var, or 15.
 */
export function buildQgcPlan(
  waypoints: QgcWaypoint[],
  opts?: { homeAltitude?: number }
): unknown {
  if (waypoints.length === 0) return {}

  const items: unknown[] = []
  let doJumpId = 1

  // Add set speed (178) as the first item, using the speed of the first waypoint
  items.push({
    autoContinue: true,
    command: 178,
    doJumpId: doJumpId++,
    frame: 2,
    params: [1, waypoints[0].speed ?? 5, -1, 0, 0, 0, 0],
    type: 'SimpleItem',
  })

  // Takeoff (22) for the first waypoint
  const first = waypoints[0]
  items.push({
    AMSLAltAboveTerrain: null,
    Altitude: first.alt ?? 0,
    AltitudeMode: 1,
    autoContinue: true,
    command: 22,
    doJumpId: doJumpId++,
    frame: 3,
    params: [
      first.pauseDuration ?? 0,
      0,
      0,
      null,
      first.lat,
      first.lng,
      first.alt ?? 0,
    ],
    type: 'SimpleItem',
  })

  // Cruise (16) for intermediate waypoints (excluding first and last)
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i]
    // For NAV_WAYPOINT (cmd 16): params = [Hold, Accept_Radius, Pass_Radius, Yaw, Lat, Lon, Alt]
    // Accept_Radius = 0.1m forces drone to pass directly over (fly-over)
    // Accept_Radius = 0 allows smooth curving (fly-by, default)
    const acceptRadius = wp.flyOverMode ? 0.1 : 0
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: wp.alt ?? 0,
      AltitudeMode: 1,
      autoContinue: true,
      command: 16,
      doJumpId: doJumpId++,
      frame: 3,
      params: [
        wp.pauseDuration ?? 0,
        acceptRadius,
        0,
        null,
        wp.lat,
        wp.lng,
        wp.alt ?? 0,
      ],
      type: 'SimpleItem',
    })
  }

  // Landing (21) for the last waypoint
  if (waypoints.length > 1) {
    const last = waypoints[waypoints.length - 1]
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: 0,
      AltitudeMode: 1,
      autoContinue: true,
      command: 21,
      doJumpId: doJumpId++,
      frame: 3,
      params: [last.pauseDuration ?? 0, 0, 0, null, last.lat, last.lng, 0],
      type: 'SimpleItem',
    })
  }

  const plannedHome = waypoints[0]
  const homeAltitude =
    opts?.homeAltitude ??
    Number(
      (typeof process !== 'undefined' &&
        process.env.NEXT_PUBLIC_PLANNED_HOME_ALTITUDE) ||
        '15'
    )

  return {
    fileType: 'Plan',
    geoFence: { circles: [], polygons: [], version: 2 },
    groundStation: 'QGroundControl',
    mission: {
      cruiseSpeed: 15,
      firmwareType: 12,
      globalPlanAltitudeMode: 1,
      hoverSpeed: 5,
      items,
      plannedHomePosition: [plannedHome.lat, plannedHome.lng, homeAltitude],
      vehicleType: 2,
      version: 2,
    },
    rallyPoints: { points: [], version: 2 },
    version: 1,
  }
}
