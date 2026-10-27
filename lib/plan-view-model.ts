/**
 * Plan view model: normalises everything a plan can show (QGC waypoints, trajectory CSV, U-plan operation volumes,
 * geozones, FAS result, SCRS alternative) into one shape. Pure (no Cesium, no React, no network). Altitudes stay `Alt`
 * values (lib/altitude.ts) so the 2D map can label them; `resolveHeights` turns them into absolute ellipsoid heights
 * once the terrain heights are sampled (3D only).
 */

import { geoidNFor, parseAlt, toEllipsoid, volumeAlt, type Alt, type AltCtx } from './altitude'
import { parseScrsAlternative } from './scrs'

export interface LonLat {
  lon: number
  lat: number
}
/** GeoJSON order: [lon, lat]. */
export type Ring = [number, number][]

export interface VmWaypoint extends LonLat {
  alt: Alt
  type: 'takeoff' | 'cruise' | 'landing'
}
export interface VmTrajPoint extends LonLat {
  alt: Alt
  /** Seconds since the first CSV row. */
  t: number
}
export interface VmVolume {
  ordinal: number
  name: string
  ring: Ring
  min: Alt | null
  max: Alt | null
  beginMs: number | null
  endMs: number | null
}
export interface VmZone {
  id: string
  name: string
  type: string
  info: string
  ring: Ring
  lower: Alt
  upper: Alt
  /** Named by the FAS answer as a conflict. */
  conflicting: boolean
}
export interface VmResult {
  status: 'approved' | 'denied' | 'withdrawn'
  /** Ordinals of the conflicting volumes; empty on a denial = all of them (FAS did not say which). */
  conflictingOrdinals: number[]
  withdrawnReason: string | null
  conflictingGeozones: { id: string; type: string; info: string }[]
  /** The FAS message as received (string), for the Details section. */
  text: string | null
}
export interface VmScrs {
  current: (LonLat & { alt: Alt })[]
  alternative: (LonLat & { alt: Alt })[]
}
export interface PlanViewModel {
  waypoints: VmWaypoint[]
  trajectory: VmTrajPoint[]
  volumes: VmVolume[]
  zones: VmZone[]
  result: VmResult | null
  scrs: VmScrs | null
  /** Takeoff point: the base of every HAT height. */
  takeoff: LonLat | null
  uspaceId: string | null
  /** The 4D slider axis (ms). Volumes give it; without them the trajectory duration does. */
  timeline: { startMs: number; endMs: number } | null
}

export interface PlanViewInput {
  /** Parsed QGC .plan waypoints (metres above takeoff). */
  waypoints: { lat: number; lng: number; alt: number }[]
  uplan: unknown
  /** Trajectory CSV text, when the layer is on. */
  csv: string | null
  authorizationMessage: unknown
  authStatus: 'approved' | 'denied' | 'withdrawn' | null
  /** Stored `flightPlan.geoawarenessData`. */
  geoawarenessData: unknown
  /** Live geozones of the U-space (SSE), when the layer is on. */
  liveZones: unknown[]
  uspaceId: string | null
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null

// ---- Trajectory CSV --------------------------------------------------------------------

/** `SimTime,Lat,Lon,Alt,...` -> points (Alt = metres above takeoff). Rows with bad coordinates are dropped. */
export function parseTrajectory(csv: string | null): VmTrajPoint[] {
  if (!csv || !csv.trim()) return []
  const lines = csv.trim().split(/\r?\n/)
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
  const iLat = header.findIndex((h) => h.includes('lat'))
  const iLon = header.findIndex((h) => h.includes('lon') || h.includes('lng'))
  const iAlt = header.findIndex((h) => h.includes('alt'))
  const iTime = header.findIndex((h) => h.includes('time'))
  if (iLat < 0 || iLon < 0) return []
  const rows: VmTrajPoint[] = []
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(',')
    const lat = parseFloat(v[iLat])
    const lon = parseFloat(v[iLon])
    if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) continue
    const alt = iAlt >= 0 ? parseFloat(v[iAlt]) : 0
    const t = iTime >= 0 ? parseFloat(v[iTime]) : i
    rows.push({ lat, lon, alt: { meters: Number.isFinite(alt) ? alt : 0, ref: 'HAT' }, t: Number.isFinite(t) ? t : i })
  }
  const t0 = rows[0]?.t ?? 0
  return rows.map((r) => ({ ...r, t: r.t - t0 }))
}

/** Position (and altitude) of the drone `tSec` seconds into the trajectory (linear between rows, clamped). */
export function droneAt(points: VmTrajPoint[], tSec: number): (LonLat & { alt: Alt }) | null {
  if (points.length === 0) return null
  if (tSec <= points[0].t) return points[0]
  const last = points[points.length - 1]
  if (tSec >= last.t) return last
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (tSec >= a.t && tSec <= b.t) {
      const k = b.t === a.t ? 0 : (tSec - a.t) / (b.t - a.t)
      return { lon: a.lon + k * (b.lon - a.lon), lat: a.lat + k * (b.lat - a.lat), alt: { ...a.alt, meters: a.alt.meters + k * (b.alt.meters - a.alt.meters) } }
    }
  }
  return last
}

// ---- Geometry --------------------------------------------------------------------------

/** [lat, lng] pairs written the wrong way round (a service quirk): lat is <= 90 and the second value cannot be one. */
function looksLatLng([a, b]: number[]): boolean {
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false
  return Math.abs(b) > 90 || (a > 30 && a < 50 && Math.abs(b) < 10)
}

/** Outer ring of a Polygon / MultiPolygon (any nesting depth, string-encoded or [lat, lng] swapped) as [lon, lat]. */
export function ringOf(geometry: unknown): Ring | null {
  if (!isObj(geometry)) return null
  let coords = geometry.coordinates
  if (typeof coords === 'string') {
    try {
      coords = JSON.parse(coords)
    } catch {
      return null
    }
  }
  if (!Array.isArray(coords)) return null
  let ring: unknown = geometry.type === 'MultiPolygon' ? (coords as unknown[][])[0]?.[0] : Array.isArray(coords[0]) && typeof (coords[0] as unknown[])[0] === 'number' ? coords : coords[0]
  if (!Array.isArray(ring)) return null
  const pts = ring.filter((c): c is number[] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
  if (pts.length < 3) return null
  const swap = looksLatLng(pts[0])
  ring = pts.map((c) => (swap ? [c[1], c[0]] : [c[0], c[1]]))
  return ring as Ring
}

/** Area centroid of a ring (planar, fine at plan scale); the vertex mean when the ring is degenerate. */
export function ringCentroid(ring: Ring): LonLat {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    const f = x1 * y2 - x2 * y1
    a += f
    cx += (x1 + x2) * f
    cy += (y1 + y2) * f
  }
  if (Math.abs(a) < 1e-18) return { lon: ring.reduce((s, p) => s + p[0], 0) / ring.length, lat: ring.reduce((s, p) => s + p[1], 0) / ring.length }
  return { lon: cx / (3 * a), lat: cy / (3 * a) }
}

/** Rough ground distance in km (equirectangular): enough to tell "same place" from "somewhere else". */
function distKm(a: LonLat, b: LonLat): number {
  const dx = (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180))
  return Math.hypot(dx, a.lat - b.lat) * 111.32
}

// ---- U-plan ----------------------------------------------------------------------------

function pointOf(p: unknown): (LonLat & { alt: Alt | null }) | null {
  const c = isObj(p) && Array.isArray(p.coordinates) ? (p.coordinates as unknown[]) : null
  if (!c || typeof c[0] !== 'number' || typeof c[1] !== 'number') return null
  return { lon: c[0], lat: c[1], alt: parseAlt(c[2], 'HAT') }
}

function parseVolumes(uplan: unknown): VmVolume[] {
  const vols = isObj(uplan) && Array.isArray(uplan.operationVolumes) ? uplan.operationVolumes : []
  const out: VmVolume[] = []
  vols.forEach((raw, idx) => {
    if (!isObj(raw)) return
    const g = isObj(raw.geometry) ? raw.geometry : null
    const first = Array.isArray(g?.coordinates) ? (g.coordinates as unknown[])[0] : null
    const ring = (Array.isArray(first) ? first : []).filter((c): c is number[] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number').map((c): [number, number] => [c[0], c[1]])
    if (ring.length < 3) return
    const begin = typeof raw.timeBegin === 'string' ? Date.parse(raw.timeBegin) : NaN
    const end = typeof raw.timeEnd === 'string' ? Date.parse(raw.timeEnd) : NaN
    out.push({
      ordinal: typeof raw.ordinal === 'number' ? raw.ordinal : idx,
      name: typeof raw.name === 'string' && raw.name ? raw.name : '',
      ring,
      min: volumeAlt(raw.minAltitude),
      max: volumeAlt(raw.maxAltitude),
      beginMs: Number.isFinite(begin) ? begin : null,
      endMs: Number.isFinite(end) ? end : null,
    })
  })
  return out
}

function uplanRoute(uplan: unknown): (LonLat & { alt: Alt })[] {
  const wps = isObj(uplan) && isObj(uplan.flightDetails) && Array.isArray(uplan.flightDetails.waypoints) ? uplan.flightDetails.waypoints : []
  return wps.flatMap((w) => {
    const p = isObj(w) && w.type === 'Point' ? pointOf(w) : null
    return p ? [{ lon: p.lon, lat: p.lat, alt: p.alt ?? ({ meters: 0, ref: 'HAT' } as Alt) }] : []
  })
}

// ---- FAS result ------------------------------------------------------------------------

function parseJsonLoose(v: unknown): Obj | null {
  try {
    const p = typeof v === 'string' ? JSON.parse(v) : v
    return isObj(p) ? p : null
  } catch {
    return null
  }
}

/** Conflicts of a FAS answer (same formats the old result modal read: WITHDRAWN `[1, 2]` reason, `volumes`, geozones_information). */
export function parseResult(message: unknown, status: VmResult['status']): VmResult {
  const text = typeof message === 'string' ? message || null : message != null ? JSON.stringify(message) : null
  const res: VmResult = { status, conflictingOrdinals: [], withdrawnReason: null, conflictingGeozones: [], text }
  const p = parseJsonLoose(message)
  if (!p || status === 'approved') return res
  const reason = isObj(p.message) && typeof p.message.reason === 'string' ? p.message.reason : null
  if (p.status === 'WITHDRAWN' && reason) {
    res.withdrawnReason = reason
    const m = reason.match(/\[(\d+(?:,\s*\d+)*)\]/)
    if (m) res.conflictingOrdinals = m[1].split(',').map((s) => parseInt(s.trim(), 10))
    return res
  }
  if (Array.isArray(p.volumes)) {
    for (const v of p.volumes) {
      if (typeof v === 'number') res.conflictingOrdinals.push(v)
      else if (isObj(v) && typeof v.ordinal === 'number' && typeof v.status === 'string' && v.status.toUpperCase() === 'CONFLICTING' && v.ordinal >= 0) res.conflictingOrdinals.push(v.ordinal)
    }
  }
  const info = (isObj(p.geozones_information) ? p.geozones_information : isObj(p.geozonesInformation) ? p.geozonesInformation : {}) as Obj
  const list = Array.isArray(info.conflicting_geozones) ? info.conflicting_geozones : Array.isArray(info.conflictingGeozones) ? info.conflictingGeozones : []
  for (const g of list) {
    if (!isObj(g)) continue
    res.conflictingGeozones.push({ id: String(g.identifier ?? g.id ?? ''), type: typeof g.type === 'string' ? g.type : '', info: typeof g.info === 'string' ? g.info : '' })
  }
  return res
}

/** Is this volume one of the conflicting ones (denied / withdrawn answers only)? */
export function isConflicting(result: VmResult | null, volume: Pick<VmVolume, 'ordinal'>): boolean {
  if (!result || result.status === 'approved') return false
  return result.conflictingOrdinals.length === 0 || result.conflictingOrdinals.includes(volume.ordinal)
}

// ---- Geozones --------------------------------------------------------------------------

interface RawZone {
  id: string
  name: string
  type: string
  info: string
  geometry: unknown
  vertical: Obj | null
  conflicting: boolean
}

/** Any of the zone shapes in circulation (WS feature, stored feature, FAS conflicting_geozones item). */
function toRawZone(x: unknown): RawZone | null {
  if (!isObj(x)) return null
  const props = isObj(x.properties) ? x.properties : {}
  const geom = isObj(x.geometry) ? x.geometry : null
  const id = String(x.uas_geozones_identifier ?? props.identifier ?? x.identifier ?? x.id ?? props.name ?? '')
  if (!id || !geom) return null
  const vertical = [geom.verticalReference, x.verticalReference, props.verticalReference].find(isObj) ?? null
  return {
    id,
    name: String(props.name ?? x.name ?? ''),
    type: String(props.type ?? x.type ?? '').toUpperCase(),
    info: typeof x.info === 'string' ? x.info : '',
    geometry: geom,
    vertical,
    conflicting: false,
  }
}

/** Zone list stored in `geoawarenessData` (a feature list or a whole service message). */
function storedZones(data: unknown): unknown[] {
  const d = parseJsonLoose(data)
  if (!d) return []
  if (Array.isArray(d.features)) return d.features
  if (isObj(d.geozones) && Array.isArray(d.geozones.features)) return d.geozones.features
  return Array.isArray(d.geozones_data) ? d.geozones_data : []
}

/** Limits of a zone: lowerReference / upperReference are read separately; missing limits default to 0 .. 150 m AGL. */
function zoneLimits(v: Obj | null): { lower: Alt; upper: Alt } {
  const withUom = (value: unknown, reference: unknown) => parseAlt({ value, reference: reference ?? 'AGL', uom: v?.uom }, 'AGL')
  return { lower: withUom(v?.lower, v?.lowerReference) ?? { meters: 0, ref: 'AGL' }, upper: withUom(v?.upper, v?.upperReference) ?? { meters: 150, ref: 'AGL' } }
}

function buildZones(input: PlanViewInput, result: VmResult | null): VmZone[] {
  const byId = new Map<string, RawZone>()
  const add = (x: unknown) => {
    const z = toRawZone(x)
    if (z && !byId.has(z.id)) byId.set(z.id, z)
  }
  input.liveZones.forEach(add)
  storedZones(input.geoawarenessData).forEach(add)
  const conflictingIds = new Set(result?.conflictingGeozones.map((g) => g.id) ?? [])
  const msg = parseJsonLoose(input.authorizationMessage)
  const gi = (isObj(msg?.geozones_information) ? msg.geozones_information : isObj(msg?.geozonesInformation) ? msg.geozonesInformation : {}) as Obj
  const listed = Array.isArray(gi.conflicting_geozones) ? gi.conflicting_geozones : Array.isArray(gi.conflictingGeozones) ? gi.conflictingGeozones : []
  listed.forEach(add) // only used when the zone has its own geometry and no other source has it
  const out: VmZone[] = []
  for (const z of byId.values()) {
    const ring = ringOf(z.geometry)
    if (!ring) continue
    const conflict = result?.conflictingGeozones.find((g) => g.id === z.id)
    out.push({ id: z.id, name: z.name, type: z.type || conflict?.type?.toUpperCase() || '', info: z.info || conflict?.info || '', ring, ...zoneLimits(z.vertical), conflicting: conflictingIds.has(z.id) })
  }
  return out
}

/** Does the zone need the terrain height at its centroid (an AGL limit)? */
export function zoneNeedsTerrain(z: Pick<VmZone, 'lower' | 'upper'>): boolean {
  return z.lower.ref === 'AGL' || z.upper.ref === 'AGL'
}

// ---- Model -----------------------------------------------------------------------------

/** Takeoff = U-plan takeoffLocation, unless it is >5 km from the route (placeholder data), else the first route point. */
function pickTakeoff(uplan: unknown, first: LonLat | null): LonLat | null {
  const t = isObj(uplan) ? pointOf(uplan.takeoffLocation) : null
  if (t && (!first || distKm(t, first) < 5)) return { lon: t.lon, lat: t.lat }
  return first
}

export function buildPlanViewModel(input: PlanViewInput): PlanViewModel {
  const uplan = parseJsonLoose(input.uplan)
  const waypoints: VmWaypoint[] = input.waypoints.map((w, i, arr) => ({
    lon: w.lng,
    lat: w.lat,
    alt: { meters: w.alt, ref: 'HAT' },
    type: i === 0 ? 'takeoff' : i === arr.length - 1 ? 'landing' : 'cruise',
  }))
  const trajectory = parseTrajectory(input.csv)
  const volumes = parseVolumes(uplan)
  const result = input.authStatus ? parseResult(input.authorizationMessage, input.authStatus) : null
  const alt = input.authStatus && input.authStatus !== 'approved' ? parseScrsAlternative(typeof input.authorizationMessage === 'string' ? input.authorizationMessage : input.authorizationMessage == null ? null : JSON.stringify(input.authorizationMessage)) : null

  const begins = volumes.flatMap((v) => (v.beginMs != null ? [v.beginMs] : []))
  const ends = volumes.flatMap((v) => (v.endMs != null ? [v.endMs] : []))
  const timeline = begins.length > 0 && ends.length > 0 ? { startMs: Math.min(...begins), endMs: Math.max(...ends) } : trajectory.length > 1 ? { startMs: 0, endMs: trajectory[trajectory.length - 1].t * 1000 } : null

  const p0 = waypoints[0] ?? trajectory[0]
  const firstPoint: LonLat | null = p0 ? { lon: p0.lon, lat: p0.lat } : volumes[0] ? { lon: volumes[0].ring[0][0], lat: volumes[0].ring[0][1] } : null
  return {
    waypoints,
    trajectory,
    volumes,
    zones: buildZones(input, result),
    result,
    scrs: alt ? { current: uplanRoute(uplan), alternative: alt.flatWaypoints.map((w) => ({ lon: w.lon, lat: w.lat, alt: { meters: w.alt, ref: 'HAT' as const } })) } : null,
    takeoff: pickTakeoff(uplan, firstPoint),
    uspaceId: input.uspaceId,
    timeline,
  }
}

// ---- Absolute heights (3D) -------------------------------------------------------------

export interface TerrainSample {
  /** Terrain height at the takeoff point (metres above the ellipsoid). */
  takeoffH: number
  /** Terrain height at each zone centroid, by zone id (only zones with an AGL limit need one). */
  zoneH: Record<string, number>
}
type H<T> = T & { h: number }
export interface AbsPlan {
  waypoints: H<VmWaypoint>[]
  trajectory: H<VmTrajPoint>[]
  volumes: (VmVolume & { lowerH: number; upperH: number })[]
  zones: (VmZone & { lowerH: number; upperH: number })[]
  scrs: { current: H<VmScrs['current'][number]>[]; alternative: H<VmScrs['alternative'][number]>[] } | null
  /** Geoid height used for AMSL limits, and whether it is a real value (false = 0 assumed: legend warning). */
  geoidKnown: boolean
}

/** Every height of the model as metres above the ellipsoid. A zone that needs a terrain height and has none is left out. */
export function resolveHeights(model: PlanViewModel, terrain: TerrainSample): AbsPlan {
  const n = geoidNFor(model.uspaceId)
  const geoidN = n ?? 0
  const ctx = (terrainH: number): AltCtx => ({ terrainH, takeoffH: terrain.takeoffH, geoidN })
  const base = ctx(terrain.takeoffH)
  const hs = <T extends { alt: Alt }>(list: T[]): H<T>[] => list.map((p) => ({ ...p, h: toEllipsoid(p.alt, base) }))
  const volumes = model.volumes.flatMap((v) => (v.min && v.max ? [{ ...v, lowerH: toEllipsoid(v.min, base), upperH: toEllipsoid(v.max, base) }] : []))
  const zones = model.zones.flatMap((z) => {
    const th = terrain.zoneH[z.id]
    if (zoneNeedsTerrain(z) && !Number.isFinite(th)) return []
    const c = ctx(th)
    return [{ ...z, lowerH: toEllipsoid(z.lower, c), upperH: toEllipsoid(z.upper, c) }]
  })
  return {
    waypoints: hs(model.waypoints),
    trajectory: hs(model.trajectory),
    volumes,
    zones,
    scrs: model.scrs ? { current: hs(model.scrs.current), alternative: hs(model.scrs.alternative) } : null,
    geoidKnown: n != null,
  }
}
