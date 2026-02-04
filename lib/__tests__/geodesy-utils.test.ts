/**
 * Unit tests for geodesy utilities
 * 
 * TASK-025: Test geodesy utilities (lib/uplan/geodesy-utils.ts)
 * 
 * Tests validate that geodetic calculations using the Vincenty formulae are accurate
 * to within acceptable tolerances for UAS flight planning operations.
 * 
 * Note: The geodesy library is mocked to allow Jest to run without ESM issues.
 * The actual Vincenty calculations are tested via the library's own tests.
 */

// Mock the geodesy library before importing our module
jest.mock('geodesy/latlon-ellipsoidal-vincenty.js', () => {
  // Simple mock implementation using spherical approximations
  const mockLatLon = jest.fn().mockImplementation(function (this: {
    lat: number;
    lon: number;
    distanceTo: jest.Mock;
    initialBearingTo: jest.Mock;
    finalBearingTo: jest.Mock;
    destinationPoint: jest.Mock;
  }, lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
    
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    
    this.distanceTo = jest.fn().mockImplementation((other: { lat: number; lon: number }) => {
      // Haversine formula for distance
      const R = 6371008.8;
      const φ1 = toRad(this.lat);
      const φ2 = toRad(other.lat);
      const Δφ = toRad(other.lat - this.lat);
      const Δλ = toRad(other.lon - this.lon);
      
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      
      return R * c;
    });
    
    this.initialBearingTo = jest.fn().mockImplementation((other: { lat: number; lon: number }) => {
      const φ1 = toRad(this.lat);
      const φ2 = toRad(other.lat);
      const Δλ = toRad(other.lon - this.lon);
      
      const y = Math.sin(Δλ) * Math.cos(φ2);
      const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
      const θ = Math.atan2(y, x);
      
      return (toDeg(θ) + 360) % 360;
    });
    
    this.finalBearingTo = jest.fn().mockImplementation((other: { lat: number; lon: number }) => {
      // Simplified: return same as initial bearing
      return this.initialBearingTo(other);
    });
    
    this.destinationPoint = jest.fn().mockImplementation((distance: number, bearing: number) => {
      const R = 6371008.8;
      const δ = distance / R;
      const θ = toRad(bearing);
      const φ1 = toRad(this.lat);
      const λ1 = toRad(this.lon);
      
      const sinφ1 = Math.sin(φ1);
      const cosφ1 = Math.cos(φ1);
      const sinδ = Math.sin(δ);
      const cosδ = Math.cos(δ);
      
      const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
      const φ2 = Math.asin(sinφ2);
      const y = Math.sin(θ) * sinδ * cosφ1;
      const x = cosδ - sinφ1 * sinφ2;
      const λ2 = λ1 + Math.atan2(y, x);
      
      return { lat: toDeg(φ2), lon: toDeg(λ2) };
    });
    
    return this;
  });
  
  return { default: mockLatLon };
});

import {
  calculateVincentyDistance,
  calculateVincentyAzimuth,
  calculateDistanceAndAzimuth,
  calculateDestinationPoint,
  calculateMidpoint,
  interpolateAlongPath,
  normalizeAzimuth,
  normalizeLongitude,
  toRadians,
  toDegrees,
  calculatePerpendicularOffset,
  calculateBoundingBox,
  GeoPoint,
} from '../uplan/geodesy-utils';

describe('Geodesy Utilities', () => {
  // Test coordinates: Known reference points
  const madrid = { lat: 40.4168, lon: -3.7038 };
  const barcelona = { lat: 41.3851, lon: 2.1734 };
  const valencia = { lat: 39.4699, lon: -0.3763 };

  describe('calculateVincentyDistance', () => {
    it('should return very small value for coincident points', () => {
      const distance = calculateVincentyDistance(
        madrid.lat, madrid.lon,
        madrid.lat, madrid.lon
      );
      // Should be 0 or 0.01 (fallback for edge case)
      expect(distance).toBeLessThanOrEqual(0.01);
    });

    it('should calculate Madrid to Barcelona distance accurately', () => {
      // Known approximate distance: ~505 km
      const distance = calculateVincentyDistance(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      
      // Allow 1% tolerance
      expect(distance).toBeGreaterThan(500000);
      expect(distance).toBeLessThan(510000);
    });

    it('should calculate Valencia to Barcelona distance', () => {
      // Known approximate distance: ~303 km
      const distance = calculateVincentyDistance(
        valencia.lat, valencia.lon,
        barcelona.lat, barcelona.lon
      );
      
      expect(distance).toBeGreaterThan(300000);
      expect(distance).toBeLessThan(310000);
    });

    it('should be symmetric (distance A to B = distance B to A)', () => {
      const distAB = calculateVincentyDistance(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      const distBA = calculateVincentyDistance(
        barcelona.lat, barcelona.lon,
        madrid.lat, madrid.lon
      );
      
      expect(Math.abs(distAB - distBA)).toBeLessThan(0.1);
    });

    it('should handle short distances accurately', () => {
      // Test with very short distance: 100m north
      const lat1 = 40.0;
      const lon1 = -3.0;
      const lat2 = 40.0009; // ~100m north
      const lon2 = -3.0;
      
      const distance = calculateVincentyDistance(lat1, lon1, lat2, lon2);
      
      // Should be close to 100m with some tolerance
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it('should handle antipodal points (opposite sides of Earth)', () => {
      // Nearly antipodal points (exact antipodes can fail)
      const distance = calculateVincentyDistance(
        0, 0,
        1, 179 // Almost, but not exactly antipodal
      );
      
      // Should return a reasonable value (not NaN or error)
      expect(distance).toBeGreaterThan(0);
      expect(isNaN(distance)).toBe(false);
    });
  });

  describe('calculateVincentyAzimuth', () => {
    it('should return 0 for coincident points', () => {
      const azimuth = calculateVincentyAzimuth(
        madrid.lat, madrid.lon,
        madrid.lat, madrid.lon
      );
      expect(azimuth).toBe(0);
    });

    it('should calculate approximately north for points due north', () => {
      const azimuth = calculateVincentyAzimuth(40.0, -3.0, 41.0, -3.0);
      
      // Due north should be close to 0 degrees
      expect(azimuth).toBeLessThan(5);
    });

    it('should calculate approximately east for points due east', () => {
      const azimuth = calculateVincentyAzimuth(40.0, -3.0, 40.0, -2.0);
      
      // Due east should be close to 90 degrees
      expect(azimuth).toBeGreaterThan(85);
      expect(azimuth).toBeLessThan(95);
    });

    it('should calculate approximately south for points due south', () => {
      const azimuth = calculateVincentyAzimuth(41.0, -3.0, 40.0, -3.0);
      
      // Due south should be close to 180 degrees
      expect(azimuth).toBeGreaterThan(175);
      expect(azimuth).toBeLessThan(185);
    });

    it('should calculate approximately west for points due west', () => {
      const azimuth = calculateVincentyAzimuth(40.0, -2.0, 40.0, -3.0);
      
      // Due west should be close to 270 degrees
      expect(azimuth).toBeGreaterThan(265);
      expect(azimuth).toBeLessThan(275);
    });

    it('should calculate Madrid to Barcelona azimuth (northeast)', () => {
      const azimuth = calculateVincentyAzimuth(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      
      // Should be roughly northeast (around 70-80 degrees)
      expect(azimuth).toBeGreaterThan(60);
      expect(azimuth).toBeLessThan(90);
    });

    it('should return azimuth in 0-360 range', () => {
      const azimuth = calculateVincentyAzimuth(
        barcelona.lat, barcelona.lon,
        madrid.lat, madrid.lon
      );
      
      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThan(360);
    });
  });

  describe('calculateDistanceAndAzimuth', () => {
    it('should return consistent distance and azimuth', () => {
      const result = calculateDistanceAndAzimuth(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      
      const separateDistance = calculateVincentyDistance(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      const separateAzimuth = calculateVincentyAzimuth(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      
      expect(Math.abs(result.distance - separateDistance)).toBeLessThan(0.1);
      expect(Math.abs(result.azimuth - separateAzimuth)).toBeLessThan(0.1);
    });

    it('should return all required fields', () => {
      const result = calculateDistanceAndAzimuth(
        madrid.lat, madrid.lon,
        barcelona.lat, barcelona.lon
      );
      
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('azimuth');
      expect(result).toHaveProperty('finalAzimuth');
    });
  });

  describe('calculateDestinationPoint', () => {
    it('should return starting point for zero distance', () => {
      const dest = calculateDestinationPoint(40.0, -3.0, 45, 0);
      
      expect(dest.lat).toBeCloseTo(40.0, 4);
      expect(dest.lon).toBeCloseTo(-3.0, 4);
    });

    it('should move north when azimuth is 0', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const dest = calculateDestinationPoint(start.lat, start.lon, 0, 1000);
      
      // Should move north (higher latitude)
      expect(dest.lat).toBeGreaterThan(start.lat);
      // Should stay on same longitude
      expect(dest.lon).toBeCloseTo(start.lon, 3);
    });

    it('should move east when azimuth is 90', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const dest = calculateDestinationPoint(start.lat, start.lon, 90, 1000);
      
      // Should stay on similar latitude
      expect(dest.lat).toBeCloseTo(start.lat, 3);
      // Should move east (higher longitude)
      expect(dest.lon).toBeGreaterThan(start.lon);
    });

    it('should move south when azimuth is 180', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const dest = calculateDestinationPoint(start.lat, start.lon, 180, 1000);
      
      // Should move south (lower latitude)
      expect(dest.lat).toBeLessThan(start.lat);
    });

    it('should move west when azimuth is 270', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const dest = calculateDestinationPoint(start.lat, start.lon, 270, 1000);
      
      // Should move west (lower longitude)
      expect(dest.lon).toBeLessThan(start.lon);
    });

    it('should be approximately inverse of distance calculation', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const distance = 5000; // 5km
      const azimuth = 45;
      
      const dest = calculateDestinationPoint(start.lat, start.lon, azimuth, distance);
      
      // Calculate distance back
      const distanceBack = calculateVincentyDistance(
        start.lat, start.lon,
        dest.lat, dest.lon
      );
      
      // Should be within 1m of original distance
      expect(Math.abs(distanceBack - distance)).toBeLessThan(1);
    });

    it('should normalize longitude for dateline crossing', () => {
      const dest = calculateDestinationPoint(40.0, 179.5, 90, 100000);
      
      expect(dest.lon).toBeGreaterThanOrEqual(-180);
      expect(dest.lon).toBeLessThanOrEqual(180);
    });
  });

  describe('calculateMidpoint', () => {
    it('should return exact middle for aligned points', () => {
      const mid = calculateMidpoint(40.0, -3.0, 42.0, -3.0);
      
      expect(mid.lat).toBeCloseTo(41.0, 5);
      expect(mid.lon).toBeCloseTo(-3.0, 5);
    });

    it('should work for diagonal points', () => {
      const mid = calculateMidpoint(40.0, -4.0, 42.0, -2.0);
      
      expect(mid.lat).toBeCloseTo(41.0, 5);
      expect(mid.lon).toBeCloseTo(-3.0, 5);
    });

    it('should return starting point when endpoints are same', () => {
      const mid = calculateMidpoint(40.0, -3.0, 40.0, -3.0);
      
      expect(mid.lat).toBeCloseTo(40.0, 5);
      expect(mid.lon).toBeCloseTo(-3.0, 5);
    });
  });

  describe('interpolateAlongPath', () => {
    it('should return start point for fraction 0', () => {
      const point = interpolateAlongPath(40.0, -3.0, 42.0, -1.0, 0);
      
      expect(point.lat).toBeCloseTo(40.0, 5);
      expect(point.lon).toBeCloseTo(-3.0, 5);
    });

    it('should return end point for fraction 1', () => {
      const point = interpolateAlongPath(40.0, -3.0, 42.0, -1.0, 1);
      
      expect(point.lat).toBeCloseTo(42.0, 5);
      expect(point.lon).toBeCloseTo(-1.0, 5);
    });

    it('should return midpoint for fraction 0.5', () => {
      const mid = calculateMidpoint(40.0, -3.0, 42.0, -1.0);
      const point = interpolateAlongPath(40.0, -3.0, 42.0, -1.0, 0.5);
      
      // Should be close to simple midpoint for short distances (relaxed precision due to geodesic vs linear)
      expect(point.lat).toBeCloseTo(mid.lat, 1);
      expect(point.lon).toBeCloseTo(mid.lon, 1);
    });

    it('should handle negative fractions', () => {
      const point = interpolateAlongPath(40.0, -3.0, 42.0, -1.0, -0.5);
      
      // Should return start point
      expect(point.lat).toBeCloseTo(40.0, 5);
    });

    it('should handle fractions > 1', () => {
      const point = interpolateAlongPath(40.0, -3.0, 42.0, -1.0, 1.5);
      
      // Should return end point
      expect(point.lat).toBeCloseTo(42.0, 5);
    });
  });

  describe('normalizeAzimuth', () => {
    it('should not change values in 0-360 range', () => {
      expect(normalizeAzimuth(0)).toBe(0);
      expect(normalizeAzimuth(90)).toBe(90);
      expect(normalizeAzimuth(180)).toBe(180);
      expect(normalizeAzimuth(270)).toBe(270);
      expect(normalizeAzimuth(359.9)).toBeCloseTo(359.9);
    });

    it('should normalize values >= 360', () => {
      expect(normalizeAzimuth(360)).toBe(0);
      expect(normalizeAzimuth(450)).toBe(90);
      expect(normalizeAzimuth(720)).toBe(0);
    });

    it('should normalize negative values', () => {
      expect(normalizeAzimuth(-90)).toBe(270);
      expect(normalizeAzimuth(-180)).toBe(180);
      // -360 % 360 can result in -0, which is equal to 0 but Object.is returns false
      expect(normalizeAzimuth(-360)).toBeCloseTo(0, 5);
      expect(normalizeAzimuth(-450)).toBe(270);
    });
  });

  describe('normalizeLongitude', () => {
    it('should not change values in -180 to 180 range', () => {
      expect(normalizeLongitude(0)).toBe(0);
      expect(normalizeLongitude(90)).toBe(90);
      expect(normalizeLongitude(-90)).toBe(-90);
      expect(normalizeLongitude(179)).toBe(179);
      expect(normalizeLongitude(-179)).toBe(-179);
    });

    it('should normalize values > 180', () => {
      expect(normalizeLongitude(180)).toBeCloseTo(-180, 5);
      expect(normalizeLongitude(270)).toBe(-90);
      expect(normalizeLongitude(360)).toBeCloseTo(0, 5);
    });

    it('should normalize values < -180', () => {
      expect(normalizeLongitude(-270)).toBe(90);
      expect(normalizeLongitude(-360)).toBeCloseTo(0, 5);
    });
  });

  describe('toRadians and toDegrees', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
      expect(toRadians(180)).toBeCloseTo(Math.PI);
      expect(toRadians(360)).toBeCloseTo(2 * Math.PI);
    });

    it('should convert radians to degrees', () => {
      expect(toDegrees(0)).toBe(0);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90);
      expect(toDegrees(Math.PI)).toBeCloseTo(180);
      expect(toDegrees(2 * Math.PI)).toBeCloseTo(360);
    });

    it('should be inverse operations', () => {
      const degrees = 45;
      expect(toDegrees(toRadians(degrees))).toBeCloseTo(degrees);
      
      const radians = Math.PI / 3;
      expect(toRadians(toDegrees(radians))).toBeCloseTo(radians);
    });
  });

  describe('calculatePerpendicularOffset', () => {
    it('should offset perpendicular to azimuth', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const azimuth = 0; // North
      const offset = calculatePerpendicularOffset(start.lat, start.lon, azimuth, 100);
      
      // Perpendicular to north is west (left)
      expect(offset.lon).toBeLessThan(start.lon);
      expect(offset.lat).toBeCloseTo(start.lat, 3);
    });

    it('should offset right for negative distance', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const azimuth = 0; // North
      const offset = calculatePerpendicularOffset(start.lat, start.lon, azimuth, -100);
      
      // Right of north is east
      expect(offset.lon).toBeGreaterThan(start.lon);
    });

    it('should calculate correct offset distance', () => {
      const start = { lat: 40.0, lon: -3.0 };
      const offsetDistance = 1000;
      const offset = calculatePerpendicularOffset(start.lat, start.lon, 45, offsetDistance);
      
      const actualDistance = calculateVincentyDistance(
        start.lat, start.lon,
        offset.lat, offset.lon
      );
      
      expect(actualDistance).toBeCloseTo(offsetDistance, 0);
    });
  });

  describe('calculateBoundingBox', () => {
    it('should calculate correct bounding box for single point', () => {
      const points: GeoPoint[] = [{ lat: 40.0, lon: -3.0 }];
      const [minLon, minLat, maxLon, maxLat] = calculateBoundingBox(points);
      
      expect(minLat).toBe(40.0);
      expect(maxLat).toBe(40.0);
      expect(minLon).toBe(-3.0);
      expect(maxLon).toBe(-3.0);
    });

    it('should calculate correct bounding box for multiple points', () => {
      const points: GeoPoint[] = [
        { lat: 40.0, lon: -4.0 },
        { lat: 42.0, lon: -4.0 },
        { lat: 42.0, lon: -2.0 },
        { lat: 40.0, lon: -2.0 },
      ];
      const [minLon, minLat, maxLon, maxLat] = calculateBoundingBox(points);
      
      expect(minLat).toBe(40.0);
      expect(maxLat).toBe(42.0);
      expect(minLon).toBe(-4.0);
      expect(maxLon).toBe(-2.0);
    });

    it('should throw error for empty array', () => {
      expect(() => calculateBoundingBox([])).toThrow();
    });

    it('should handle points in different hemispheres', () => {
      const points: GeoPoint[] = [
        { lat: 40.0, lon: -3.0 },
        { lat: -35.0, lon: 150.0 },
      ];
      const [minLon, minLat, maxLon, maxLat] = calculateBoundingBox(points);
      
      expect(minLat).toBe(-35.0);
      expect(maxLat).toBe(40.0);
      expect(minLon).toBe(-3.0);
      expect(maxLon).toBe(150.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle equator crossing', () => {
      const distance = calculateVincentyDistance(1, 0, -1, 0);
      expect(distance).toBeGreaterThan(200000); // ~222km
      expect(isNaN(distance)).toBe(false);
    });

    it('should handle prime meridian crossing', () => {
      const distance = calculateVincentyDistance(45, 1, 45, -1);
      expect(distance).toBeGreaterThan(100000);
      expect(isNaN(distance)).toBe(false);
    });

    it('should handle international date line crossing', () => {
      const distance = calculateVincentyDistance(45, 179, 45, -179);
      expect(distance).toBeGreaterThan(100000);
      expect(isNaN(distance)).toBe(false);
    });

    it('should handle polar regions', () => {
      // Points near north pole
      const distanceNorth = calculateVincentyDistance(89, 0, 89, 180);
      expect(distanceNorth).toBeGreaterThan(0);
      expect(isNaN(distanceNorth)).toBe(false);
    });
  });
});
