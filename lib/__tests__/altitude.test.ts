/**
 * lib/altitude.ts: the altitude rules of the plan viewer (F13), one per data source. Alex's contract (2026-10-27):
 *   - .plan waypoints and trajectory CSV `Alt`: metres above the takeoff point (HAT) -> terrainH(takeoff) + value;
 *   - U-plan volumes are declared AGL but generated from that Alt, so they are drawn on the SAME takeoff base (volumeAlt);
 *   - geozones AGL -> terrainH(zone centroid) + value, AMSL -> value + geoid N of the U-space, WGS84 -> value;
 *   - FT x 0.3048; lower / upper read separately; nothing is ever sampled from the ellipsoid.
 * Pure: no Cesium, no React.
 */

import { getTranslation } from '@/app/i18n/translations'
import { FT_TO_M, GEOID_N_BY_USPACE, geoidNFor, labelAlt, labelAltRange, parseAlt, toEllipsoid, volumeAlt, type Alt, type AltCtx } from '../altitude'

const CTX: AltCtx = { terrainH: 160, takeoffH: 100, geoidN: 50.5492 }
const fmt = getTranslation('en').planAuth.viewer.alt

describe('parseAlt', () => {
  it('reads { value, reference, uom } and keeps metres', () => {
    expect(parseAlt({ value: 120, reference: 'AGL', uom: 'M' }, 'HAT')).toEqual({ meters: 120, ref: 'AGL' })
    expect(parseAlt({ value: 300, reference: 'AMSL', uom: 'M' }, 'AGL')).toEqual({ meters: 300, ref: 'AMSL' })
    expect(parseAlt({ value: 10, reference: 'WGS84', uom: 'M' }, 'AGL')).toEqual({ meters: 10, ref: 'WGS84' })
  })

  it('converts feet to metres (any case of the unit), and only feet', () => {
    expect(parseAlt({ value: 400, reference: 'AGL', uom: 'FT' }, 'AGL')?.meters).toBeCloseTo(121.92, 10)
    expect(parseAlt({ value: 400, reference: 'AGL', uom: 'ft' }, 'AGL')?.meters).toBeCloseTo(400 * FT_TO_M, 10)
    expect(parseAlt({ value: 400, reference: 'AGL', uom: 'M' }, 'AGL')?.meters).toBe(400)
    expect(parseAlt({ value: 400, reference: 'AGL' }, 'AGL')?.meters).toBe(400) // no unit = metres
  })

  it('a bare number is metres in the fallback reference', () => {
    expect(parseAlt(42, 'HAT')).toEqual({ meters: 42, ref: 'HAT' })
    expect(parseAlt(42, 'AGL')).toEqual({ meters: 42, ref: 'AGL' })
    expect(parseAlt('12.5', 'HAT')).toEqual({ meters: 12.5, ref: 'HAT' })
    expect(parseAlt(0, 'HAT')).toEqual({ meters: 0, ref: 'HAT' })
    expect(parseAlt(-3, 'AMSL')).toEqual({ meters: -3, ref: 'AMSL' })
  })

  it.each([
    ['AGL', 'AGL'],
    ['agl', 'AGL'],
    ['ABOVE_GROUND', 'AGL'],
    ['GROUND', 'AGL'],
    ['AMSL', 'AMSL'],
    ['amsl', 'AMSL'],
    ['MSL', 'AMSL'],
    ['WGS84', 'WGS84'],
    ['WGS-84', 'WGS84'],
    ['ELLIPSOID', 'WGS84'],
    ['HAE', 'WGS84'],
    ['HAT', 'HAT'],
    ['TAKEOFF', 'HAT'],
    ['HOME', 'HAT'],
  ])('reference %s -> %s', (reference, ref) => {
    expect(parseAlt({ value: 1, reference }, 'AGL')?.ref).toBe(ref)
  })

  it('an unknown or missing reference takes the fallback', () => {
    expect(parseAlt({ value: 1, reference: 'FL' }, 'HAT')?.ref).toBe('HAT')
    expect(parseAlt({ value: 1 }, 'AMSL')?.ref).toBe('AMSL')
    expect(parseAlt({ value: 1, reference: 5 }, 'AGL')?.ref).toBe('AGL')
  })

  it.each([[null], [undefined], [''], ['abc'], [NaN], [Infinity], [{}], [{ value: 'x' }], [{ value: '' }], [[]]])('%p is not an altitude', (raw) => {
    expect(parseAlt(raw, 'AGL')).toBeNull()
  })
})

describe('volumeAlt (U-plan volumes: declared AGL, drawn on the takeoff base)', () => {
  it('AGL limits become HAT (same base as the trajectory) and remember what the U-plan declared', () => {
    expect(volumeAlt({ value: 20, reference: 'AGL', uom: 'M' })).toEqual({ meters: 20, ref: 'HAT', declared: 'AGL' })
    expect(volumeAlt(35)).toEqual({ meters: 35, ref: 'HAT', declared: 'AGL' }) // no reference = the U-plan default, AGL
  })

  it('feet are converted before', () => {
    const a = volumeAlt({ value: 400, reference: 'AGL', uom: 'FT' })
    expect(a?.meters).toBeCloseTo(121.92, 10)
    expect(a?.ref).toBe('HAT')
  })

  it('a volume that declares another reference keeps it (WGS84 is absolute, AMSL gets the geoid)', () => {
    expect(volumeAlt({ value: 150, reference: 'WGS84' })).toEqual({ meters: 150, ref: 'WGS84' })
    expect(volumeAlt({ value: 150, reference: 'AMSL' })).toEqual({ meters: 150, ref: 'AMSL' })
  })

  it('no altitude -> null', () => {
    expect(volumeAlt(undefined)).toBeNull()
    expect(volumeAlt({ reference: 'AGL' })).toBeNull()
  })

  it('end to end on a slope: the volume of a trajectory point is above takeoff terrain + value, NOT above the terrain under the volume', () => {
    const lower = volumeAlt({ value: 20, reference: 'AGL', uom: 'M' }) as Alt
    const upper = volumeAlt({ value: 50, reference: 'AGL', uom: 'M' }) as Alt
    // terrain 100 m at the takeoff, 160 m under the volume: the volume must not move with the terrain under it
    expect([toEllipsoid(lower, CTX), toEllipsoid(upper, CTX)]).toEqual([120, 150])
    expect(toEllipsoid(lower, CTX)).not.toBe(CTX.terrainH + 20)
  })
})

describe('toEllipsoid', () => {
  it('HAT = terrain under the takeoff + value (one base for the whole route, not the terrain under the point)', () => {
    expect(toEllipsoid({ meters: 40, ref: 'HAT' }, CTX)).toBe(140)
    expect(toEllipsoid({ meters: 0, ref: 'HAT' }, CTX)).toBe(100)
  })

  it('AGL = terrain under the reference point (the zone centroid) + value', () => {
    expect(toEllipsoid({ meters: 120, ref: 'AGL' }, CTX)).toBe(280)
    expect(toEllipsoid({ meters: 0, ref: 'AGL' }, CTX)).toBe(160)
  })

  it('AMSL = value + geoid height of the U-space (no terrain involved)', () => {
    expect(toEllipsoid({ meters: 100, ref: 'AMSL' }, CTX)).toBeCloseTo(150.5492, 10)
    expect(toEllipsoid({ meters: 100, ref: 'AMSL' }, { ...CTX, terrainH: NaN, takeoffH: NaN })).toBeCloseTo(150.5492, 10)
  })

  it('WGS84 = the value itself (neither terrain nor geoid)', () => {
    expect(toEllipsoid({ meters: 100, ref: 'WGS84' }, CTX)).toBe(100)
    expect(toEllipsoid({ meters: 100, ref: 'WGS84' }, { terrainH: NaN, takeoffH: NaN, geoidN: 0 })).toBe(100)
  })

  it('the `declared` label reference never changes the height', () => {
    expect(toEllipsoid({ meters: 40, ref: 'HAT', declared: 'AGL' }, CTX)).toBe(140)
  })

  it('every reference differs on the same number (guards a swapped branch)', () => {
    const out = (['AGL', 'HAT', 'AMSL', 'WGS84'] as const).map((ref) => toEllipsoid({ meters: 10, ref }, CTX))
    expect(new Set(out).size).toBe(4)
  })
})

describe('geoidNFor', () => {
  it('has the EGM2008 height of the four U-spaces (Valencia: about 50 m)', () => {
    expect(geoidNFor('VLCUspace')).toBe(50.5492)
    expect(geoidNFor('PuertoVLC')).toBe(50.4736)
    expect(geoidNFor('MUSUspace')).toBe(50.8231)
    expect(geoidNFor('CVUspace')).toBe(50.7302)
    for (const n of Object.values(GEOID_N_BY_USPACE)) expect(n).toBeGreaterThan(45) // not 0, not EGM96 by accident
  })

  it('an unknown U-space, an empty id or nothing -> null (the caller uses 0 and warns), never 0', () => {
    for (const id of ['GLOBAL_U_SPACE', 'U-SPACE-1', 'vlcuspace', '', null, undefined]) expect(geoidNFor(id)).toBeNull()
  })

  // BUG (R6 review): `uspaceId in GEOID_N_BY_USPACE` also matches Object.prototype keys, so geoidNFor('constructor')
  // returns a function. The U-space id comes from the stored geoawarenessData, which the plan owner can write. Delete
  // `.failing` when geoidNFor uses Object.hasOwn.
  it.failing('ignores Object.prototype keys', () => {
    for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) expect(geoidNFor(id)).toBeNull()
  })
})

describe('labels (the reference is always part of the text)', () => {
  it('labelAlt states the reference the data source declared', () => {
    expect(labelAlt({ meters: 120, ref: 'AGL' }, fmt)).toBe('120 m AGL')
    expect(labelAlt({ meters: 300, ref: 'AMSL' }, fmt)).toBe('300 m AMSL')
    expect(labelAlt({ meters: 10, ref: 'WGS84' }, fmt)).toBe('10 m WGS84')
    expect(labelAlt({ meters: 40, ref: 'HAT' }, fmt)).toBe('40 m above takeoff')
  })

  it('a volume is labelled AGL (what the U-plan says) although it is drawn from the takeoff', () => {
    const a = volumeAlt({ value: 20, reference: 'AGL', uom: 'M' }) as Alt
    expect(labelAlt(a, fmt)).toBe('20 m AGL')
  })

  it('rounds to one decimal (feet conversions)', () => {
    expect(labelAlt({ meters: 121.92, ref: 'AGL' }, fmt)).toBe('121.9 m AGL')
  })

  it('labelAltRange joins same-reference limits, and spells both when they differ', () => {
    expect(labelAltRange({ meters: 10, ref: 'AGL' }, { meters: 121.92, ref: 'AGL' }, fmt)).toBe('10-121.9 m AGL')
    expect(labelAltRange({ meters: 0, ref: 'AGL' }, { meters: 300, ref: 'AMSL' }, fmt)).toBe('0 m AGL / 300 m AMSL')
  })
})
