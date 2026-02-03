/**
 * Tests for generate_oriented_volumes module
 *
 * These tests verify the oriented volume generation logic including:
 * - Segment type detection (horizontal, vertical, mixed)
 * - Track buffer calculations
 * - Oriented rectangle corner generation
 * - Full volume generation from waypoints
 */

import {
  DEFAULT_UPLAN_CONFIG,
  SegmentType,
  Waypoint,
  detectSegmentType,
  calculateTrackBuffers,
  generateOrientedRectangleCorners,
  generateOrientedVolumes,
  generateOrientedBBox,
  compressWaypoints,
} from "../uplan/generate_oriented_volumes";

// Mock geodesy module for consistent test results
jest.mock("geodesy/latlon-ellipsoidal-vincenty.js", () => {
  return jest.fn().mockImplementation((lat: number, lon: number) => ({
    lat,
    lon,
    distanceTo: jest.fn().mockImplementation((other: { lat: number; lon: number }) => {
      // Simple Euclidean approximation for testing
      const dLat = (other.lat - lat) * 111320;
      const dLon = (other.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
      return Math.sqrt(dLat * dLat + dLon * dLon);
    }),
    initialBearingTo: jest.fn().mockImplementation((other: { lat: number; lon: number }) => {
      const dLon = other.lon - lon;
      const dLat = other.lat - lat;
      let bearing = Math.atan2(dLon, dLat) * (180 / Math.PI);
      if (bearing < 0) bearing += 360;
      return bearing;
    }),
    finalBearingTo: jest.fn().mockImplementation((other: { lat: number; lon: number }) => {
      const dLon = other.lon - lon;
      const dLat = other.lat - lat;
      let bearing = Math.atan2(dLon, dLat) * (180 / Math.PI);
      if (bearing < 0) bearing += 360;
      return bearing;
    }),
    destinationPoint: jest.fn().mockImplementation((distance: number, azimuth: number) => {
      const radAz = (azimuth * Math.PI) / 180;
      const deltaLat = (distance * Math.cos(radAz)) / 111320;
      const deltaLon = (distance * Math.sin(radAz)) / (111320 * Math.cos((lat * Math.PI) / 180));
      return {
        lat: lat + deltaLat,
        lon: lon + deltaLon,
      };
    }),
  }));
});

describe("generate_oriented_volumes", () => {
  describe("DEFAULT_UPLAN_CONFIG", () => {
    it("should have C++ implementation default values", () => {
      expect(DEFAULT_UPLAN_CONFIG).toEqual({
        TSE_H: 15.0,
        TSE_V: 10.0,
        Alpha_H: 7.0,
        Alpha_V: 1.0,
        tbuf: 5.0,
        compressionFactor: 20,
      });
    });
  });

  describe("detectSegmentType", () => {
    it("should classify horizontal segment when h_dist > Alpha_H * v_dist", () => {
      // horizontal: 100m, vertical: 5m
      // 100 > 7 * 5 = 35 → HORIZONTAL
      const result = detectSegmentType(100, 5);
      expect(result).toBe(SegmentType.HORIZONTAL);
    });

    it("should classify vertical segment when v_dist > Alpha_V * h_dist", () => {
      // horizontal: 5m, vertical: 100m
      // 100 > 1 * 5 = 5 → VERTICAL
      const result = detectSegmentType(5, 100);
      expect(result).toBe(SegmentType.VERTICAL);
    });

    it("should classify mixed segment when neither condition met", () => {
      // horizontal: 50m, vertical: 10m
      // 50 > 7 * 10 = 70 → false (not horizontal)
      // 10 > 1 * 50 = 50 → false (not vertical)
      // → MIXED
      const result = detectSegmentType(50, 10);
      expect(result).toBe(SegmentType.MIXED);
    });

    it("should classify as horizontal when horizontal distance is zero", () => {
      // Edge case: both at 0
      const result = detectSegmentType(0, 0);
      // 0 > 7 * 0 is false, 0 > 1 * 0 is false → MIXED
      expect(result).toBe(SegmentType.MIXED);
    });

    it("should use custom config when provided", () => {
      const customConfig = { ...DEFAULT_UPLAN_CONFIG, Alpha_H: 2.0 };
      // horizontal: 50m, vertical: 10m
      // 50 > 2 * 10 = 20 → HORIZONTAL with custom Alpha_H
      const result = detectSegmentType(50, 10, customConfig);
      expect(result).toBe(SegmentType.HORIZONTAL);
    });
  });

  describe("calculateTrackBuffers", () => {
    describe("horizontal segments", () => {
      it("should calculate correct buffers for horizontal segment", () => {
        const result = calculateTrackBuffers(SegmentType.HORIZONTAL, 100, 5);
        expect(result).toEqual({
          alongTrack: 100 / 2 + 15, // 50 + 15 = 65
          crossTrack: 15,
          verticalBuffer: 10,
        });
      });

      it("should use TSE_V for vertical buffer in horizontal segment", () => {
        const result = calculateTrackBuffers(SegmentType.HORIZONTAL, 200, 10);
        expect(result.verticalBuffer).toBe(DEFAULT_UPLAN_CONFIG.TSE_V);
      });
    });

    describe("vertical segments", () => {
      it("should calculate correct buffers for vertical segment", () => {
        const result = calculateTrackBuffers(SegmentType.VERTICAL, 5, 100);
        expect(result).toEqual({
          alongTrack: 15, // Just TSE_H
          crossTrack: 15,
          verticalBuffer: 100 / 2 + 10, // 50 + 10 = 60
        });
      });

      it("should use TSE_H for track buffers in vertical segment", () => {
        const result = calculateTrackBuffers(SegmentType.VERTICAL, 10, 200);
        expect(result.alongTrack).toBe(DEFAULT_UPLAN_CONFIG.TSE_H);
        expect(result.crossTrack).toBe(DEFAULT_UPLAN_CONFIG.TSE_H);
      });
    });

    describe("mixed segments", () => {
      it("should calculate correct buffers for mixed segment", () => {
        const result = calculateTrackBuffers(SegmentType.MIXED, 50, 30);
        expect(result).toEqual({
          alongTrack: 50 / 2 + 15, // 25 + 15 = 40
          crossTrack: 15,
          verticalBuffer: 30 / 2 + 10, // 15 + 10 = 25
        });
      });

      it("should combine both horizontal and vertical components", () => {
        const result = calculateTrackBuffers(SegmentType.MIXED, 100, 100);
        expect(result.alongTrack).toBe(100 / 2 + 15);
        expect(result.verticalBuffer).toBe(100 / 2 + 10);
      });
    });

    it("should use custom config when provided", () => {
      const customConfig = { ...DEFAULT_UPLAN_CONFIG, TSE_H: 20, TSE_V: 15 };
      const result = calculateTrackBuffers(SegmentType.HORIZONTAL, 100, 5, customConfig);
      expect(result).toEqual({
        alongTrack: 100 / 2 + 20, // 50 + 20 = 70
        crossTrack: 20,
        verticalBuffer: 15,
      });
    });
  });

  describe("generateOrientedRectangleCorners", () => {
    it("should generate 5 corners (closed polygon)", () => {
      const corners = generateOrientedRectangleCorners(40.0, -3.0, 0, 100, 50);
      expect(corners).toHaveLength(5);
    });

    it("should close the polygon (first and last corners equal)", () => {
      const corners = generateOrientedRectangleCorners(40.0, -3.0, 0, 100, 50);
      expect(corners[0]).toEqual(corners[4]);
    });

    it("should generate corners in correct order (front-left, front-right, back-right, back-left)", () => {
      // For azimuth 0 (North), front is north of center
      const corners = generateOrientedRectangleCorners(40.0, -3.0, 0, 100, 50);

      // Front corners should have higher latitude than back corners
      const [frontLeft, frontRight, backRight, backLeft] = corners;
      expect(frontLeft[0]).toBeGreaterThan(backLeft[0]);
      expect(frontRight[0]).toBeGreaterThan(backRight[0]);

      // Left corners should have lower longitude than right corners for north-facing
      expect(frontLeft[1]).toBeLessThan(frontRight[1]);
      expect(backLeft[1]).toBeLessThan(backRight[1]);
    });

    it("should orient rectangle along the azimuth direction", () => {
      // For East (90 degrees), front should be east of center
      const corners = generateOrientedRectangleCorners(40.0, -3.0, 90, 100, 50);
      const [frontLeft, frontRight, backRight, backLeft] = corners;

      // Front corners should have higher longitude (more east)
      expect(frontLeft[1]).toBeGreaterThan(backLeft[1]);
      expect(frontRight[1]).toBeGreaterThan(backRight[1]);
    });

    it("should create larger rectangle with larger buffer values", () => {
      const smallCorners = generateOrientedRectangleCorners(40.0, -3.0, 0, 50, 25);
      const largeCorners = generateOrientedRectangleCorners(40.0, -3.0, 0, 100, 50);

      // Calculate rough width/height by lat/lon differences
      const smallHeight = Math.abs(smallCorners[0][0] - smallCorners[3][0]);
      const largeHeight = Math.abs(largeCorners[0][0] - largeCorners[3][0]);

      expect(largeHeight).toBeGreaterThan(smallHeight);
    });
  });

  describe("generateOrientedVolumes", () => {
    const sampleWaypoints: Waypoint[] = [
      { time: 0, lat: 40.0, lon: -3.0, h: 100 },
      { time: 10, lat: 40.001, lon: -3.0, h: 105 },
      { time: 20, lat: 40.001, lon: -2.999, h: 110 },
    ];

    it("should return empty array for single waypoint", () => {
      const result = generateOrientedVolumes([sampleWaypoints[0]], 1000000);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty waypoint array", () => {
      const result = generateOrientedVolumes([], 1000000);
      expect(result).toEqual([]);
    });

    it("should generate one volume per segment", () => {
      const result = generateOrientedVolumes(sampleWaypoints, 1000000);
      expect(result).toHaveLength(sampleWaypoints.length - 1);
    });

    it("should assign sequential ordinals", () => {
      const result = generateOrientedVolumes(sampleWaypoints, 1000000);
      result.forEach((vol, idx) => {
        expect(vol.ordinal).toBe(idx);
      });
    });

    it("should create valid GeoJSON Polygon geometry", () => {
      const result = generateOrientedVolumes(sampleWaypoints, 1000000);
      result.forEach((vol) => {
        expect(vol.geometry.type).toBe("Polygon");
        expect(vol.geometry.coordinates).toHaveLength(1);
        expect(vol.geometry.coordinates[0]).toHaveLength(5); // Closed polygon
        expect(vol.geometry.bbox).toHaveLength(4);
      });
    });

    it("should format time as ISO 8601 without milliseconds", () => {
      const result = generateOrientedVolumes(sampleWaypoints, 1704067200); // 2024-01-01 00:00:00
      result.forEach((vol) => {
        expect(vol.timeBegin).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        expect(vol.timeEnd).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      });
    });

    it("should apply time buffer to start and end times", () => {
      const startTime = 1704067200;
      const result = generateOrientedVolumes(sampleWaypoints, startTime);

      // First volume: wp[0] at t=0, wp[1] at t=10
      // With tbuf=5: begin = startTime + 0 - 5, end = startTime + 10 + 5
      const beginDate = new Date(result[0].timeBegin + "Z");
      const expectedBegin = new Date((startTime + 0 - 5) * 1000);
      expect(beginDate.getTime()).toBe(expectedBegin.getTime());
    });

    it("should set altitude reference to AGL", () => {
      const result = generateOrientedVolumes(sampleWaypoints, 1000000);
      result.forEach((vol) => {
        expect(vol.minAltitude.reference).toBe("AGL");
        expect(vol.maxAltitude.reference).toBe("AGL");
      });
    });

    it("should set altitude unit to meters", () => {
      const result = generateOrientedVolumes(sampleWaypoints, 1000000);
      result.forEach((vol) => {
        expect(vol.minAltitude.uom).toBe("M");
        expect(vol.maxAltitude.uom).toBe("M");
      });
    });

    it("should enforce minimum altitude of 10m", () => {
      const lowAltWaypoints: Waypoint[] = [
        { time: 0, lat: 40.0, lon: -3.0, h: 5 },
        { time: 10, lat: 40.001, lon: -3.0, h: 8 },
      ];
      const result = generateOrientedVolumes(lowAltWaypoints, 1000000);
      result.forEach((vol) => {
        expect(vol.minAltitude.value).toBeGreaterThanOrEqual(10);
      });
    });

    it("should use custom config when provided", () => {
      const customConfig = { ...DEFAULT_UPLAN_CONFIG, tbuf: 10 };
      const startTime = 1704067200;
      const result = generateOrientedVolumes(sampleWaypoints, startTime, customConfig);

      // With tbuf=10: begin = startTime + 0 - 10
      const beginDate = new Date(result[0].timeBegin + "Z");
      const expectedBegin = new Date((startTime + 0 - 10) * 1000);
      expect(beginDate.getTime()).toBe(expectedBegin.getTime());
    });
  });

  describe("generateOrientedBBox", () => {
    const sampleWaypoints: Waypoint[] = [
      { time: 0, lat: 40.0, lon: -3.0, h: 100 },
      { time: 10, lat: 40.001, lon: -3.0, h: 105 },
      { time: 20, lat: 40.001, lon: -2.999, h: 110 },
    ];

    it("should return empty result for single waypoint", () => {
      const result = generateOrientedBBox(1000000, [sampleWaypoints[0]]);
      expect(result.N).toEqual([]);
      expect(result.alt).toEqual({});
      expect(result.bbox).toEqual({});
      expect(result.time).toEqual({});
    });

    it("should set N=1 for each segment (one volume per segment)", () => {
      const result = generateOrientedBBox(1000000, sampleWaypoints);
      result.N.forEach((n) => {
        expect(n).toBe(1);
      });
    });

    it("should use correct key format (segment,0)", () => {
      const result = generateOrientedBBox(1000000, sampleWaypoints);
      expect(result.alt["0,0"]).toBeDefined();
      expect(result.alt["1,0"]).toBeDefined();
      expect(result.bbox["0,0"]).toBeDefined();
      expect(result.bbox["1,0"]).toBeDefined();
      expect(result.time["0,0"]).toBeDefined();
      expect(result.time["1,0"]).toBeDefined();
    });

    it("should include 5 corners in bbox (closed polygon)", () => {
      const result = generateOrientedBBox(1000000, sampleWaypoints);
      Object.values(result.bbox).forEach((corners) => {
        expect(corners).toHaveLength(5);
      });
    });

    it("should normalize longitude to [-180, 180)", () => {
      const result = generateOrientedBBox(1000000, sampleWaypoints);
      Object.values(result.bbox).forEach((corners) => {
        corners.forEach(([_lat, lon]) => {
          expect(lon).toBeGreaterThanOrEqual(-180);
          expect(lon).toBeLessThan(180);
        });
      });
    });

    it("should store altitude as [max, min] tuple", () => {
      const result = generateOrientedBBox(1000000, sampleWaypoints);
      Object.values(result.alt).forEach(([max, min]) => {
        expect(max).toBeGreaterThan(min);
      });
    });

    it("should apply time buffer correctly", () => {
      const initTime = 1704067200;
      const result = generateOrientedBBox(initTime, sampleWaypoints);

      // First segment: t=0 to t=10, with tbuf=5
      const [timeBegin, timeEnd] = result.time["0,0"];
      expect(timeBegin).toBe(initTime + 0 - 5);
      expect(timeEnd).toBe(initTime + 10 + 5);
    });
  });

  describe("compressWaypoints", () => {
    it("should return unchanged array for 2 or fewer waypoints", () => {
      const waypoints: Waypoint[] = [
        { time: 0, lat: 40.0, lon: -3.0, h: 100 },
        { time: 10, lat: 40.001, lon: -3.0, h: 105 },
      ];
      const result = compressWaypoints(waypoints, 20);
      expect(result).toEqual(waypoints);
    });

    it("should skip first waypoint and start from index 1 (C++ logic)", () => {
      // C++ equivalent: wp_reduced = wp(2:compression_factor:end, :) (MATLAB notation)
      // Starts from index 1 (second point) and steps by compression_factor
      const waypoints: Waypoint[] = Array.from({ length: 100 }, (_, i) => ({
        time: i,
        lat: 40.0 + i * 0.0001,
        lon: -3.0,
        h: 100,
      }));

      const result = compressWaypoints(waypoints, 20);
      
      // Should NOT include first waypoint (index 0)
      expect(result[0]).toEqual(waypoints[1]); // First sampled is index 1
      // Should include last waypoint
      expect(result[result.length - 1]).toEqual(waypoints[waypoints.length - 1]);
    });

    it("should sample indices 1, 21, 41, 61, 81 + last (C++ logic)", () => {
      const waypoints: Waypoint[] = Array.from({ length: 100 }, (_, i) => ({
        time: i,
        lat: 40.0 + i * 0.0001,
        lon: -3.0,
        h: 100,
      }));

      const result = compressWaypoints(waypoints, 20);

      // C++ samples: i=1, 21, 41, 61, 81 + last(99) if not already there
      // So indices: [1, 21, 41, 61, 81, 99] = 6 waypoints
      expect(result.length).toBe(6);
      
      // Verify exact indices
      expect(result[0]).toEqual(waypoints[1]);  // index 1
      expect(result[1]).toEqual(waypoints[21]); // index 21
      expect(result[2]).toEqual(waypoints[41]); // index 41
      expect(result[3]).toEqual(waypoints[61]); // index 61
      expect(result[4]).toEqual(waypoints[81]); // index 81
      expect(result[5]).toEqual(waypoints[99]); // last
    });

    it("should use default compression factor from config", () => {
      const waypoints: Waypoint[] = Array.from({ length: 100 }, (_, i) => ({
        time: i,
        lat: 40.0 + i * 0.0001,
        lon: -3.0,
        h: 100,
      }));

      const result = compressWaypoints(waypoints);
      expect(result.length).toBe(6); // Same as with factor 20
    });

    it("should handle empty array", () => {
      const result = compressWaypoints([]);
      expect(result).toEqual([]);
    });

    it("should handle single waypoint", () => {
      const waypoints: Waypoint[] = [
        { time: 0, lat: 40.0, lon: -3.0, h: 100 },
      ];
      const result = compressWaypoints(waypoints);
      expect(result).toEqual(waypoints);
    });

    it("should not duplicate last waypoint if already sampled", () => {
      // Create 42 waypoints (index 41 is the last, and 1+40=41 would be sampled)
      const waypoints: Waypoint[] = Array.from({ length: 42 }, (_, i) => ({
        time: i * 10,  // Unique times
        lat: 40.0 + i * 0.0001,
        lon: -3.0,
        h: 100,
      }));

      const result = compressWaypoints(waypoints, 20);
      
      // Sampled: i=1, 21, 41 (which is also last)
      // Should not duplicate 41
      expect(result.length).toBe(3);
      expect(result[0]).toEqual(waypoints[1]);
      expect(result[1]).toEqual(waypoints[21]);
      expect(result[2]).toEqual(waypoints[41]);
    });
  });
});
