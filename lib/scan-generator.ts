/**
 * SCAN Pattern Generator Library
 * ===============================
 * 
 * This library provides algorithms and utilities for generating SCAN (survey)
 * flight patterns. A SCAN pattern consists of parallel lines covering a polygon
 * area, used for aerial surveys, mapping, and inspection missions.
 * 
 * TASK-140: Core SCAN algorithm implementation
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a 2D coordinate point
 */
export interface Point {
  lat: number;
  lng: number;
}

/**
 * A polygon defined by an array of vertices
 */
export interface Polygon {
  vertices: Point[];
}

/**
 * Configuration for SCAN pattern generation
 */
export interface ScanConfig {
  /** The polygon area to cover with the scan pattern */
  polygon: Polygon;
  /** Fixed altitude for all scan waypoints (meters) */
  altitude: number;
  /** Spacing between parallel scan lines (meters) */
  spacing: number;
  /** Angle of scan lines (0-360 degrees, 0 = North, 90 = East) */
  angle: number;
  /** Optional start point for takeoff (if not provided, uses first scan waypoint) */
  startPoint?: Point;
  /** Optional end point for landing (if not provided, uses last scan waypoint) */
  endPoint?: Point;
  /** Speed for waypoints (m/s) */
  speed?: number;
}

/**
 * Generated waypoint from SCAN pattern
 */
export interface ScanWaypoint {
  lat: number;
  lng: number;
  type: 'takeoff' | 'cruise' | 'landing';
  altitude: number;
  speed: number;
  pauseDuration: number;
  flyOverMode: boolean;
}

/**
 * Result of SCAN pattern generation
 */
export interface ScanResult {
  waypoints: ScanWaypoint[];
  statistics: ScanStatistics;
}

/**
 * Statistics about the generated SCAN pattern
 */
export interface ScanStatistics {
  /** Total number of waypoints */
  waypointCount: number;
  /** Estimated total distance in meters */
  totalDistance: number;
  /** Estimated flight time in seconds (based on waypoint speed) */
  estimatedFlightTime: number;
  /** Number of parallel scan lines */
  scanLineCount: number;
  /** Area covered by the polygon in square meters */
  coverageArea: number;
}

/**
 * Validation result for SCAN configuration
 */
export interface ScanValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Earth radius in meters for geodesic calculations */
const EARTH_RADIUS = 6371000;

/** Minimum polygon area in square meters */
const MIN_POLYGON_AREA = 100;

/** Maximum polygon area in square meters (10 km²) */
const MAX_POLYGON_AREA = 10000000;

/** Minimum spacing between scan lines (meters) */
const MIN_SPACING = 1;

/** Maximum spacing between scan lines (meters) */
const MAX_SPACING = 1000;

/** Minimum number of polygon vertices */
const MIN_VERTICES = 3;

/** Maximum number of polygon vertices */
const MAX_VERTICES = 100;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate Haversine distance between two points (meters)
 */
export function haversineDistance(p1: Point, p2: Point): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Calculate destination point given start point, bearing, and distance
 * @param start Starting point
 * @param bearing Bearing in degrees (0 = North, 90 = East)
 * @param distance Distance in meters
 */
export function destinationPoint(start: Point, bearing: number, distance: number): Point {
  const bearingRad = toRadians(bearing);
  const lat1 = toRadians(start.lat);
  const lng1 = toRadians(start.lng);
  const angularDist = distance / EARTH_RADIUS;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) +
    Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearingRad)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDist) * Math.cos(lat1),
    Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: toDegrees(lat2),
    lng: toDegrees(lng2),
  };
}

/**
 * Calculate the centroid of a polygon
 */
export function polygonCentroid(polygon: Polygon): Point {
  const n = polygon.vertices.length;
  if (n === 0) return { lat: 0, lng: 0 };

  let latSum = 0;
  let lngSum = 0;
  for (const v of polygon.vertices) {
    latSum += v.lat;
    lngSum += v.lng;
  }

  return {
    lat: latSum / n,
    lng: lngSum / n,
  };
}

/**
 * Calculate approximate area of a polygon using Shoelace formula
 * Returns area in square meters (approximate for small areas)
 */
export function polygonArea(polygon: Polygon): number {
  const vertices = polygon.vertices;
  const n = vertices.length;
  if (n < 3) return 0;

  // Get centroid for local coordinate transformation
  const centroid = polygonCentroid(polygon);
  const latScale = 111320; // meters per degree latitude
  const lngScale = 111320 * Math.cos(toRadians(centroid.lat)); // meters per degree longitude

  // Convert to local Cartesian coordinates
  const localPoints = vertices.map(v => ({
    x: (v.lng - centroid.lng) * lngScale,
    y: (v.lat - centroid.lat) * latScale,
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += localPoints[i].x * localPoints[j].y;
    area -= localPoints[j].x * localPoints[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Get the bounding box of a polygon
 */
export function polygonBoundingBox(polygon: Polygon): { min: Point; max: Point } {
  if (polygon.vertices.length === 0) {
    return { min: { lat: 0, lng: 0 }, max: { lat: 0, lng: 0 } };
  }

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const v of polygon.vertices) {
    minLat = Math.min(minLat, v.lat);
    maxLat = Math.max(maxLat, v.lat);
    minLng = Math.min(minLng, v.lng);
    maxLng = Math.max(maxLng, v.lng);
  }

  return {
    min: { lat: minLat, lng: minLng },
    max: { lat: maxLat, lng: maxLng },
  };
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate SCAN configuration
 */
export function validateScanConfig(config: ScanConfig): ScanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate polygon
  if (!config.polygon || !config.polygon.vertices) {
    errors.push("Polygon is required");
  } else {
    const vertexCount = config.polygon.vertices.length;
    if (vertexCount < MIN_VERTICES) {
      errors.push(`Polygon must have at least ${MIN_VERTICES} vertices`);
    }
    if (vertexCount > MAX_VERTICES) {
      errors.push(`Polygon must have at most ${MAX_VERTICES} vertices`);
    }

    // Check for valid coordinates
    for (let i = 0; i < vertexCount; i++) {
      const v = config.polygon.vertices[i];
      if (isNaN(v.lat) || isNaN(v.lng)) {
        errors.push(`Vertex ${i + 1} has invalid coordinates`);
      }
      if (v.lat < -90 || v.lat > 90) {
        errors.push(`Vertex ${i + 1} latitude must be between -90 and 90`);
      }
      if (v.lng < -180 || v.lng > 180) {
        errors.push(`Vertex ${i + 1} longitude must be between -180 and 180`);
      }
    }

    // Check polygon area
    if (vertexCount >= MIN_VERTICES) {
      const area = polygonArea(config.polygon);
      if (area < MIN_POLYGON_AREA) {
        errors.push(`Polygon area (${area.toFixed(1)} m²) is too small. Minimum: ${MIN_POLYGON_AREA} m²`);
      }
      if (area > MAX_POLYGON_AREA) {
        warnings.push(`Polygon area (${(area / 1000000).toFixed(2)} km²) is very large. This may generate many waypoints.`);
      }
    }
  }

  // Validate altitude
  if (isNaN(config.altitude) || config.altitude < 0) {
    errors.push("Altitude must be a positive number");
  }
  if (config.altitude > 200) {
    warnings.push("Altitude exceeds typical drone limits (200m)");
  }

  // Validate spacing
  if (isNaN(config.spacing) || config.spacing < MIN_SPACING) {
    errors.push(`Spacing must be at least ${MIN_SPACING} meter`);
  }
  if (config.spacing > MAX_SPACING) {
    errors.push(`Spacing must be at most ${MAX_SPACING} meters`);
  }

  // Validate angle
  if (isNaN(config.angle)) {
    errors.push("Angle must be a number");
  }

  // Validate optional start/end points
  if (config.startPoint) {
    if (isNaN(config.startPoint.lat) || isNaN(config.startPoint.lng)) {
      errors.push("Start point has invalid coordinates");
    }
  }
  if (config.endPoint) {
    if (isNaN(config.endPoint.lat) || isNaN(config.endPoint.lng)) {
      errors.push("End point has invalid coordinates");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// MAIN ALGORITHM
// ============================================================================

/**
 * Generate SCAN pattern waypoints from configuration
 * 
 * Algorithm overview:
 * 1. Validate configuration
 * 2. Calculate bounding box of polygon
 * 3. Generate parallel lines at specified angle and spacing
 * 4. Clip lines to polygon boundary
 * 5. Create zigzag path connecting line endpoints
 * 6. Add takeoff/landing waypoints
 * 7. Calculate statistics
 * 
 * TASK-140: Core algorithm implementation (full implementation in next batch)
 */
export function generateScanWaypoints(config: ScanConfig): ScanResult {
  // Validate configuration
  const validation = validateScanConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid SCAN configuration: ${validation.errors.join(', ')}`);
  }

  const defaultSpeed = config.speed ?? 5;
  const waypoints: ScanWaypoint[] = [];

  // For now, return a placeholder result
  // Full algorithm implementation will be in TASK-141 to TASK-145
  
  // Add takeoff waypoint
  const startPoint = config.startPoint ?? config.polygon.vertices[0];
  waypoints.push({
    lat: startPoint.lat,
    lng: startPoint.lng,
    type: 'takeoff',
    altitude: config.altitude,
    speed: defaultSpeed,
    pauseDuration: 0,
    flyOverMode: false,
  });

  // Calculate centroid for a simple placeholder scan pattern
  const centroid = polygonCentroid(config.polygon);
  
  // Add a cruise waypoint at centroid (placeholder)
  waypoints.push({
    lat: centroid.lat,
    lng: centroid.lng,
    type: 'cruise',
    altitude: config.altitude,
    speed: defaultSpeed,
    pauseDuration: 0,
    flyOverMode: false,
  });

  // Add landing waypoint
  const endPoint = config.endPoint ?? config.polygon.vertices[0];
  waypoints.push({
    lat: endPoint.lat,
    lng: endPoint.lng,
    type: 'landing',
    altitude: 0,
    speed: defaultSpeed,
    pauseDuration: 0,
    flyOverMode: false,
  });

  // Calculate basic statistics
  let totalDistance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    totalDistance += haversineDistance(
      { lat: waypoints[i - 1].lat, lng: waypoints[i - 1].lng },
      { lat: waypoints[i].lat, lng: waypoints[i].lng }
    );
  }

  const statistics: ScanStatistics = {
    waypointCount: waypoints.length,
    totalDistance,
    estimatedFlightTime: totalDistance / defaultSpeed,
    scanLineCount: 1, // Placeholder
    coverageArea: polygonArea(config.polygon),
  };

  return {
    waypoints,
    statistics,
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  MIN_POLYGON_AREA,
  MAX_POLYGON_AREA,
  MIN_SPACING,
  MAX_SPACING,
  MIN_VERTICES,
  MAX_VERTICES,
};
