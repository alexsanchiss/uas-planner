/**
 * Geodesy utilities for UPPS
 * 
 * This module provides geodetic calculation functions using the Vincenty formulae
 * for high-accuracy distance and bearing calculations on the WGS84 ellipsoid.
 * 
 * These functions are used for generating oriented operation volumes for U-Plans.
 * 
 * Based on: lib/uplan/vincenty.ts but with additional functions and improved API.
 * 
 * @module geodesy-utils
 */

import LatLon from "geodesy/latlon-ellipsoidal-vincenty.js";

/**
 * WGS84 ellipsoid parameters
 */
export const WGS84 = {
  /** Semi-major axis in meters */
  a: 6378137.0,
  /** Semi-minor axis in meters (derived from flattening) */
  b: 6356752.314245,
  /** Flattening */
  f: 1 / 298.257223563,
} as const;

/**
 * Represents a geographic point with latitude and longitude
 */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Result of distance and azimuth calculation
 */
export interface DistanceAzimuthResult {
  /** Distance in meters */
  distance: number;
  /** Initial azimuth (forward bearing) in degrees from north (0-360) */
  azimuth: number;
  /** Final azimuth (reverse bearing) in degrees from north (0-360) */
  finalAzimuth: number;
}

/**
 * Calculate the geodetic distance between two points using the Vincenty formula.
 * 
 * The Vincenty formula is accurate to within 0.5mm on the WGS84 ellipsoid.
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in meters
 * 
 * @example
 * ```typescript
 * const distance = calculateVincentyDistance(40.4168, -3.7038, 41.3851, 2.1734);
 * console.log(`Madrid to Barcelona: ${distance}m`);
 * ```
 */
export function calculateVincentyDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  try {
    const p1 = new LatLon(lat1, lon1);
    const p2 = new LatLon(lat2, lon2);
    const distance = p1.distanceTo(p2);
    
    // Handle edge case where distance is undefined or NaN
    if (distance === undefined || isNaN(distance)) {
      // For coincident points, return small epsilon
      return 0.01;
    }
    
    return distance;
  } catch {
    // Fallback for antipodal points or other edge cases
    return calculateHaversineDistance(lat1, lon1, lat2, lon2);
  }
}

/**
 * Calculate the initial azimuth (forward bearing) from point 1 to point 2.
 * 
 * The azimuth is the angle measured clockwise from true north.
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Azimuth in degrees (0-360, where 0 is north, 90 is east)
 * 
 * @example
 * ```typescript
 * const azimuth = calculateVincentyAzimuth(40.4168, -3.7038, 41.3851, 2.1734);
 * console.log(`Bearing from Madrid to Barcelona: ${azimuth}°`);
 * ```
 */
export function calculateVincentyAzimuth(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  try {
    const p1 = new LatLon(lat1, lon1);
    const p2 = new LatLon(lat2, lon2);
    const azimuth = p1.initialBearingTo(p2);
    
    // Handle edge case where azimuth is undefined or NaN
    if (azimuth === undefined || isNaN(azimuth)) {
      return 0;
    }
    
    // Normalize to 0-360 range
    return normalizeAzimuth(azimuth);
  } catch {
    // Fallback calculation using simple spherical approximation
    return calculateSphericalBearing(lat1, lon1, lat2, lon2);
  }
}

/**
 * Calculate both distance and azimuth between two points.
 * 
 * This is more efficient than calling calculateVincentyDistance and
 * calculateVincentyAzimuth separately when both values are needed.
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Object containing distance (meters), azimuth (degrees), and finalAzimuth (degrees)
 */
export function calculateDistanceAndAzimuth(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): DistanceAzimuthResult {
  try {
    const p1 = new LatLon(lat1, lon1);
    const p2 = new LatLon(lat2, lon2);
    
    const distance = p1.distanceTo(p2);
    const azimuth = p1.initialBearingTo(p2);
    const finalAzimuth = p1.finalBearingTo(p2);
    
    return {
      distance: distance !== undefined && !isNaN(distance) ? distance : 0.01,
      azimuth: azimuth !== undefined && !isNaN(azimuth) ? normalizeAzimuth(azimuth) : 0,
      finalAzimuth: finalAzimuth !== undefined && !isNaN(finalAzimuth) ? normalizeAzimuth(finalAzimuth) : 0,
    };
  } catch {
    // Fallback for edge cases
    return {
      distance: calculateHaversineDistance(lat1, lon1, lat2, lon2),
      azimuth: calculateSphericalBearing(lat1, lon1, lat2, lon2),
      finalAzimuth: calculateSphericalBearing(lat1, lon1, lat2, lon2),
    };
  }
}

/**
 * Calculate the destination point given a starting point, azimuth, and distance.
 * 
 * Uses the Vincenty direct formula to compute the endpoint of a geodesic path.
 * 
 * @param lat - Latitude of starting point in degrees
 * @param lon - Longitude of starting point in degrees
 * @param azimuth - Initial bearing in degrees from north (0-360)
 * @param distance - Distance to travel in meters
 * @returns Destination point as {lat, lon} in degrees
 * 
 * @example
 * ```typescript
 * // Find point 1000m north of Madrid
 * const dest = calculateDestinationPoint(40.4168, -3.7038, 0, 1000);
 * console.log(`1km north of Madrid: ${dest.lat}, ${dest.lon}`);
 * ```
 */
export function calculateDestinationPoint(
  lat: number,
  lon: number,
  azimuth: number,
  distance: number
): GeoPoint {
  try {
    const p1 = new LatLon(lat, lon);
    const dest = p1.destinationPoint(distance, azimuth);
    
    return {
      lat: dest.lat,
      lon: normalizeLongitude(dest.lon),
    };
  } catch {
    // Fallback for edge cases using spherical approximation
    return calculateSphericalDestination(lat, lon, azimuth, distance);
  }
}

/**
 * Calculate the midpoint between two geographic points on the ellipsoid.
 * 
 * Note: This is a simple linear interpolation suitable for short distances.
 * For long distances, use interpolateAlongPath instead.
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Midpoint as {lat, lon} in degrees
 */
export function calculateMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): GeoPoint {
  // For short distances (typical in UAS operations), linear interpolation is sufficient
  // This matches the C++ implementation approach
  return {
    lat: (lat1 + lat2) / 2,
    lon: (lon1 + lon2) / 2,
  };
}

/**
 * Interpolate a point along the geodesic path between two points.
 * 
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @param fraction - Fraction of the distance (0 = start, 1 = end)
 * @returns Interpolated point as {lat, lon} in degrees
 */
export function interpolateAlongPath(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number
): GeoPoint {
  if (fraction <= 0) return { lat: lat1, lon: lon1 };
  if (fraction >= 1) return { lat: lat2, lon: lon2 };
  
  const { distance, azimuth } = calculateDistanceAndAzimuth(lat1, lon1, lat2, lon2);
  const interpolatedDistance = distance * fraction;
  
  return calculateDestinationPoint(lat1, lon1, azimuth, interpolatedDistance);
}

/**
 * Normalize an azimuth angle to the range [0, 360).
 * 
 * @param azimuth - Azimuth in degrees (any range)
 * @returns Normalized azimuth in degrees [0, 360)
 */
export function normalizeAzimuth(azimuth: number): number {
  let normalized = azimuth % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Normalize longitude to the range [-180, 180).
 * 
 * @param lon - Longitude in degrees (any range)
 * @returns Normalized longitude in degrees [-180, 180)
 */
export function normalizeLongitude(lon: number): number {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

/**
 * Convert degrees to radians.
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

// ============================================================================
// Fallback calculations for edge cases
// ============================================================================

/**
 * Calculate distance using the Haversine formula (fallback).
 * Less accurate than Vincenty but handles all edge cases.
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371008.8; // Earth's mean radius in meters
  
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Calculate bearing using spherical trigonometry (fallback).
 */
function calculateSphericalBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  
  return normalizeAzimuth(toDegrees(θ));
}

/**
 * Calculate destination point using spherical approximation (fallback).
 */
function calculateSphericalDestination(
  lat: number,
  lon: number,
  azimuth: number,
  distanceMeters: number
): GeoPoint {
  const R = 6371008.8; // Earth's mean radius in meters
  
  const δ = distanceMeters / R; // Angular distance
  const θ = toRadians(azimuth);
  const φ1 = toRadians(lat);
  const λ1 = toRadians(lon);
  
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinθ = Math.sin(θ);
  const cosθ = Math.cos(θ);
  
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * cosθ;
  const φ2 = Math.asin(sinφ2);
  const y = sinθ * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  
  return {
    lat: toDegrees(φ2),
    lon: normalizeLongitude(toDegrees(λ2)),
  };
}

// ============================================================================
// Utility functions for volume generation
// ============================================================================

/**
 * Calculate a perpendicular offset point from a given point and azimuth.
 * 
 * @param lat - Latitude of the point in degrees
 * @param lon - Longitude of the point in degrees
 * @param azimuth - Azimuth of the main direction in degrees
 * @param offsetDistance - Distance to offset (positive = left, negative = right)
 * @returns Offset point as {lat, lon}
 */
export function calculatePerpendicularOffset(
  lat: number,
  lon: number,
  azimuth: number,
  offsetDistance: number
): GeoPoint {
  // Left perpendicular is azimuth - 90 degrees
  const perpAzimuth = offsetDistance >= 0 
    ? normalizeAzimuth(azimuth - 90) 
    : normalizeAzimuth(azimuth + 90);
  
  return calculateDestinationPoint(lat, lon, perpAzimuth, Math.abs(offsetDistance));
}

/**
 * Calculate the four corners of an axis-aligned bounding box for the given points.
 * 
 * @param points - Array of geographic points
 * @returns Bounding box as [minLon, minLat, maxLon, maxLat]
 */
export function calculateBoundingBox(points: GeoPoint[]): [number, number, number, number] {
  if (points.length === 0) {
    throw new Error("Cannot calculate bounding box of empty points array");
  }
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  
  return [minLon, minLat, maxLon, maxLat];
}
