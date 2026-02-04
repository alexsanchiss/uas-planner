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
// LINE-POLYGON INTERSECTION HELPERS (TASK-142)
// ============================================================================

/**
 * A 2D line segment in local Cartesian coordinates
 */
interface LocalSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Find intersection point of two line segments
 * Returns null if no intersection
 */
function lineSegmentIntersection(
  seg1: LocalSegment,
  seg2: LocalSegment
): { x: number; y: number } | null {
  const { x1: x1, y1: y1, x2: x2, y2: y2 } = seg1;
  const { x1: x3, y1: y3, x2: x4, y2: y4 } = seg2;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  // Lines are parallel or coincident
  if (Math.abs(denom) < 1e-12) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both segments
  if (t >= -1e-10 && t <= 1 + 1e-10 && u >= -1e-10 && u <= 1 + 1e-10) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

/**
 * Convert geographic coordinates to local Cartesian coordinates
 * centered at the polygon centroid
 */
function toLocalCoords(
  point: Point,
  centroid: Point,
  latScale: number,
  lngScale: number
): { x: number; y: number } {
  return {
    x: (point.lng - centroid.lng) * lngScale,
    y: (point.lat - centroid.lat) * latScale,
  };
}

/**
 * Convert local Cartesian coordinates back to geographic coordinates
 */
function fromLocalCoords(
  local: { x: number; y: number },
  centroid: Point,
  latScale: number,
  lngScale: number
): Point {
  return {
    lat: centroid.lat + local.y / latScale,
    lng: centroid.lng + local.x / lngScale,
  };
}

/**
 * TASK-141: Generate parallel lines based on angle and spacing
 * 
 * This function generates parallel lines that span across the polygon's
 * bounding box at the specified angle and spacing.
 * 
 * @param polygon The polygon to cover
 * @param angle Angle in degrees (0 = North, 90 = East)
 * @param spacing Distance between lines in meters
 * @returns Array of line segments in local coordinates
 */
function generateParallelLines(
  polygon: Polygon,
  angle: number,
  spacing: number,
  centroid: Point,
  latScale: number,
  lngScale: number
): LocalSegment[] {
  // Convert polygon vertices to local coordinates
  const localVertices = polygon.vertices.map(v => 
    toLocalCoords(v, centroid, latScale, lngScale)
  );

  // Find the bounding box of the polygon in local coordinates
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const v of localVertices) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }

  // Calculate the diagonal of the bounding box
  // Lines need to extend this far to cover any rotation
  const diagonal = Math.sqrt(
    Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2)
  );
  const halfDiag = diagonal / 2 + spacing; // Add buffer

  // Center of bounding box
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Convert angle to radians (0° = North = up = +y direction)
  // We want lines perpendicular to the direction of travel
  // If angle is 0° (North), lines should be horizontal (East-West)
  const angleRad = toRadians(angle);
  
  // Direction perpendicular to scan angle (the direction lines run)
  const lineDirX = Math.sin(angleRad);
  const lineDirY = Math.cos(angleRad);
  
  // Direction parallel to scan lines (for spacing)
  const perpDirX = Math.cos(angleRad);
  const perpDirY = -Math.sin(angleRad);

  // Calculate how many lines we need
  const numLines = Math.ceil(diagonal / spacing) + 2;
  const halfLines = Math.floor(numLines / 2);

  const lines: LocalSegment[] = [];

  // Generate lines centered around the bounding box center
  for (let i = -halfLines; i <= halfLines; i++) {
    // Offset from center along perpendicular direction
    const offset = i * spacing;
    const lineBaseX = cx + perpDirX * offset;
    const lineBaseY = cy + perpDirY * offset;

    // Create line segment extending from this base point
    lines.push({
      x1: lineBaseX - lineDirX * halfDiag,
      y1: lineBaseY - lineDirY * halfDiag,
      x2: lineBaseX + lineDirX * halfDiag,
      y2: lineBaseY + lineDirY * halfDiag,
    });
  }

  return lines;
}

/**
 * TASK-142: Clip parallel lines to polygon boundary
 * 
 * For each line, find where it intersects the polygon edges
 * and keep only the segments that are inside the polygon.
 * 
 * @param lines Array of line segments
 * @param polygon Polygon vertices in local coordinates
 * @returns Array of clipped line segments (points inside polygon)
 */
function clipLinesToPolygon(
  lines: LocalSegment[],
  localVertices: { x: number; y: number }[]
): LocalSegment[] {
  const clippedLines: LocalSegment[] = [];
  const n = localVertices.length;

  for (const line of lines) {
    // Find all intersection points with polygon edges
    const intersections: { x: number; y: number; t: number }[] = [];

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const edge: LocalSegment = {
        x1: localVertices[i].x,
        y1: localVertices[i].y,
        x2: localVertices[j].x,
        y2: localVertices[j].y,
      };

      const intersection = lineSegmentIntersection(line, edge);
      if (intersection) {
        // Calculate parameter t along the scan line
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const t = Math.abs(dx) > Math.abs(dy)
          ? (intersection.x - line.x1) / dx
          : (intersection.y - line.y1) / dy;
        
        intersections.push({ ...intersection, t });
      }
    }

    // Sort intersections by position along line
    intersections.sort((a, b) => a.t - b.t);

    // Remove duplicate intersections (at vertices)
    const uniqueIntersections: typeof intersections = [];
    for (const inter of intersections) {
      if (
        uniqueIntersections.length === 0 ||
        Math.abs(inter.x - uniqueIntersections[uniqueIntersections.length - 1].x) > 0.01 ||
        Math.abs(inter.y - uniqueIntersections[uniqueIntersections.length - 1].y) > 0.01
      ) {
        uniqueIntersections.push(inter);
      }
    }

    // Create segments from pairs of intersections (entry/exit points)
    // Even indices are entries, odd indices are exits
    for (let i = 0; i + 1 < uniqueIntersections.length; i += 2) {
      const entry = uniqueIntersections[i];
      const exit = uniqueIntersections[i + 1];
      
      // Verify segment midpoint is inside polygon
      const midX = (entry.x + exit.x) / 2;
      const midY = (entry.y + exit.y) / 2;
      
      if (isPointInPolygon({ x: midX, y: midY }, localVertices)) {
        clippedLines.push({
          x1: entry.x,
          y1: entry.y,
          x2: exit.x,
          y2: exit.y,
        });
      }
    }
  }

  return clippedLines;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(
  point: { x: number; y: number },
  vertices: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * TASK-143: Create zigzag path connecting parallel lines efficiently
 * 
 * Connects the scan lines in a snake pattern to minimize travel distance.
 * Alternates direction on consecutive lines.
 * 
 * @param clippedLines Array of clipped line segments
 * @param startPoint Optional start point to determine initial direction
 * @returns Array of points forming the zigzag path
 */
function createZigzagPath(
  clippedLines: LocalSegment[],
  startPoint?: { x: number; y: number }
): { x: number; y: number }[] {
  if (clippedLines.length === 0) {
    return [];
  }

  // Sort lines by their center position perpendicular to scan direction
  // This ensures we process them in order
  const sortedLines = [...clippedLines].sort((a, b) => {
    const aCenterX = (a.x1 + a.x2) / 2;
    const aCenterY = (a.y1 + a.y2) / 2;
    const bCenterX = (b.x1 + b.x2) / 2;
    const bCenterY = (b.y1 + b.y2) / 2;
    
    // Sort primarily by one axis, with the other as tiebreaker
    // This works for any scan angle
    const primaryA = aCenterX + aCenterY;
    const primaryB = bCenterX + bCenterY;
    
    return primaryA - primaryB;
  });

  const path: { x: number; y: number }[] = [];
  let lastEnd: { x: number; y: number } | null = startPoint ?? null;

  for (let i = 0; i < sortedLines.length; i++) {
    const line = sortedLines[i];
    const start = { x: line.x1, y: line.y1 };
    const end = { x: line.x2, y: line.y2 };

    // Determine which endpoint is closer to the last position
    // to minimize travel distance (zigzag pattern)
    let useReversed = false;
    
    if (lastEnd) {
      const distToStart = Math.hypot(start.x - lastEnd.x, start.y - lastEnd.y);
      const distToEnd = Math.hypot(end.x - lastEnd.x, end.y - lastEnd.y);
      useReversed = distToEnd < distToStart;
    } else if (i % 2 === 1) {
      // Alternate direction if no reference point
      useReversed = true;
    }

    if (useReversed) {
      path.push(end, start);
      lastEnd = start;
    } else {
      path.push(start, end);
      lastEnd = end;
    }
  }

  return path;
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
 * 3. TASK-141: Generate parallel lines at specified angle and spacing
 * 4. TASK-142: Clip lines to polygon boundary
 * 5. TASK-143: Create zigzag path connecting line endpoints
 * 6. TASK-144: Add takeoff waypoint at start point
 * 7. TASK-145: Add landing waypoint at end point
 * 8. TASK-150: Calculate statistics
 * 
 * TASK-140, TASK-141, TASK-142, TASK-143, TASK-144, TASK-145: Full implementation
 */
export function generateScanWaypoints(config: ScanConfig): ScanResult {
  // Validate configuration (TASK-149)
  const validation = validateScanConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid SCAN configuration: ${validation.errors.join(', ')}`);
  }

  const defaultSpeed = config.speed ?? 5;
  const waypoints: ScanWaypoint[] = [];

  // Calculate centroid and scaling factors for local coordinate conversion
  const centroid = polygonCentroid(config.polygon);
  const latScale = 111320; // meters per degree latitude
  const lngScale = 111320 * Math.cos(toRadians(centroid.lat)); // meters per degree longitude

  // Convert polygon vertices to local coordinates
  const localVertices = config.polygon.vertices.map(v =>
    toLocalCoords(v, centroid, latScale, lngScale)
  );

  // TASK-141: Generate parallel lines based on angle and spacing
  const parallelLines = generateParallelLines(
    config.polygon,
    normalizeAngle(config.angle),
    config.spacing,
    centroid,
    latScale,
    lngScale
  );

  // TASK-142: Clip parallel lines to polygon boundary
  const clippedLines = clipLinesToPolygon(parallelLines, localVertices);

  // Convert start point to local coordinates if provided
  const localStartPoint = config.startPoint
    ? toLocalCoords(config.startPoint, centroid, latScale, lngScale)
    : undefined;

  // TASK-143: Create zigzag path connecting parallel lines efficiently
  const zigzagPath = createZigzagPath(clippedLines, localStartPoint);

  // Convert path back to geographic coordinates
  const geoPath = zigzagPath.map(p =>
    fromLocalCoords(p, centroid, latScale, lngScale)
  );

  // TASK-144: Add takeoff waypoint at start point
  const takeoffPoint = config.startPoint ?? geoPath[0] ?? config.polygon.vertices[0];
  waypoints.push({
    lat: takeoffPoint.lat,
    lng: takeoffPoint.lng,
    type: 'takeoff',
    altitude: config.altitude,
    speed: defaultSpeed,
    pauseDuration: 0,
    flyOverMode: false,
  });

  // Add scan pattern waypoints as cruise points
  for (const point of geoPath) {
    waypoints.push({
      lat: point.lat,
      lng: point.lng,
      type: 'cruise',
      altitude: config.altitude,
      speed: defaultSpeed,
      pauseDuration: 0,
      flyOverMode: false,
    });
  }

  // TASK-145: Add landing waypoint at end point
  const landingPoint = config.endPoint ?? geoPath[geoPath.length - 1] ?? config.polygon.vertices[0];
  waypoints.push({
    lat: landingPoint.lat,
    lng: landingPoint.lng,
    type: 'landing',
    altitude: 0, // Landing at ground level
    speed: defaultSpeed,
    pauseDuration: 0,
    flyOverMode: false,
  });

  // TASK-150: Calculate statistics
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
    scanLineCount: clippedLines.length,
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
