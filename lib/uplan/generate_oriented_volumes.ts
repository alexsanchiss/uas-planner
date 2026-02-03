/**
 * Oriented Volume Generation for U-Plans
 *
 * This module generates oriented operation volumes for U-Plans following
 * the C++ implementation logic. Volumes are oriented rectangles aligned
 * with the flight trajectory, not axis-aligned squares.
 *
 * Key differences from axis-aligned volumes (generate_bbox.ts):
 * - Volumes are oriented along the trajectory azimuth
 * - Separate Alpha_H and Alpha_V parameters for segment classification
 * - Different buffer calculations for horizontal vs vertical segments
 *
 * @module generate_oriented_volumes
 */

import {
  calculateVincentyDistance,
  calculateVincentyAzimuth,
  calculateDestinationPoint,
  normalizeAzimuth,
} from "./geodesy-utils";

/**
 * Configuration parameters for U-Plan volume generation.
 *
 * Parameters match the C++ implementation:
 * - TSE_H: Total System Error Horizontal = 15.0m (was ~14.3m in old TS)
 * - TSE_V: Total System Error Vertical = 10.0m (was ~9.1m in old TS)
 * - Alpha_H: Horizontal dominance threshold = 7.0 (was combined Alpha=1)
 * - Alpha_V: Vertical dominance threshold = 1.0 (was combined Alpha=1)
 * - tbuf: Time buffer in seconds = 5.0
 * - compressionFactor: Waypoint sampling rate = 20 (was 50)
 */
export interface UplanConfig {
  /** Total System Error Horizontal in meters */
  TSE_H: number;
  /** Total System Error Vertical in meters */
  TSE_V: number;
  /** Horizontal dominance threshold (isHorizontal if h_dist > Alpha_H * v_dist) */
  Alpha_H: number;
  /** Vertical dominance threshold (isVertical if v_dist > Alpha_V * h_dist) */
  Alpha_V: number;
  /** Time buffer in seconds added before/after segment */
  tbuf: number;
  /** Waypoint compression factor (keep every Nth waypoint) */
  compressionFactor: number;
}

/**
 * Default configuration matching C++ implementation
 */
export const DEFAULT_UPLAN_CONFIG: UplanConfig = {
  TSE_H: 15.0, // meters
  TSE_V: 10.0, // meters
  Alpha_H: 7.0,
  Alpha_V: 1.0,
  tbuf: 5.0, // seconds
  compressionFactor: 20,
};

/**
 * Waypoint with time, position, and altitude
 */
export interface Waypoint {
  /** Time offset in seconds from flight start */
  time: number;
  /** Latitude in degrees */
  lat: number;
  /** Longitude in degrees */
  lon: number;
  /** Altitude in meters (AGL) */
  h: number;
}

/**
 * Segment type classification
 */
export enum SegmentType {
  /** Horizontal: horizontal distance dominates */
  HORIZONTAL = "HORIZONTAL",
  /** Vertical: vertical distance dominates */
  VERTICAL = "VERTICAL",
  /** Mixed: neither dominates, use combined approach */
  MIXED = "MIXED",
}

/**
 * Operation volume for a flight segment
 */
export interface OperationVolume {
  /** GeoJSON Polygon geometry with bbox */
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][]; // [lon, lat] format for GeoJSON
    bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  };
  /** Start time in ISO 8601 format */
  timeBegin: string;
  /** End time in ISO 8601 format */
  timeEnd: string;
  /** Minimum altitude */
  minAltitude: {
    value: number;
    reference: "AGL" | "WGS84";
    uom: "M" | "FT";
  };
  /** Maximum altitude */
  maxAltitude: {
    value: number;
    reference: "AGL" | "WGS84";
    uom: "M" | "FT";
  };
  /** Sequential order of this volume in the flight */
  ordinal: number;
}

/**
 * Result structure matching BBox format for compatibility with generateJSON
 */
export interface OrientedBBox {
  /** Number of sub-segments per segment */
  N: number[];
  /** Altitude ranges indexed by "segment,subsegment" */
  alt: Record<string, [number, number]>;
  /** Polygon coordinates indexed by "segment,subsegment" */
  bbox: Record<string, [number, number][]>;
  /** Time ranges indexed by "segment,subsegment" */
  time: Record<string, [number, number]>;
}

/**
 * Detect the type of a flight segment based on horizontal vs vertical distance.
 *
 * Classification rules (from C++):
 * - HORIZONTAL: horizontalDistance > Alpha_H * verticalDistance
 * - VERTICAL: verticalDistance > Alpha_V * horizontalDistance
 * - MIXED: neither condition met
 *
 * @param horizontalDistance - Horizontal geodetic distance in meters
 * @param verticalDistance - Absolute altitude change in meters
 * @param config - Configuration with Alpha_H and Alpha_V thresholds
 * @returns SegmentType classification
 */
export function detectSegmentType(
  horizontalDistance: number,
  verticalDistance: number,
  config: UplanConfig = DEFAULT_UPLAN_CONFIG
): SegmentType {
  const isHorizontal = horizontalDistance > config.Alpha_H * verticalDistance;
  const isVertical = verticalDistance > config.Alpha_V * horizontalDistance;

  if (isHorizontal) {
    return SegmentType.HORIZONTAL;
  } else if (isVertical) {
    return SegmentType.VERTICAL;
  } else {
    return SegmentType.MIXED;
  }
}

/**
 * Calculate along-track and cross-track buffer dimensions based on segment type.
 *
 * For horizontal segments:
 * - Along-track: half the horizontal distance + TSE_H
 * - Cross-track: TSE_H
 * - Vertical: TSE_V
 *
 * For vertical segments:
 * - Along-track: TSE_H
 * - Cross-track: TSE_H
 * - Vertical: half the vertical distance + TSE_V
 *
 * For mixed segments:
 * - Along-track: half the horizontal distance + TSE_H
 * - Cross-track: TSE_H
 * - Vertical: half the vertical distance + TSE_V
 *
 * @param segmentType - Classification of the segment
 * @param horizontalDistance - Horizontal geodetic distance in meters
 * @param verticalDistance - Absolute altitude change in meters
 * @param config - Configuration with TSE values
 * @returns Object with alongTrack, crossTrack, and verticalBuffer in meters
 */
export function calculateTrackBuffers(
  segmentType: SegmentType,
  horizontalDistance: number,
  verticalDistance: number,
  config: UplanConfig = DEFAULT_UPLAN_CONFIG
): { alongTrack: number; crossTrack: number; verticalBuffer: number } {
  switch (segmentType) {
    case SegmentType.HORIZONTAL:
      return {
        alongTrack: horizontalDistance / 2 + config.TSE_H,
        crossTrack: config.TSE_H,
        verticalBuffer: config.TSE_V,
      };

    case SegmentType.VERTICAL:
      return {
        alongTrack: config.TSE_H,
        crossTrack: config.TSE_H,
        verticalBuffer: verticalDistance / 2 + config.TSE_V,
      };

    case SegmentType.MIXED:
    default:
      return {
        alongTrack: horizontalDistance / 2 + config.TSE_H,
        crossTrack: config.TSE_H,
        verticalBuffer: verticalDistance / 2 + config.TSE_V,
      };
  }
}

/**
 * Generate the four corners of an oriented rectangle centered on a point.
 *
 * The rectangle is aligned with the trajectory azimuth:
 * - alongTrack is measured in the direction of the azimuth
 * - crossTrack is measured perpendicular to the azimuth
 *
 * Corner order: [front-left, front-right, back-right, back-left, front-left(close)]
 * This creates a closed polygon suitable for GeoJSON.
 *
 * @param centerLat - Latitude of rectangle center in degrees
 * @param centerLon - Longitude of rectangle center in degrees
 * @param azimuth - Direction of the trajectory in degrees (0 = North)
 * @param alongTrack - Half-length along the track direction in meters
 * @param crossTrack - Half-width perpendicular to track in meters
 * @returns Array of 5 corner points [lat, lon] (first repeated at end to close polygon)
 */
export function generateOrientedRectangleCorners(
  centerLat: number,
  centerLon: number,
  azimuth: number,
  alongTrack: number,
  crossTrack: number
): [number, number][] {
  // Calculate the four corner azimuths relative to center
  // Front = along azimuth, Back = opposite to azimuth
  // Left = perpendicular left, Right = perpendicular right
  const forwardAzimuth = normalizeAzimuth(azimuth);
  const backwardAzimuth = normalizeAzimuth(azimuth + 180);
  const leftAzimuth = normalizeAzimuth(azimuth - 90);
  const rightAzimuth = normalizeAzimuth(azimuth + 90);

  // Calculate front-center and back-center points
  const frontCenter = calculateDestinationPoint(
    centerLat,
    centerLon,
    forwardAzimuth,
    alongTrack
  );
  const backCenter = calculateDestinationPoint(
    centerLat,
    centerLon,
    backwardAzimuth,
    alongTrack
  );

  // Calculate the four corners from front and back centers
  const frontLeft = calculateDestinationPoint(
    frontCenter.lat,
    frontCenter.lon,
    leftAzimuth,
    crossTrack
  );
  const frontRight = calculateDestinationPoint(
    frontCenter.lat,
    frontCenter.lon,
    rightAzimuth,
    crossTrack
  );
  const backRight = calculateDestinationPoint(
    backCenter.lat,
    backCenter.lon,
    rightAzimuth,
    crossTrack
  );
  const backLeft = calculateDestinationPoint(
    backCenter.lat,
    backCenter.lon,
    leftAzimuth,
    crossTrack
  );

  // Return as [lat, lon] pairs in polygon order (closed)
  return [
    [frontLeft.lat, frontLeft.lon],
    [frontRight.lat, frontRight.lon],
    [backRight.lat, backRight.lon],
    [backLeft.lat, backLeft.lon],
    [frontLeft.lat, frontLeft.lon], // Close the polygon
  ];
}

/**
 * Format a POSIX timestamp as ISO 8601 string without milliseconds.
 *
 * @param timestamp - POSIX timestamp in seconds
 * @returns ISO 8601 formatted string (e.g., "2026-01-27T14:30:00")
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

/**
 * Calculate bounding box from corner points.
 *
 * @param corners - Array of [lat, lon] pairs
 * @returns [minLon, minLat, maxLon, maxLat]
 */
function calculateBboxFromCorners(
  corners: [number, number][]
): [number, number, number, number] {
  const lats = corners.map(([lat]) => lat);
  const lons = corners.map(([, lon]) => lon);

  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];
}

/**
 * Generate oriented operation volumes for a flight trajectory.
 *
 * This function creates oriented rectangular volumes that follow the flight
 * trajectory. Unlike axis-aligned volumes, these rectangles are rotated to
 * align with the direction of travel.
 *
 * The algorithm:
 * 1. For each waypoint pair (segment), calculate distance and azimuth
 * 2. Determine if segment is horizontal, vertical, or mixed
 * 3. Calculate appropriate buffer dimensions
 * 4. Generate an oriented rectangle centered on the segment midpoint
 * 5. Add time buffers for temporal reservation
 *
 * @param waypoints - Array of waypoints defining the flight path
 * @param startTimestamp - POSIX timestamp (seconds) for flight start
 * @param config - Configuration parameters for volume generation
 * @returns Array of OperationVolume objects
 */
export function generateOrientedVolumes(
  waypoints: Waypoint[],
  startTimestamp: number,
  config: UplanConfig = DEFAULT_UPLAN_CONFIG
): OperationVolume[] {
  if (waypoints.length < 2) {
    return [];
  }

  const volumes: OperationVolume[] = [];
  let ordinal = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp1 = waypoints[i];
    const wp2 = waypoints[i + 1];

    // Calculate horizontal distance and azimuth
    const horizontalDistance = calculateVincentyDistance(
      wp1.lat,
      wp1.lon,
      wp2.lat,
      wp2.lon
    );

    const azimuth = calculateVincentyAzimuth(
      wp1.lat,
      wp1.lon,
      wp2.lat,
      wp2.lon
    );

    // Calculate vertical distance
    const verticalDistance = Math.abs(wp2.h - wp1.h);

    // Determine segment type
    const segmentType = detectSegmentType(
      horizontalDistance,
      verticalDistance,
      config
    );

    // Calculate buffer dimensions
    const { alongTrack, crossTrack, verticalBuffer } = calculateTrackBuffers(
      segmentType,
      horizontalDistance,
      verticalDistance,
      config
    );

    // Calculate midpoint for the volume center
    const midLat = (wp1.lat + wp2.lat) / 2;
    const midLon = (wp1.lon + wp2.lon) / 2;
    const midAlt = (wp1.h + wp2.h) / 2;

    // Generate oriented rectangle corners
    const corners = generateOrientedRectangleCorners(
      midLat,
      midLon,
      azimuth,
      alongTrack,
      crossTrack
    );

    // Calculate bounding box
    const bbox = calculateBboxFromCorners(corners);

    // Convert corners to GeoJSON format [lon, lat]
    const geoJsonCoords = corners.map(([lat, lon]) => [lon, lat] as [number, number]);

    // Calculate time bounds with buffer
    // If times are small, they're relative to startTimestamp
    // If times are large (> 1000000), they're already POSIX timestamps
    const isRelativeTime = wp1.time < 1000000;
    const t1 = isRelativeTime ? startTimestamp + wp1.time : wp1.time;
    const t2 = isRelativeTime ? startTimestamp + wp2.time : wp2.time;

    // Calculate altitude bounds
    const minAlt = Math.max(midAlt - verticalBuffer, 10); // Minimum 10m AGL
    const maxAlt = midAlt + verticalBuffer;

    volumes.push({
      geometry: {
        type: "Polygon",
        coordinates: [geoJsonCoords],
        bbox,
      },
      timeBegin: formatTimestamp(t1 - config.tbuf),
      timeEnd: formatTimestamp(t2 + config.tbuf),
      minAltitude: {
        value: minAlt,
        reference: "AGL",
        uom: "M",
      },
      maxAltitude: {
        value: maxAlt,
        reference: "AGL",
        uom: "M",
      },
      ordinal,
    });

    ordinal++;
  }

  return volumes;
}

/**
 * Generate oriented volumes in BBox format for compatibility with generateJSON.
 *
 * This function provides the same output format as generate_bbox.ts but uses
 * oriented rectangles instead of axis-aligned squares.
 *
 * @param initTime - POSIX timestamp (seconds) for flight start
 * @param waypoints - Array of waypoints defining the flight path
 * @param config - Configuration parameters for volume generation
 * @returns OrientedBBox compatible with the existing generateJSON function
 */
export function generateOrientedBBox(
  initTime: number,
  waypoints: Waypoint[],
  config: UplanConfig = DEFAULT_UPLAN_CONFIG
): OrientedBBox {
  const result: OrientedBBox = {
    N: [],
    alt: {},
    bbox: {},
    time: {},
  };

  if (waypoints.length < 2) {
    return result;
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp1 = waypoints[i];
    const wp2 = waypoints[i + 1];

    // For oriented volumes, we generate one volume per segment (N=1)
    // This differs from generate_bbox which subdivides long segments
    result.N[i] = 1;

    const key = `${i},0`;

    // Calculate horizontal distance and azimuth
    const horizontalDistance = calculateVincentyDistance(
      wp1.lat,
      wp1.lon,
      wp2.lat,
      wp2.lon
    );

    const azimuth = calculateVincentyAzimuth(
      wp1.lat,
      wp1.lon,
      wp2.lat,
      wp2.lon
    );

    // Calculate vertical distance
    const verticalDistance = Math.abs(wp2.h - wp1.h);

    // Determine segment type
    const segmentType = detectSegmentType(
      horizontalDistance,
      verticalDistance,
      config
    );

    // Calculate buffer dimensions
    const { alongTrack, crossTrack, verticalBuffer } = calculateTrackBuffers(
      segmentType,
      horizontalDistance,
      verticalDistance,
      config
    );

    // Calculate midpoint
    const midLat = (wp1.lat + wp2.lat) / 2;
    const midLon = (wp1.lon + wp2.lon) / 2;
    const midAlt = (wp1.h + wp2.h) / 2;

    // Generate oriented rectangle corners [lat, lon] format
    const corners = generateOrientedRectangleCorners(
      midLat,
      midLon,
      azimuth,
      alongTrack,
      crossTrack
    );

    // Store in result (normalize longitude)
    result.bbox[key] = corners.map(([lat, lon]) => [
      lat,
      ((lon + 180) % 360 + 360) % 360 - 180,
    ]);

    // Altitude bounds
    result.alt[key] = [
      midAlt + verticalBuffer, // max
      Math.max(midAlt - verticalBuffer, 10), // min (at least 10m)
    ];

    // Time bounds
    const isRelativeTime = wp1.time < 1000000;
    if (isRelativeTime) {
      result.time[key] = [
        initTime + wp1.time - config.tbuf,
        initTime + wp2.time + config.tbuf,
      ];
    } else {
      result.time[key] = [
        wp1.time - config.tbuf,
        wp2.time + config.tbuf,
      ];
    }
  }

  return result;
}

/**
 * Compress waypoints by taking every Nth point.
 *
 * This function matches the C++ implementation: it starts from index 1
 * (skipping the first waypoint) and takes every compressionFactor-th point.
 * The last waypoint is always included if not already sampled.
 *
 * C++ equivalent: wp_reduced = wp(2:compression_factor:end, :) (MATLAB notation)
 *
 * @param waypoints - Full array of waypoints
 * @param compressionFactor - Keep every Nth waypoint (default: 20)
 * @returns Compressed waypoint array
 */
export function compressWaypoints(
  waypoints: Waypoint[],
  compressionFactor: number = DEFAULT_UPLAN_CONFIG.compressionFactor
): Waypoint[] {
  if (waypoints.length <= 2) {
    return waypoints;
  }

  const result: Waypoint[] = [];

  // Start from index 1 (skip first waypoint) and step by compressionFactor
  // This matches C++ logic: for (i = 1; i < size; i += compression_factor)
  for (let i = 1; i < waypoints.length; i += compressionFactor) {
    result.push(waypoints[i]);
  }

  // Always include last waypoint if not already included
  const lastWaypoint = waypoints[waypoints.length - 1];
  if (result.length === 0 || result[result.length - 1].time !== lastWaypoint.time) {
    result.push(lastWaypoint);
  }

  return result;
}
