/**
 * Unit tests for QGroundControl plan builder
 * lib/qgc-plan.ts
 */

import { buildQgcPlan, QgcWaypoint } from '../qgc-plan'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WP1: QgcWaypoint = { lat: 39.42, lng: -0.38, alt: 50, speed: 10, pauseDuration: 0, flyOverMode: false }
const WP2: QgcWaypoint = { lat: 39.43, lng: -0.37, alt: 50, speed: 10, pauseDuration: 5, flyOverMode: true }
const WP3: QgcWaypoint = { lat: 39.44, lng: -0.36, alt: 0,  speed: 5,  pauseDuration: 0, flyOverMode: false }

function asPlan(wps: QgcWaypoint[], opts?: { homeAltitude?: number }) {
  return buildQgcPlan(wps, opts) as Record<string, any>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildQgcPlan', () => {
  describe('empty waypoints', () => {
    it('returns an empty object when no waypoints are provided', () => {
      expect(buildQgcPlan([])).toEqual({})
    })
  })

  describe('basic output structure', () => {
    it('has the required top-level keys with correct types', () => {
      const plan = asPlan([WP1, WP2, WP3])

      expect(plan.fileType).toBe('Plan')
      expect(plan.version).toBe(1)
      expect(plan.groundStation).toBe('QGroundControl')
      expect(plan.geoFence).toBeDefined()
      expect(plan.rallyPoints).toBeDefined()
      expect(plan.mission).toBeDefined()
    })

    it('geoFence has circles, polygons and version', () => {
      const { geoFence } = asPlan([WP1, WP3])
      expect(geoFence.circles).toEqual([])
      expect(geoFence.polygons).toEqual([])
      expect(geoFence.version).toBe(2)
    })

    it('rallyPoints has points and version', () => {
      const { rallyPoints } = asPlan([WP1, WP3])
      expect(rallyPoints.points).toEqual([])
      expect(rallyPoints.version).toBe(2)
    })
  })

  describe('mission items count', () => {
    it('generates 2 items for a single waypoint (set-speed + takeoff)', () => {
      const { mission } = asPlan([WP1])
      // set-speed (178) + takeoff (22)
      expect(mission.items).toHaveLength(2)
    })

    it('generates 3 items for 2 waypoints (set-speed + takeoff + land)', () => {
      const { mission } = asPlan([WP1, WP3])
      // set-speed (178) + takeoff (22) + land (21)
      expect(mission.items).toHaveLength(3)
    })

    it('generates 4 items for 3 waypoints (set-speed + takeoff + cruise + land)', () => {
      const { mission } = asPlan([WP1, WP2, WP3])
      // set-speed (178) + takeoff (22) + cruise (16) + land (21)
      expect(mission.items).toHaveLength(4)
    })
  })

  describe('last waypoint — LAND command', () => {
    it('last mission item has command 21 (LAND)', () => {
      const { mission } = asPlan([WP1, WP2, WP3])
      const lastItem = mission.items[mission.items.length - 1] as Record<string, any>
      expect(lastItem.command).toBe(21)
    })

    it('last mission item Altitude is 0', () => {
      const { mission } = asPlan([WP1, WP2, WP3])
      const lastItem = mission.items[mission.items.length - 1] as Record<string, any>
      expect(lastItem.Altitude).toBe(0)
    })

    it('last mission item params[6] (altitude param) is 0', () => {
      const { mission } = asPlan([WP1, WP2, WP3])
      const lastItem = mission.items[mission.items.length - 1] as Record<string, any>
      expect(lastItem.params[6]).toBe(0)
    })

    it('last mission item frame is 3 (MAV_FRAME_GLOBAL_RELATIVE_ALT)', () => {
      const { mission } = asPlan([WP1, WP2, WP3])
      const lastItem = mission.items[mission.items.length - 1] as Record<string, any>
      expect(lastItem.frame).toBe(3)
    })
  })

  describe('plannedHomePosition', () => {
    it('uses lat/lng from the first waypoint', () => {
      const { mission } = asPlan([WP1, WP3])
      expect(mission.plannedHomePosition[0]).toBe(WP1.lat)
      expect(mission.plannedHomePosition[1]).toBe(WP1.lng)
    })

    it('uses default homeAltitude of 15 when env var is not set', () => {
      delete process.env.NEXT_PUBLIC_PLANNED_HOME_ALTITUDE
      const { mission } = asPlan([WP1, WP3])
      expect(mission.plannedHomePosition[2]).toBe(15)
    })

    it('opts.homeAltitude overrides the default', () => {
      const { mission } = asPlan([WP1, WP3], { homeAltitude: 20 })
      expect(mission.plannedHomePosition[2]).toBe(20)
    })

    it('opts.homeAltitude: 0 is respected (not treated as falsy)', () => {
      const { mission } = asPlan([WP1, WP3], { homeAltitude: 0 })
      expect(mission.plannedHomePosition[2]).toBe(0)
    })
  })

  describe('first item — set speed command', () => {
    it('first mission item has command 178', () => {
      const { mission } = asPlan([WP1, WP3])
      expect(mission.items[0].command).toBe(178)
    })

    it('first mission item uses the speed of the first waypoint', () => {
      const { mission } = asPlan([WP1, WP3])
      // params[1] is the speed
      expect(mission.items[0].params[1]).toBe(WP1.speed)
    })
  })

  describe('takeoff item', () => {
    it('second mission item has command 22 (TAKEOFF)', () => {
      const { mission } = asPlan([WP1, WP3])
      expect(mission.items[1].command).toBe(22)
    })

    it('takeoff item frame is 3', () => {
      const { mission } = asPlan([WP1, WP3])
      expect(mission.items[1].frame).toBe(3)
    })

    it('takeoff item includes pauseDuration in params[0]', () => {
      const wp: QgcWaypoint = { lat: 39.42, lng: -0.38, alt: 50, speed: 5, pauseDuration: 3 }
      const { mission } = asPlan([wp, WP3])
      expect(mission.items[1].params[0]).toBe(3)
    })
  })

  describe('cruise item — fly-over mode', () => {
    it('cruise item has acceptRadius 0.1 when flyOverMode is true', () => {
      const { mission } = asPlan([WP1, WP2, WP3])
      const cruiseItem = mission.items[2] as Record<string, any>
      expect(cruiseItem.command).toBe(16)
      expect(cruiseItem.params[1]).toBe(0.1)
    })

    it('cruise item has acceptRadius 0 when flyOverMode is false', () => {
      const mid: QgcWaypoint = { lat: 39.43, lng: -0.37, alt: 50, flyOverMode: false }
      const { mission } = asPlan([WP1, mid, WP3])
      const cruiseItem = mission.items[2] as Record<string, any>
      expect(cruiseItem.params[1]).toBe(0)
    })
  })

  describe('PlanGenerator compatibility — snapshot', () => {
    it('output matches the structure previously produced inline in PlanGenerator', () => {
      const waypoints: QgcWaypoint[] = [
        { lat: 39.42,  lng: -0.38, alt: 100, speed: 5, pauseDuration: 0, flyOverMode: false },
        { lat: 39.43,  lng: -0.37, alt: 100, speed: 5, pauseDuration: 0, flyOverMode: false },
        { lat: 39.44,  lng: -0.36, alt: 0,   speed: 5, pauseDuration: 0, flyOverMode: false },
      ]
      const plan = buildQgcPlan(waypoints, { homeAltitude: 15 })
      expect(plan).toMatchSnapshot()
    })
  })
})
