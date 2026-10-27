/**
 * lib/plan-view-model.ts (F13): CSV / geometry / U-plan / geozone normalisation and, above all, `resolveHeights`: every
 * height of a plan on ONE absolute reference (metres above the ellipsoid). Alex's altitude contract, on a slope:
 *   terrain(takeoff) = 100 m, terrain(centroid of the volumes) = 160 m  ->  trajectory and volumes share the takeoff
 *   base (100 + value), so every trajectory point stays inside its volume; an AGL zone sits on the terrain under ITS
 *   centroid; an AMSL zone adds the geoid height of its U-space (VLCUspace: 50.5492); unknown U-space -> 0 + flag.
 */

import {
  buildPlanViewModel,
  droneAt,
  isConflicting,
  parseResult,
  parseTrajectory,
  resolveHeights,
  ringCentroid,
  ringOf,
  zoneNeedsTerrain,
  type PlanViewInput,
  type PlanViewModel,
  type Ring,
  type VmTrajPoint,
} from '../plan-view-model'

const TAKEOFF_H = 100 // terrain under the takeoff
const CENTROID_H = 160 // terrain under the volumes / a zone centroid (a slope climbing to higher ground)

// ---- fixtures ---------------------------------------------------------------------------

const input = (over: Partial<PlanViewInput> = {}): PlanViewInput => ({
  waypoints: [],
  uplan: null,
  csv: null,
  authorizationMessage: null,
  authStatus: null,
  geoawarenessData: null,
  liveZones: [],
  uspaceId: null,
  ...over,
})

/** Square ring [lon, lat] centred on (lon, lat), half side `h` degrees. */
const square = (lon: number, lat: number, h = 0.0004): Ring => [
  [lon - h, lat - h],
  [lon + h, lat - h],
  [lon + h, lat + h],
  [lon - h, lat + h],
  [lon - h, lat - h],
]

const inRing = (lon: number, lat: number, ring: Ring): boolean => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Near Serra Calderona (Valencia), heading uphill; Alt = metres above takeoff (the contract). */
const CSV = [
  'SimTime,Lat,Lon,Alt,qw,qx,qy,qz,Vx,Vy,Vz',
  '0,39.7000,-0.4500,0,1,0,0,0,0,0,0',
  '1,39.7002,-0.4498,30,1,0,0,0,1,1,0',
  '2,39.7004,-0.4496,35,1,0,0,0,1,1,0',
  '3,39.7006,-0.4494,40,1,0,0,0,1,1,0',
  '4,39.7008,-0.4492,45,1,0,0,0,1,1,0',
  '5,39.7010,-0.4490,0,1,0,0,0,0,0,0',
].join('\n')

/** One U-plan volume per pair of trajectory rows, declared AGL (what UPPS writes), min / max = Alt -+ 10 m buffer. */
const volume = (ordinal: number, lon: number, lat: number, min: number, max: number, extra: object = {}) => ({
  ordinal,
  name: `v${ordinal}`,
  geometry: { type: 'Polygon', coordinates: [square(lon, lat)] },
  minAltitude: { value: min, reference: 'AGL', uom: 'M' },
  maxAltitude: { value: max, reference: 'AGL', uom: 'M' },
  timeBegin: '2030-01-01T10:00:00.000Z',
  timeEnd: '2030-01-01T10:10:00.000Z',
  ...extra,
})

const UPLAN = {
  takeoffLocation: { type: 'Point', coordinates: [-0.45, 39.7] },
  operationVolumes: [volume(0, -0.4498, 39.7002, 0, 45), volume(1, -0.4494, 39.7006, 25, 55), volume(2, -0.449, 39.701, 0, 20)],
}

const slopeModel = (over: Partial<PlanViewInput> = {}): PlanViewModel =>
  buildPlanViewModel(input({ waypoints: [{ lat: 39.7, lng: -0.45, alt: 30 }, { lat: 39.701, lng: -0.449, alt: 0 }], uplan: UPLAN, csv: CSV, uspaceId: 'VLCUspace', ...over }))

// ---- parseTrajectory / droneAt ------------------------------------------------------------

describe('parseTrajectory', () => {
  it('reads SimTime,Lat,Lon,Alt: Alt is metres above takeoff (HAT), time is seconds since the first row', () => {
    const pts = parseTrajectory(CSV)
    expect(pts).toHaveLength(6)
    expect(pts[1]).toEqual({ lat: 39.7002, lon: -0.4498, alt: { meters: 30, ref: 'HAT' }, t: 1 })
    expect(pts.every((p) => p.alt.ref === 'HAT')).toBe(true)
    expect(pts[5].t).toBe(5)
  })

  it('time is relative to the first row even when the clock does not start at 0', () => {
    const pts = parseTrajectory('SimTime,Lat,Lon,Alt\n100,39.7,-0.45,10\n102.5,39.7,-0.45,12')
    expect(pts.map((p) => p.t)).toEqual([0, 2.5])
  })

  it('accepts CRLF, a BOM, any header case and extra columns', () => {
    const pts = parseTrajectory('﻿SIMTIME,LAT,LON,ALT,Vx\r\n0,39.7,-0.45,5,1\r\n1,39.71,-0.44,6,1\r\n')
    expect(pts).toHaveLength(2)
    expect(pts[1]).toMatchObject({ lat: 39.71, lon: -0.44, alt: { meters: 6 } })
  })

  it('drops rows with bad or out-of-range coordinates, keeps the rest', () => {
    const pts = parseTrajectory('SimTime,Lat,Lon,Alt\n0,39.7,-0.45,5\n1,abc,-0.45,5\n2,95,-0.45,5\n3,39.7,181,5\n4,39.7\n5,39.8,-0.4,7')
    expect(pts.map((p) => p.t)).toEqual([0, 5])
  })

  it('a bad Alt becomes 0 m above takeoff (never NaN: the 3D line would vanish)', () => {
    const pts = parseTrajectory('SimTime,Lat,Lon,Alt\n0,39.7,-0.45,\n1,39.7,-0.45,xx')
    expect(pts.map((p) => p.alt.meters)).toEqual([0, 0])
  })

  it('no Alt column -> 0, no Time column -> the row index, no Lat/Lon column -> nothing', () => {
    expect(parseTrajectory('Lat,Lon\n39.7,-0.45\n39.8,-0.44').map((p) => [p.alt.meters, p.t])).toEqual([
      [0, 0],
      [0, 1],
    ])
    expect(parseTrajectory('SimTime,Alt\n0,5')).toEqual([])
  })

  it('empty / whitespace / null -> []', () => {
    expect(parseTrajectory(null)).toEqual([])
    expect(parseTrajectory('')).toEqual([])
    expect(parseTrajectory('  \n ')).toEqual([])
    expect(parseTrajectory('SimTime,Lat,Lon,Alt')).toEqual([])
  })
})

describe('droneAt', () => {
  const pts: VmTrajPoint[] = parseTrajectory('SimTime,Lat,Lon,Alt\n0,39.0,-0.5,0\n10,39.2,-0.3,100\n20,39.2,-0.3,100')

  it('interpolates position and altitude linearly between rows, keeping the HAT reference', () => {
    const p = droneAt(pts, 5)
    expect(p?.lat).toBeCloseTo(39.1, 10)
    expect(p?.lon).toBeCloseTo(-0.4, 10)
    expect(p?.alt.meters).toBeCloseTo(50, 10)
    expect(p?.alt.ref).toBe('HAT')
  })

  it('clamps before the start and after the end', () => {
    expect(droneAt(pts, -5)).toEqual(pts[0])
    expect(droneAt(pts, 0)).toEqual(pts[0])
    expect(droneAt(pts, 20)).toEqual(pts[2])
    expect(droneAt(pts, 999)).toEqual(pts[2])
  })

  it('empty trajectory -> null; two rows at the same time do not divide by zero', () => {
    expect(droneAt([], 3)).toBeNull()
    const dup = parseTrajectory('SimTime,Lat,Lon,Alt\n0,39.0,-0.5,0\n5,39.1,-0.4,10\n5,39.2,-0.3,20\n9,39.3,-0.2,30')
    const p = droneAt(dup, 5)
    expect(Number.isFinite(p?.lat)).toBe(true)
    expect(Number.isFinite(p?.alt.meters)).toBe(true)
  })
})

// ---- geometry -----------------------------------------------------------------------------

describe('ringCentroid', () => {
  it('centre of a square, open or closed', () => {
    const open: Ring = [[0, 0], [2, 0], [2, 2], [0, 2]]
    expect(ringCentroid(open)).toEqual({ lon: 1, lat: 1 })
    expect(ringCentroid([...open, [0, 0]])).toEqual({ lon: 1, lat: 1 })
  })

  it('is the AREA centroid, not the mean of the vertices (an L shape)', () => {
    // L: a 3x1 bar plus a 1x2 stem
    const L: Ring = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]]
    const c = ringCentroid(L)
    // areas: bar 3x1 (centre 1.5,0.5) + stem 1x2 (centre 0.5, 2) -> (3*1.5+2*0.5)/5 , (3*0.5+2*2)/5
    expect(c.lon).toBeCloseTo((3 * 1.5 + 2 * 0.5) / 5, 12)
    expect(c.lat).toBeCloseTo((3 * 0.5 + 2 * 2) / 5, 12)
    const meanLon = L.reduce((s, p) => s + p[0], 0) / L.length
    expect(Math.abs(c.lon - meanLon)).toBeGreaterThan(0.1)
  })

  it('winding order does not matter', () => {
    const cw: Ring = [[0, 0], [0, 4], [6, 4], [6, 0]]
    const ccw = [...cw].reverse() as Ring
    expect(ringCentroid(cw)).toEqual(ringCentroid(ccw))
    expect(ringCentroid(cw)).toEqual({ lon: 3, lat: 2 })
  })

  it('a degenerate ring (all points on a line) falls back to the vertex mean', () => {
    expect(ringCentroid([[0, 0], [2, 2], [4, 4]])).toEqual({ lon: 2, lat: 2 })
  })

  it('a real-size ring (Valencia, 1e-4 degrees) keeps its precision', () => {
    const c = ringCentroid(square(-0.4498, 39.7002, 0.0004))
    // planar formula on raw degrees: ~1e-8 deg (1 mm) of rounding, irrelevant for a terrain sample
    expect(c.lon).toBeCloseTo(-0.4498, 7)
    expect(c.lat).toBeCloseTo(39.7002, 7)
  })
})

describe('ringOf', () => {
  const ring: Ring = [[-0.45, 39.7], [-0.44, 39.7], [-0.44, 39.71], [-0.45, 39.71]]

  it('Polygon and MultiPolygon, [lon, lat] as is', () => {
    expect(ringOf({ type: 'Polygon', coordinates: [ring] })).toEqual(ring)
    expect(ringOf({ type: 'MultiPolygon', coordinates: [[ring]] })).toEqual(ring)
  })

  it('coordinates sent as a JSON string, or a bare ring', () => {
    expect(ringOf({ type: 'Polygon', coordinates: JSON.stringify([ring]) })).toEqual(ring)
    expect(ringOf({ type: 'Polygon', coordinates: ring })).toEqual(ring)
  })

  it('[lat, lon] written the wrong way round (service quirk) is put right', () => {
    const swapped = ring.map(([lon, lat]) => [lat, lon])
    expect(ringOf({ type: 'Polygon', coordinates: [swapped] })).toEqual(ring)
  })

  it('fewer than 3 points, garbage and non-objects -> null', () => {
    expect(ringOf({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] })).toBeNull()
    expect(ringOf({ type: 'Polygon', coordinates: 'not json' })).toBeNull()
    expect(ringOf({ type: 'Polygon' })).toBeNull()
    expect(ringOf(null)).toBeNull()
    expect(ringOf('x')).toBeNull()
  })
})

// ---- the model ----------------------------------------------------------------------------

describe('buildPlanViewModel', () => {
  it('waypoints: first = takeoff, last = landing, the rest cruise; all HAT (metres above takeoff)', () => {
    const m = buildPlanViewModel(input({ waypoints: [{ lat: 39.7, lng: -0.45, alt: 30 }, { lat: 39.701, lng: -0.449, alt: 30 }, { lat: 39.702, lng: -0.448, alt: 0 }] }))
    expect(m.waypoints.map((w) => w.type)).toEqual(['takeoff', 'cruise', 'landing'])
    expect(m.waypoints.every((w) => w.alt.ref === 'HAT')).toBe(true)
    expect(m.waypoints[0]).toMatchObject({ lon: -0.45, lat: 39.7 })
  })

  it('volumes keep the U-plan reference as "declared AGL" but are drawn HAT; limits are read separately; feet converted', () => {
    const m = buildPlanViewModel(
      input({
        uplan: {
          operationVolumes: [
            { ordinal: 3, geometry: { type: 'Polygon', coordinates: [square(-0.45, 39.7)] }, minAltitude: { value: 10, reference: 'AGL', uom: 'M' }, maxAltitude: { value: 400, reference: 'AGL', uom: 'FT' } },
          ],
        },
      })
    )
    const v = m.volumes[0]
    expect(v.ordinal).toBe(3)
    expect(v.min).toEqual({ meters: 10, ref: 'HAT', declared: 'AGL' })
    expect(v.max?.meters).toBeCloseTo(121.92, 10)
    expect(v.max?.ref).toBe('HAT')
    expect(v.max?.declared).toBe('AGL')
  })

  it('a U-plan given as a JSON string works; volumes with < 3 vertices are dropped', () => {
    const m = buildPlanViewModel(input({ uplan: JSON.stringify({ operationVolumes: [volume(0, -0.45, 39.7, 0, 10), { ordinal: 1, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } }] }) }))
    expect(m.volumes.map((v) => v.ordinal)).toEqual([0])
  })

  describe('takeoff point (the base of every HAT height)', () => {
    it('the U-plan takeoffLocation when it is on the route', () => {
      const m = buildPlanViewModel(input({ waypoints: [{ lat: 39.7001, lng: -0.4501, alt: 10 }], uplan: { takeoffLocation: { type: 'Point', coordinates: [-0.45, 39.7] } } }))
      expect(m.takeoff).toEqual({ lon: -0.45, lat: 39.7 })
    })

    it('more than 5 km from the route (placeholder data) -> the first route point', () => {
      const far = { takeoffLocation: { type: 'Point', coordinates: [-0.45, 39.7 + 5.5 / 111.32] } } // 5.5 km north
      const m = buildPlanViewModel(input({ waypoints: [{ lat: 39.7, lng: -0.45, alt: 10 }, { lat: 39.701, lng: -0.449, alt: 0 }], uplan: far }))
      expect(m.takeoff).toEqual({ lon: -0.45, lat: 39.7 })
    })

    it('just under 5 km still counts (the limit is a placeholder detector, not a precision test)', () => {
      const near = { takeoffLocation: { type: 'Point', coordinates: [-0.45, 39.7 + 4.5 / 111.32] } }
      const m = buildPlanViewModel(input({ waypoints: [{ lat: 39.7, lng: -0.45, alt: 10 }], uplan: near }))
      expect(m.takeoff?.lat).toBeCloseTo(39.7 + 4.5 / 111.32, 9)
    })

    it('no U-plan: first waypoint; no waypoints: first trajectory point; nothing at all: null', () => {
      expect(buildPlanViewModel(input({ waypoints: [{ lat: 39.7, lng: -0.45, alt: 10 }] })).takeoff).toEqual({ lon: -0.45, lat: 39.7 })
      expect(buildPlanViewModel(input({ csv: CSV })).takeoff).toEqual({ lon: -0.45, lat: 39.7 })
      expect(buildPlanViewModel(input()).takeoff).toBeNull()
    })

    it('an imported U-plan (volumes only): the takeoffLocation, else the first vertex of the first volume', () => {
      const t = buildPlanViewModel(input({ uplan: { operationVolumes: [volume(0, -0.45, 39.7, 0, 10)] } })).takeoff
      expect(t?.lon).toBeCloseTo(-0.4504, 9)
      expect(t?.lat).toBeCloseTo(39.6996, 9)
      expect(buildPlanViewModel(input({ uplan: { ...UPLAN } })).takeoff).toEqual({ lon: -0.45, lat: 39.7 })
    })
  })

  it('timeline: the span of the volumes, else the trajectory duration, else null', () => {
    expect(slopeModel().timeline).toEqual({ startMs: Date.parse('2030-01-01T10:00:00.000Z'), endMs: Date.parse('2030-01-01T10:10:00.000Z') })
    expect(buildPlanViewModel(input({ csv: CSV })).timeline).toEqual({ startMs: 0, endMs: 5000 })
    expect(buildPlanViewModel(input()).timeline).toBeNull()
  })

  describe('geozones', () => {
    const zone = (id: string, over: object = {}, vertical: object | null = { lower: 0, upper: 120, lowerReference: 'AGL', upperReference: 'AGL', uom: 'M' }) => ({
      type: 'Feature',
      uas_geozones_identifier: id,
      properties: { name: `zone ${id}`, type: 'PROHIBITED' },
      geometry: { type: 'Polygon', coordinates: [square(-0.45, 39.7, 0.01)], ...(vertical ? { verticalReference: vertical } : {}) },
      ...over,
    })

    it('lowerReference and upperReference are read separately (AGL floor, AMSL ceiling)', () => {
      const m = buildPlanViewModel(input({ liveZones: [zone('Z1', {}, { lower: 0, upper: 300, lowerReference: 'AGL', upperReference: 'AMSL', uom: 'M' })] }))
      expect(m.zones[0].lower).toEqual({ meters: 0, ref: 'AGL' })
      expect(m.zones[0].upper).toEqual({ meters: 300, ref: 'AMSL' })
    })

    it('feet apply to both limits', () => {
      const m = buildPlanViewModel(input({ liveZones: [zone('Z1', {}, { lower: 100, upper: 400, lowerReference: 'AMSL', upperReference: 'AMSL', uom: 'FT' })] }))
      expect(m.zones[0].lower.meters).toBeCloseTo(30.48, 10)
      expect(m.zones[0].upper.meters).toBeCloseTo(121.92, 10)
    })

    it('a zone without vertical limits is 0 .. 150 m AGL', () => {
      const m = buildPlanViewModel(input({ liveZones: [zone('Z1', {}, null)] }))
      expect(m.zones[0].lower).toEqual({ meters: 0, ref: 'AGL' })
      expect(m.zones[0].upper).toEqual({ meters: 150, ref: 'AGL' })
    })

    it('the limits can sit on the feature (stored shape) as well as on the geometry (service shape)', () => {
      const stored = zone('Z1', { verticalReference: { lower: 5, upper: 50, lowerReference: 'AGL', upperReference: 'AGL', uom: 'M' } }, null)
      const m = buildPlanViewModel(input({ geoawarenessData: { features: [stored] } }))
      expect(m.zones[0].upper.meters).toBe(50)
    })

    it('live and stored zones are merged by id (live wins); FAS conflicting ids are flagged', () => {
      const msg = JSON.stringify({ geozones_information: { conflicting_geozones: [{ identifier: 'Z2', type: 'prohibited', info: 'no drones' }] } })
      const m = buildPlanViewModel(
        input({ liveZones: [zone('Z1'), zone('Z2')], geoawarenessData: { features: [zone('Z1', {}, { lower: 1, upper: 2 })] }, authorizationMessage: msg, authStatus: 'denied' })
      )
      expect(m.zones.map((z) => [z.id, z.conflicting])).toEqual([['Z1', false], ['Z2', true]])
      expect(m.zones[0].upper.meters).toBe(120)
      expect(m.zones[1].info).toBe('no drones')
    })

    it('zoneNeedsTerrain: true as soon as one limit is AGL', () => {
      const a = { lower: { meters: 0, ref: 'AGL' as const }, upper: { meters: 9, ref: 'AMSL' as const } }
      const b = { lower: { meters: 0, ref: 'AMSL' as const }, upper: { meters: 9, ref: 'AMSL' as const } }
      const c = { lower: { meters: 0, ref: 'WGS84' as const }, upper: { meters: 9, ref: 'AGL' as const } }
      expect([zoneNeedsTerrain(a), zoneNeedsTerrain(b), zoneNeedsTerrain(c)]).toEqual([true, false, true])
    })
  })
})

describe('parseResult / isConflicting', () => {
  it('a denial naming volumes: only those are conflicting', () => {
    const r = parseResult(JSON.stringify({ volumes: [{ ordinal: 1, status: 'CONFLICTING' }, { ordinal: 2, status: 'OK' }] }), 'denied')
    expect(r.conflictingOrdinals).toEqual([1])
    expect(isConflicting(r, { ordinal: 1 })).toBe(true)
    expect(isConflicting(r, { ordinal: 2 })).toBe(false)
  })

  it('a denial that names none: every volume is conflicting; an approval: none', () => {
    const denied = parseResult('Rejected by FAS', 'denied')
    expect(isConflicting(denied, { ordinal: 0 })).toBe(true)
    expect(isConflicting(parseResult('ok', 'approved'), { ordinal: 0 })).toBe(false)
    expect(isConflicting(null, { ordinal: 0 })).toBe(false)
  })

  it('WITHDRAWN reads the ordinals from the reason', () => {
    const r = parseResult(JSON.stringify({ status: 'WITHDRAWN', message: { reason: 'conflict with volumes [1, 3]' } }), 'withdrawn')
    expect(r.conflictingOrdinals).toEqual([1, 3])
    expect(r.withdrawnReason).toContain('[1, 3]')
  })
})

// ---- resolveHeights: the altitude contract on a slope ---------------------------------------

describe('resolveHeights (terrain(takeoff) = 100 m, terrain(volume centroid) = 160 m)', () => {
  const sample = { takeoffH: TAKEOFF_H, zoneH: {} as Record<string, number> }

  it('waypoints and trajectory: terrain(takeoff) + metres above takeoff (the line does not follow the terrain)', () => {
    const abs = resolveHeights(slopeModel(), sample)
    expect(abs.waypoints.map((w) => w.h)).toEqual([130, 100])
    expect(abs.trajectory.map((p) => p.h)).toEqual([100, 130, 135, 140, 145, 100])
  })

  it('volumes sit on the SAME takeoff base: 100 + value, never 160 + value', () => {
    const abs = resolveHeights(slopeModel(), sample)
    expect(abs.volumes.map((v) => [v.lowerH, v.upperH])).toEqual([[100, 145], [125, 155], [100, 120]])
    // negative control: with the terrain under the centroid (160) the numbers would differ by the slope
    expect(abs.volumes[0].lowerH).not.toBe(CENTROID_H + 0)
  })

  it('every trajectory point stays inside its volume (lateral footprint AND height) on the slope', () => {
    const model = slopeModel()
    const abs = resolveHeights(model, sample)
    const climb = abs.trajectory.slice(1, 5) // rows 1..4 are the cruise rows, inside volumes 0/1
    expect(climb.length).toBe(4)
    for (const p of climb) {
      const holders = abs.volumes.filter((v) => inRing(p.lon, p.lat, v.ring) && p.h >= v.lowerH && p.h <= v.upperH)
      expect({ t: p.t, holders: holders.length > 0 }).toEqual({ t: p.t, holders: true })
    }
    // the same points against volumes drawn on the terrain under their centroid (the old RELATIVE_TO_GROUND-like rule) fall OUT
    const wrong = abs.volumes.map((v) => ({ ...v, lowerH: CENTROID_H + (v.lowerH - TAKEOFF_H), upperH: CENTROID_H + (v.upperH - TAKEOFF_H) }))
    const outside = climb.filter((p) => !wrong.some((v) => inRing(p.lon, p.lat, v.ring) && p.h >= v.lowerH && p.h <= v.upperH))
    expect(outside.length).toBeGreaterThan(0)
  })

  it('the takeoff base is the only terrain a trajectory / volume needs: zoneH is ignored by them', () => {
    const a = resolveHeights(slopeModel(), { takeoffH: TAKEOFF_H, zoneH: {} })
    const b = resolveHeights(slopeModel(), { takeoffH: TAKEOFF_H, zoneH: { whatever: 999 } })
    expect(b.trajectory.map((p) => p.h)).toEqual(a.trajectory.map((p) => p.h))
    expect(b.volumes.map((v) => v.upperH)).toEqual(a.volumes.map((v) => v.upperH))
  })

  it('volumes declared in feet use the converted value on the takeoff base', () => {
    const m = buildPlanViewModel(
      input({ uplan: { operationVolumes: [{ ordinal: 0, geometry: { type: 'Polygon', coordinates: [square(-0.45, 39.7)] }, minAltitude: { value: 0, reference: 'AGL', uom: 'FT' }, maxAltitude: { value: 400, reference: 'AGL', uom: 'FT' } }] } })
    )
    const v = resolveHeights(m, sample).volumes[0]
    expect(v.lowerH).toBe(100)
    expect(v.upperH).toBeCloseTo(100 + 121.92, 9)
  })

  it('a volume with only one limit is left out (no invented default height)', () => {
    const m = buildPlanViewModel(input({ uplan: { operationVolumes: [{ ordinal: 0, geometry: { type: 'Polygon', coordinates: [square(-0.45, 39.7)] }, minAltitude: { value: 0, reference: 'AGL' } }] } }))
    expect(resolveHeights(m, sample).volumes).toEqual([])
  })

  describe('geozones', () => {
    const zoneModel = (vertical: object, uspaceId: string | null) =>
      buildPlanViewModel(
        input({
          uspaceId,
          liveZones: [{ uas_geozones_identifier: 'Z1', properties: { name: 'z', type: 'CONDITIONAL' }, geometry: { type: 'Polygon', coordinates: [square(-0.4, 39.72, 0.01)], verticalReference: vertical } }],
        })
      )
    const AGL = { lower: 0, upper: 120, lowerReference: 'AGL', upperReference: 'AGL', uom: 'M' }
    const AMSL = { lower: 100, upper: 300, lowerReference: 'AMSL', upperReference: 'AMSL', uom: 'M' }

    it('AGL: the terrain under ITS centroid (160 here), not the takeoff terrain (100)', () => {
      const abs = resolveHeights(zoneModel(AGL, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: { Z1: CENTROID_H } })
      expect([abs.zones[0].lowerH, abs.zones[0].upperH]).toEqual([160, 280])
    })

    it('AGL in feet: 400 FT = 121.92 m on the centroid terrain', () => {
      const abs = resolveHeights(zoneModel({ ...AGL, upper: 400, uom: 'FT' }, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: { Z1: CENTROID_H } })
      expect(abs.zones[0].upperH).toBeCloseTo(160 + 121.92, 9)
    })

    it('AGL without a centroid height: the zone is left out (a warning in the viewer), never drawn underground', () => {
      const abs = resolveHeights(zoneModel(AGL, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: {} })
      expect(abs.zones).toEqual([])
      expect(resolveHeights(zoneModel(AGL, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: { Z1: NaN } }).zones).toEqual([])
    })

    it('AMSL in VLCUspace = value + 50.5492 (EGM2008), no terrain needed', () => {
      const abs = resolveHeights(zoneModel(AMSL, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: {} })
      expect(abs.zones[0].lowerH).toBeCloseTo(150.5492, 10)
      expect(abs.zones[0].upperH).toBeCloseTo(350.5492, 10)
      expect(abs.geoidKnown).toBe(true)
    })

    it('AMSL per U-space: CVUspace and MUSUspace use their own constants', () => {
      expect(resolveHeights(zoneModel(AMSL, 'CVUspace'), { takeoffH: TAKEOFF_H, zoneH: {} }).zones[0].lowerH).toBeCloseTo(150.7302, 10)
      expect(resolveHeights(zoneModel(AMSL, 'MUSUspace'), { takeoffH: TAKEOFF_H, zoneH: {} }).zones[0].lowerH).toBeCloseTo(150.8231, 10)
    })

    it('AMSL in an unknown U-space = value + 0 and geoidKnown = false (the legend warns); same for no U-space', () => {
      for (const id of ['GLOBAL_U_SPACE', 'NewUspace', null]) {
        const abs = resolveHeights(zoneModel(AMSL, id), { takeoffH: TAKEOFF_H, zoneH: {} })
        expect({ id, lowerH: abs.zones[0].lowerH, known: abs.geoidKnown }).toEqual({ id, lowerH: 100, known: false })
      }
    })

    it('WGS84 is the value itself, whatever the terrain and the U-space', () => {
      const abs = resolveHeights(zoneModel({ lower: 150, upper: 250, lowerReference: 'WGS84', upperReference: 'WGS84', uom: 'M' }, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: { Z1: CENTROID_H } })
      expect([abs.zones[0].lowerH, abs.zones[0].upperH]).toEqual([150, 250])
    })

    it('AGL floor with an AMSL ceiling: each limit on its own reference', () => {
      const abs = resolveHeights(zoneModel({ lower: 0, upper: 300, lowerReference: 'AGL', upperReference: 'AMSL', uom: 'M' }, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: { Z1: CENTROID_H } })
      expect(abs.zones[0].lowerH).toBe(160)
      expect(abs.zones[0].upperH).toBeCloseTo(350.5492, 10)
    })

    it('an AMSL-only zone never waits for terrain (kept without a sampled centroid)', () => {
      expect(resolveHeights(zoneModel(AMSL, 'VLCUspace'), { takeoffH: TAKEOFF_H, zoneH: {} }).zones).toHaveLength(1)
    })
  })

  it('the SCRS alternative route is measured from the takeoff too', () => {
    const scrs = JSON.stringify({
      scr_dispatch: {
        sent: true,
        status_code: 200,
        response: {
          status: 'success',
          uplan_id: 'u-1',
          segments: [{ segment: 1, start: { type: 'Point', coordinates: [-0.45, 39.7, 50] }, end: { type: 'Point', coordinates: [-0.44, 39.71, 60] }, solution_method: 'ML', route_path: [{ type: 'Point', coordinates: [-0.449, 39.701, 55] }, { type: 'Point', coordinates: [-0.445, 39.705, 60] }] }],
        },
      },
    })
    const m = buildPlanViewModel(input({ uplan: UPLAN, authorizationMessage: scrs, authStatus: 'denied' }))
    const abs = resolveHeights(m, sample)
    expect(abs.scrs?.alternative.map((p) => p.h)).toEqual([155, 160])
  })
})
