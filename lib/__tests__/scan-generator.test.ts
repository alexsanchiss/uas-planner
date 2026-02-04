/**
 * Unit tests for SCAN pattern generator
 * 
 * TASK-207: Test SCAN pattern generator (lib/scan-generator.ts)
 */

import {
  Point,
  Polygon,
  ScanConfig,
  haversineDistance,
  destinationPoint,
  polygonCentroid,
  polygonArea,
  polygonBoundingBox,
  normalizeAngle,
  validateScanConfig,
  generateScanWaypoints,
  MIN_POLYGON_AREA,
  MAX_POLYGON_AREA,
  MIN_SPACING,
  MAX_SPACING,
  MIN_VERTICES,
  MAX_VERTICES,
} from '../scan-generator';

describe('SCAN Pattern Generator', () => {
  describe('Constants', () => {
    it('should have correct polygon area limits', () => {
      expect(MIN_POLYGON_AREA).toBe(100);
      expect(MAX_POLYGON_AREA).toBe(10000000);
    });

    it('should have correct spacing limits', () => {
      expect(MIN_SPACING).toBe(1);
      expect(MAX_SPACING).toBe(1000);
    });

    it('should have correct vertex limits', () => {
      expect(MIN_VERTICES).toBe(3);
      expect(MAX_VERTICES).toBe(100);
    });
  });

  describe('haversineDistance', () => {
    it('should return 0 for same point', () => {
      const point: Point = { lat: 40.4168, lng: -3.7038 }; // Madrid
      const distance = haversineDistance(point, point);
      
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate distance between two points', () => {
      const madrid: Point = { lat: 40.4168, lng: -3.7038 };
      const barcelona: Point = { lat: 41.3851, lng: 2.1734 };
      
      const distance = haversineDistance(madrid, barcelona);
      
      // Distance should be approximately 505 km
      expect(distance).toBeGreaterThan(500000);
      expect(distance).toBeLessThan(510000);
    });

    it('should calculate short distances accurately', () => {
      const point1: Point = { lat: 40.4168, lng: -3.7038 };
      const point2: Point = { lat: 40.4178, lng: -3.7038 }; // ~111m north
      
      const distance = haversineDistance(point1, point2);
      
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(120);
    });

    it('should be symmetric', () => {
      const point1: Point = { lat: 40.0, lng: -3.0 };
      const point2: Point = { lat: 41.0, lng: -2.0 };
      
      const d1 = haversineDistance(point1, point2);
      const d2 = haversineDistance(point2, point1);
      
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  describe('destinationPoint', () => {
    it('should return same point with 0 distance', () => {
      const start: Point = { lat: 40.4168, lng: -3.7038 };
      const result = destinationPoint(start, 0, 0);
      
      expect(result.lat).toBeCloseTo(start.lat, 5);
      expect(result.lng).toBeCloseTo(start.lng, 5);
    });

    it('should move north correctly', () => {
      const start: Point = { lat: 40.0, lng: -3.0 };
      const result = destinationPoint(start, 0, 1000); // 1km north
      
      expect(result.lat).toBeGreaterThan(start.lat);
      expect(result.lng).toBeCloseTo(start.lng, 3);
    });

    it('should move east correctly', () => {
      const start: Point = { lat: 40.0, lng: -3.0 };
      const result = destinationPoint(start, 90, 1000); // 1km east
      
      expect(result.lat).toBeCloseTo(start.lat, 3);
      expect(result.lng).toBeGreaterThan(start.lng);
    });

    it('should move south correctly', () => {
      const start: Point = { lat: 40.0, lng: -3.0 };
      const result = destinationPoint(start, 180, 1000); // 1km south
      
      expect(result.lat).toBeLessThan(start.lat);
      expect(result.lng).toBeCloseTo(start.lng, 3);
    });

    it('should move west correctly', () => {
      const start: Point = { lat: 40.0, lng: -3.0 };
      const result = destinationPoint(start, 270, 1000); // 1km west
      
      expect(result.lat).toBeCloseTo(start.lat, 3);
      expect(result.lng).toBeLessThan(start.lng);
    });
  });

  describe('polygonCentroid', () => {
    it('should return origin for empty polygon', () => {
      const polygon: Polygon = { vertices: [] };
      const centroid = polygonCentroid(polygon);
      
      expect(centroid.lat).toBe(0);
      expect(centroid.lng).toBe(0);
    });

    it('should return single vertex for single-vertex polygon', () => {
      const polygon: Polygon = { vertices: [{ lat: 40.0, lng: -3.0 }] };
      const centroid = polygonCentroid(polygon);
      
      expect(centroid.lat).toBe(40.0);
      expect(centroid.lng).toBe(-3.0);
    });

    it('should calculate centroid of triangle', () => {
      const polygon: Polygon = {
        vertices: [
          { lat: 0.0, lng: 0.0 },
          { lat: 0.0, lng: 3.0 },
          { lat: 3.0, lng: 0.0 },
        ],
      };
      const centroid = polygonCentroid(polygon);
      
      expect(centroid.lat).toBeCloseTo(1.0, 5);
      expect(centroid.lng).toBeCloseTo(1.0, 5);
    });

    it('should calculate centroid of square', () => {
      const polygon: Polygon = {
        vertices: [
          { lat: 0.0, lng: 0.0 },
          { lat: 0.0, lng: 2.0 },
          { lat: 2.0, lng: 2.0 },
          { lat: 2.0, lng: 0.0 },
        ],
      };
      const centroid = polygonCentroid(polygon);
      
      expect(centroid.lat).toBeCloseTo(1.0, 5);
      expect(centroid.lng).toBeCloseTo(1.0, 5);
    });
  });

  describe('polygonArea', () => {
    it('should return 0 for polygon with less than 3 vertices', () => {
      expect(polygonArea({ vertices: [] })).toBe(0);
      expect(polygonArea({ vertices: [{ lat: 0, lng: 0 }] })).toBe(0);
      expect(polygonArea({ vertices: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] })).toBe(0);
    });

    it('should calculate area of a small square', () => {
      // ~100m x 100m square
      const polygon: Polygon = {
        vertices: [
          { lat: 40.0, lng: -3.0 },
          { lat: 40.0, lng: -2.999 },     // ~90m east
          { lat: 40.0009, lng: -2.999 },  // ~100m north
          { lat: 40.0009, lng: -3.0 },
        ],
      };
      const area = polygonArea(polygon);
      
      // Should be roughly 9000 sq meters
      expect(area).toBeGreaterThan(5000);
      expect(area).toBeLessThan(15000);
    });

    it('should handle triangles', () => {
      const polygon: Polygon = {
        vertices: [
          { lat: 40.0, lng: -3.0 },
          { lat: 40.0, lng: -2.998 },
          { lat: 40.002, lng: -2.999 },
        ],
      };
      const area = polygonArea(polygon);
      
      expect(area).toBeGreaterThan(0);
    });
  });

  describe('polygonBoundingBox', () => {
    it('should return origin for empty polygon', () => {
      const bbox = polygonBoundingBox({ vertices: [] });
      
      expect(bbox.min.lat).toBe(0);
      expect(bbox.min.lng).toBe(0);
      expect(bbox.max.lat).toBe(0);
      expect(bbox.max.lng).toBe(0);
    });

    it('should calculate bounding box correctly', () => {
      const polygon: Polygon = {
        vertices: [
          { lat: 10.0, lng: 20.0 },
          { lat: 15.0, lng: 25.0 },
          { lat: 12.0, lng: 30.0 },
          { lat: 8.0, lng: 22.0 },
        ],
      };
      const bbox = polygonBoundingBox(polygon);
      
      expect(bbox.min.lat).toBe(8.0);
      expect(bbox.min.lng).toBe(20.0);
      expect(bbox.max.lat).toBe(15.0);
      expect(bbox.max.lng).toBe(30.0);
    });
  });

  describe('normalizeAngle', () => {
    it('should return angles in 0-360 range', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(180)).toBe(180);
      expect(normalizeAngle(270)).toBe(270);
      expect(normalizeAngle(360)).toBe(0);
    });

    it('should normalize negative angles', () => {
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-180)).toBe(180);
      expect(normalizeAngle(-360)).toBeCloseTo(0, 5); // Handle -0 vs 0
      expect(normalizeAngle(-450)).toBe(270);
    });

    it('should normalize angles over 360', () => {
      expect(normalizeAngle(450)).toBe(90);
      expect(normalizeAngle(720)).toBe(0);
      expect(normalizeAngle(810)).toBe(90);
    });
  });

  describe('validateScanConfig', () => {
    // Create a valid base config for testing
    const createValidConfig = (): ScanConfig => ({
      polygon: {
        vertices: [
          { lat: 40.0, lng: -3.0 },
          { lat: 40.0, lng: -2.99 },
          { lat: 40.01, lng: -2.99 },
          { lat: 40.01, lng: -3.0 },
        ],
      },
      altitude: 100,
      spacing: 50,
      angle: 0,
    });

    it('should validate a correct config', () => {
      const config = createValidConfig();
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing polygon', () => {
      const config = { altitude: 100, spacing: 50, angle: 0 } as ScanConfig;
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Polygon is required');
    });

    it('should reject polygon with too few vertices', () => {
      const config = createValidConfig();
      config.polygon.vertices = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }];
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('at least'))).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      const config = createValidConfig();
      config.polygon.vertices[0] = { lat: 100, lng: 0 }; // Invalid latitude
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('latitude'))).toBe(true);
    });

    it('should reject negative altitude', () => {
      const config = createValidConfig();
      config.altitude = -10;
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Altitude'))).toBe(true);
    });

    it('should warn about high altitude', () => {
      const config = createValidConfig();
      config.altitude = 250;
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings.some(w => w.includes('200m'))).toBe(true);
    });

    it('should reject spacing below minimum', () => {
      const config = createValidConfig();
      config.spacing = 0.5;
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Spacing'))).toBe(true);
    });

    it('should reject spacing above maximum', () => {
      const config = createValidConfig();
      config.spacing = 1500;
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Spacing'))).toBe(true);
    });

    it('should validate start point coordinates', () => {
      const config = createValidConfig();
      config.startPoint = { lat: NaN, lng: 0 };
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Start point'))).toBe(true);
    });

    it('should validate end point coordinates', () => {
      const config = createValidConfig();
      config.endPoint = { lat: 0, lng: NaN };
      const result = validateScanConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('End point'))).toBe(true);
    });
  });

  describe('generateScanWaypoints', () => {
    const createValidConfig = (): ScanConfig => ({
      polygon: {
        vertices: [
          { lat: 40.0, lng: -3.0 },
          { lat: 40.0, lng: -2.995 },
          { lat: 40.005, lng: -2.995 },
          { lat: 40.005, lng: -3.0 },
        ],
      },
      altitude: 100,
      spacing: 100,
      angle: 0,
      speed: 10,
    });

    it('should generate waypoints for valid config', () => {
      const config = createValidConfig();
      const result = generateScanWaypoints(config);
      
      expect(result.waypoints).toBeDefined();
      expect(result.waypoints.length).toBeGreaterThan(0);
      expect(result.statistics).toBeDefined();
    });

    it('should include takeoff and landing waypoints', () => {
      const config = createValidConfig();
      const result = generateScanWaypoints(config);
      
      const takeoff = result.waypoints.find(w => w.type === 'takeoff');
      const landing = result.waypoints.find(w => w.type === 'landing');
      
      expect(takeoff).toBeDefined();
      expect(landing).toBeDefined();
    });

    it('should set correct altitude for waypoints', () => {
      const config = createValidConfig();
      config.altitude = 75;
      const result = generateScanWaypoints(config);
      
      const cruiseWaypoints = result.waypoints.filter(w => w.type === 'cruise');
      cruiseWaypoints.forEach(w => {
        expect(w.altitude).toBe(75);
      });
    });

    it('should set landing altitude to 0', () => {
      const config = createValidConfig();
      const result = generateScanWaypoints(config);
      
      const landing = result.waypoints.find(w => w.type === 'landing');
      expect(landing?.altitude).toBe(0);
    });

    it('should use specified speed', () => {
      const config = createValidConfig();
      config.speed = 15;
      const result = generateScanWaypoints(config);
      
      result.waypoints.forEach(w => {
        expect(w.speed).toBe(15);
      });
    });

    it('should default speed to 5 m/s', () => {
      const config = createValidConfig();
      delete config.speed;
      const result = generateScanWaypoints(config);
      
      result.waypoints.forEach(w => {
        expect(w.speed).toBe(5);
      });
    });

    it('should use custom start point', () => {
      const config = createValidConfig();
      config.startPoint = { lat: 40.002, lng: -2.998 };
      const result = generateScanWaypoints(config);
      
      const takeoff = result.waypoints[0];
      expect(takeoff.lat).toBeCloseTo(40.002, 5);
      expect(takeoff.lng).toBeCloseTo(-2.998, 5);
    });

    it('should use custom end point', () => {
      const config = createValidConfig();
      config.endPoint = { lat: 40.003, lng: -2.997 };
      const result = generateScanWaypoints(config);
      
      const landing = result.waypoints[result.waypoints.length - 1];
      expect(landing.lat).toBeCloseTo(40.003, 5);
      expect(landing.lng).toBeCloseTo(-2.997, 5);
    });

    it('should generate valid statistics', () => {
      const config = createValidConfig();
      const result = generateScanWaypoints(config);
      
      expect(result.statistics.waypointCount).toBe(result.waypoints.length);
      expect(result.statistics.totalDistance).toBeGreaterThan(0);
      expect(result.statistics.estimatedFlightTime).toBeGreaterThan(0);
      expect(result.statistics.coverageArea).toBeGreaterThan(0);
    });

    it('should throw for invalid config', () => {
      const config = createValidConfig();
      config.polygon.vertices = [{ lat: 0, lng: 0 }]; // Too few vertices
      
      expect(() => generateScanWaypoints(config)).toThrow();
    });

    it('should generate scan lines based on spacing', () => {
      const config = createValidConfig();
      config.spacing = 50;
      const result1 = generateScanWaypoints(config);
      
      config.spacing = 200;
      const result2 = generateScanWaypoints(config);
      
      // More spacing = fewer waypoints
      expect(result1.waypoints.length).toBeGreaterThan(result2.waypoints.length);
    });

    it('should handle different angles', () => {
      const config = createValidConfig();
      
      // All angles should produce valid results
      [0, 45, 90, 135, 180, 225, 270, 315].forEach(angle => {
        config.angle = angle;
        const result = generateScanWaypoints(config);
        expect(result.waypoints.length).toBeGreaterThan(0);
      });
    });
  });
});
