/**
 * Altitude conventions of the plan viewer, in ONE place (pure: no Cesium, no React, no network).
 *
 * Everything that is drawn in 3D ends on ONE absolute reference: metres above the WGS84 ellipsoid, the datum of the
 * Cesium World Terrain. Each data source declares (or implies) a different reference; `toEllipsoid` is the only place
 * that converts them:
 *
 *   HAT   metres above the takeoff / home point: QGC .plan waypoints and the trajectory CSV `Alt` column.
 *         ellipsoid = terrainH(takeoff) + m. One base for the whole route: the line does NOT follow the terrain.
 *   AGL   metres above the ground right below: geozone limits declared AGL. ellipsoid = terrainH(zone centroid) + m.
 *   AMSL  metres above mean sea level: ellipsoid = m + geoidN (EGM2008 geoid height of the U-space, see GEOID_N_BY_USPACE).
 *   WGS84 already ellipsoidal: ellipsoid = m.
 *
 * U-plan operation volumes are the exception handled by `volumeAlt` below.
 */

export type AltRef = 'AGL' | 'HAT' | 'AMSL' | 'WGS84'

export interface Alt {
  /** Metres (feet are converted on parsing). */
  meters: number
  /** Reference the value is drawn with. */
  ref: AltRef
  /** Reference the data source declared, when it differs from `ref` (labels state what the data says). */
  declared?: AltRef
}

/** What `toEllipsoid` needs: terrain heights (ellipsoidal, metres) and the geoid height of the U-space. */
export interface AltCtx {
  /** Terrain height at the reference point of the feature (the geozone centroid; unused by HAT / AMSL / WGS84). */
  terrainH: number
  /** Terrain height at the takeoff point. */
  takeoffH: number
  /** Geoid height N (ellipsoid height of mean sea level) at the U-space. */
  geoidN: number
}

export const FT_TO_M = 0.3048

/**
 * Geoid height N (metres, EGM2008) per U-space id; AMSL limits are converted with it. A U-space that is not here gets 0
 * and the viewer shows a legend warning. Values: GeographicLib GeoidEval 2.5.2 at the centre of each U-space bounding
 * box as served by the geoawareness service on 2026-10-27. Within VLCUspace, PuertoVLC and MUSUspace N varies by
 * < 0.1 m; CVUspace spans 37.8-40.8 N, where N goes from 49.82 (south) to 51.94 (north), so its constant is +/- 1.1 m.
 * ponytail: one constant per U-space (Alex, 2026-10-27); a geoid grid only if a U-space much larger than CVUspace appears.
 */
export const GEOID_N_BY_USPACE: Record<string, number> = {
  VLCUspace: 50.5492, // centre 39.4569, -0.3528
  PuertoVLC: 50.4736, // centre 39.4414, -0.3139
  MUSUspace: 50.8231, // centre 39.5791, -0.3640
  CVUspace: 50.7302, // centre 39.3000, -0.5000
}

/** Geoid height of a U-space, or null when the U-space is unknown (callers then use 0 and warn). */
export function geoidNFor(uspaceId: string | null | undefined): number | null {
  return uspaceId && uspaceId in GEOID_N_BY_USPACE ? GEOID_N_BY_USPACE[uspaceId] : null
}

function refOf(reference: unknown, fallback: AltRef): AltRef {
  if (typeof reference !== 'string') return fallback
  const r = reference.toUpperCase()
  if (r.includes('AGL') || r.includes('GROUND')) return 'AGL'
  if (r.includes('HAT') || r.includes('TAKEOFF') || r.includes('HOME')) return 'HAT'
  if (r.includes('AMSL') || r === 'MSL') return 'AMSL'
  if (r.includes('WGS') || r.includes('ELLIPSOID') || r === 'HAE') return 'WGS84'
  return fallback
}

/** `{ value, reference, uom }` or a bare number (metres) -> Alt. Unknown / missing reference takes `fallbackRef`. */
export function parseAlt(raw: unknown, fallbackRef: AltRef): Alt | null {
  if (raw == null) return null
  const obj = typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const value = Number(obj ? obj.value : raw)
  if (!Number.isFinite(value) || (obj ? obj.value : raw) === '') return null
  const feet = typeof obj?.uom === 'string' && obj.uom.toUpperCase() === 'FT'
  return { meters: feet ? value * FT_TO_M : value, ref: refOf(obj?.reference, fallbackRef) }
}

/**
 * THE rule for U-plan operation volumes (revisit here if UPPS changes how volumes are generated).
 * The U-plan declares `reference: "AGL"`, but UPPS builds the volumes from the trajectory CSV `Alt` column (metres above
 * the takeoff point) +- a buffer, so they are drawn on the SAME base as the trajectory: terrainH(takeoff) + value.
 * The U-plan data and what is sent to FAS are not touched; the label still states what the U-plan declares.
 */
export function volumeAlt(raw: unknown): Alt | null {
  const a = parseAlt(raw, 'AGL')
  if (!a) return null
  return a.ref === 'AGL' ? { meters: a.meters, ref: 'HAT', declared: 'AGL' } : a
}

/** Height above the WGS84 ellipsoid (metres) of an altitude, given the terrain heights and the geoid height. */
export function toEllipsoid(a: Alt, ctx: AltCtx): number {
  switch (a.ref) {
    case 'AGL':
      return ctx.terrainH + a.meters
    case 'HAT':
      return ctx.takeoffH + a.meters
    case 'AMSL':
      return a.meters + ctx.geoidN
    case 'WGS84':
      return a.meters
  }
}

/** Label templates per reference, `{n}` is the number (i18n: planAuth.viewer.alt). */
export type AltFormats = Record<AltRef, string>

const round1 = (m: number) => Math.round(m * 10) / 10

/** "40 m above takeoff", "120 m AGL", "300 m AMSL": the reference is always part of the text. */
export function labelAlt(a: Alt, formats: AltFormats): string {
  return formats[a.declared ?? a.ref].replace('{n}', String(round1(a.meters)))
}

/** "10-122 m AGL" for two altitudes of the same reference, else both labels joined by " / ". */
export function labelAltRange(a: Alt, b: Alt, formats: AltFormats): string {
  const ra = a.declared ?? a.ref
  if (ra !== (b.declared ?? b.ref)) return `${labelAlt(a, formats)} / ${labelAlt(b, formats)}`
  return formats[ra].replace('{n}', `${round1(a.meters)}-${round1(b.meters)}`)
}
