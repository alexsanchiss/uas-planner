/**
 * QGC (QGroundControl) plan builder
 *
 * Builds a QGC `.plan` JSON object from a list of waypoints.
 * The format matches what PlanGenerator.tsx generates and what the
 * traj-runner/traj-assigner pipeline expects.
 */

/**
 * A single waypoint for the QGC plan.
 * Note: uses `lng` (not `lon`) to match the Leaflet / QGC convention used
 * throughout the frontend.
 */
export interface QgcWaypoint {
  lat: number;
  lng: number;
  alt: number;
}

/**
 * Build a QGC `.plan` JSON object from an array of waypoints.
 *
 * The first waypoint becomes a Takeoff command (22).
 * Intermediate waypoints become NAV_WAYPOINT commands (16).
 * The last waypoint becomes a Land command (21) at altitude 0.
 *
 * A set-speed item (178) is prepended as the first mission item.
 *
 * @param waypoints - Ordered list of waypoints (at least 1 required)
 * @returns QGC plan object ready for JSON.stringify
 */
export function buildQgcPlan(waypoints: QgcWaypoint[]): object {
  if (waypoints.length === 0) {
    return {};
  }

  const items: object[] = [];
  let doJumpId = 1;

  // Default speed item (178) — use cruise speed of 15 m/s
  const defaultSpeed = 15;
  items.push({
    autoContinue: true,
    command: 178,
    doJumpId: doJumpId++,
    frame: 2,
    params: [1, defaultSpeed, -1, 0, 0, 0, 0],
    type: 'SimpleItem',
  });

  // Takeoff (22) for the first waypoint
  const first = waypoints[0];
  items.push({
    AMSLAltAboveTerrain: null,
    Altitude: first.alt,
    AltitudeMode: 1,
    autoContinue: true,
    command: 22,
    doJumpId: doJumpId++,
    frame: 3,
    params: [0, 0, 0, null, first.lat, first.lng, first.alt],
    type: 'SimpleItem',
  });

  // NAV_WAYPOINT (16) for intermediate waypoints
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i];
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: wp.alt,
      AltitudeMode: 1,
      autoContinue: true,
      command: 16,
      doJumpId: doJumpId++,
      frame: 3,
      params: [0, 0, 0, null, wp.lat, wp.lng, wp.alt],
      type: 'SimpleItem',
    });
  }

  // Land (21) for the last waypoint — altitude 0
  if (waypoints.length > 1) {
    const last = waypoints[waypoints.length - 1];
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: 0,
      AltitudeMode: 1,
      autoContinue: true,
      command: 21,
      doJumpId: doJumpId++,
      frame: 3,
      params: [0, 0, 0, null, last.lat, last.lng, 0],
      type: 'SimpleItem',
    });
  }

  const homeAltitude = 15; // default planned home altitude (AGL)
  return {
    fileType: 'Plan',
    geoFence: { circles: [], polygons: [], version: 2 },
    groundStation: 'QGroundControl',
    mission: {
      cruiseSpeed: defaultSpeed,
      firmwareType: 12,
      globalPlanAltitudeMode: 1,
      hoverSpeed: 5,
      items,
      plannedHomePosition: [first.lat, first.lng, homeAltitude],
      vehicleType: 2,
      version: 2,
    },
    rallyPoints: { points: [], version: 2 },
    version: 1,
  };
}
