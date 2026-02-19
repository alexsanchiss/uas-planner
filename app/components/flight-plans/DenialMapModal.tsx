'use client'

import React, { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Modal } from '../ui/modal'
import { useI18n, interpolate } from '@/app/i18n'

/**
 * Parsed denial information from FAS authorizationMessage.
 *
 * Expected FAS denial JSON shape:
 * {
 *   "volumes": [
 *     { "ordinal": 0, "status": "CONFLICTING", ... },
 *     { "ordinal": 1, "status": "OK", ... }
 *   ],
 *   "geozones_information": {
 *     "conflicting_geozones": [
 *       { "identifier": "GZ-001", "type": "PROHIBITED", "name": "...", "geometry": { "type": "Polygon", "coordinates": [...] }, ... }
 *     ]
 *   }
 * }
 */

interface DenialVolume {
  ordinal?: number
  status?: string
  [key: string]: unknown
}

interface ConflictingGeozone {
  identifier?: string
  id?: string | number
  name?: string
  type?: string
  info?: string
  conflict?: boolean
  geometry?: {
    type: string
    coordinates: number[][][] | number[][]
  }
  [key: string]: unknown
}

interface ParsedDenial {
  volumes: DenialVolume[]
  conflictingIndices: Set<number>
  conflictingGeozones: ConflictingGeozone[]
}

/** Point-in-polygon test using ray casting */
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Check if line segments (p1-p2) and (p3-p4) intersect */
function segmentsIntersect(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number]
): boolean {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  if (d1 === 0 && onSegment(p3, p4, p1)) return true
  if (d2 === 0 && onSegment(p3, p4, p2)) return true
  if (d3 === 0 && onSegment(p1, p2, p3)) return true
  if (d4 === 0 && onSegment(p1, p2, p4)) return true
  return false
}

function cross(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function onSegment(a: [number, number], b: [number, number], c: [number, number]): boolean {
  return Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) &&
         Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1])
}

/** Check if two 2D polygons intersect (vertex containment + edge crossing) */
function polygonsIntersect(polyA: [number, number][], polyB: [number, number][]): boolean {
  // Check if any vertex of A is inside B
  for (const pt of polyA) {
    if (pointInPolygon(pt, polyB)) return true
  }
  // Check if any vertex of B is inside A
  for (const pt of polyB) {
    if (pointInPolygon(pt, polyA)) return true
  }
  // Check edge intersections
  for (let i = 0; i < polyA.length - 1; i++) {
    for (let j = 0; j < polyB.length - 1; j++) {
      if (segmentsIntersect(polyA[i], polyA[i + 1], polyB[j], polyB[j + 1])) return true
    }
  }
  return false
}

/** Extract polygon ring as [lon, lat] pairs from GeoJSON coordinates */
function extractRing(coords: number[][][] | number[][], geoType: string): [number, number][] {
  if (geoType === 'Polygon' && Array.isArray(coords[0]?.[0])) {
    return (coords[0] as number[][]).map(c => [c[0], c[1]])
  }
  return (coords as number[][]).map(c => [c[0], c[1]])
}

interface OperationVolume {
  geometry: {
    type: string
    coordinates: number[][][]
  }
  timeBegin?: string
  timeEnd?: string
  minAltitude?: unknown
  maxAltitude?: unknown
  ordinal?: number
  name?: string
  [key: string]: unknown
}

export interface DenialMapModalProps {
  open: boolean
  onClose: () => void
  uplan: { operationVolumes?: OperationVolume[]; [key: string]: unknown } | null | undefined
  authorizationMessage?: string | null
  geoawarenessData?: unknown
}

function parseDenialMessage(authorizationMessage?: string | null): ParsedDenial {
  const empty: ParsedDenial = { volumes: [], conflictingIndices: new Set(), conflictingGeozones: [] }
  if (!authorizationMessage) return empty

  try {
    const parsed = typeof authorizationMessage === 'string'
      ? JSON.parse(authorizationMessage)
      : authorizationMessage

    // Handle FAS 400 WITHDRAWN format with service volume errors
    // Format: { "status": "WITHDRAWN", "message": { "reason": "The operation volumes [0, 1, 2, ...] are outside of the service volume." } }
    if (parsed.status === 'WITHDRAWN' && parsed.message?.reason) {
      const reason = parsed.message.reason
      // Extract volume indices from reason string (e.g., "[0, 1, 2, 3]")
      const volumeMatch = reason.match(/\[(\d+(?:,\s*\d+)*)\]/)
      if (volumeMatch) {
        const indices = volumeMatch[1].split(',').map((s: string) => parseInt(s.trim(), 10))
        const conflictingIndices = new Set<number>(indices)
        const volumes = indices.map((idx: number) => ({ ordinal: idx, status: 'CONFLICTING' }))
        return { volumes, conflictingIndices, conflictingGeozones: [] }
      }
      // If we can't parse indices but have a WITHDRAWN message, mark all as conflicting
      return empty
    }

    // Handle multiple FAS response formats for volumes:
    // Format A: { "volumes": [{ "ordinal": 0, "status": "CONFLICTING" }, ...] }
    // Format B: { "volumes": [0, 1, 2] }  (just conflicting indices)
    // Format C: No volumes key — all volumes are conflicting (denial)
    const rawVolumes = parsed.volumes

    const conflictingIndices = new Set<number>()
    const volumes: DenialVolume[] = []

    if (Array.isArray(rawVolumes)) {
      for (const vol of rawVolumes) {
        if (typeof vol === 'number') {
          // Format B: volume index = conflicting
          conflictingIndices.add(vol)
          volumes.push({ ordinal: vol, status: 'CONFLICTING' })
        } else if (typeof vol === 'object' && vol !== null) {
          volumes.push(vol)
          if (
            typeof vol.status === 'string' &&
            vol.status.toUpperCase() === 'CONFLICTING' &&
            typeof vol.ordinal === 'number'
          ) {
            conflictingIndices.add(vol.ordinal)
          }
        }
      }
    }

    // If we got a denial message but no conflicting indices were identified,
    // assume ALL volumes are conflicting (the plan was denied for a reason)
    // This handles Format C and edge cases where the FAS response doesn't specify volumes
    const geozonesInfo = parsed.geozones_information || parsed.geozonesInformation || {}
    const conflictingGeozones: ConflictingGeozone[] = Array.isArray(geozonesInfo.conflicting_geozones)
      ? geozonesInfo.conflicting_geozones
      : Array.isArray(geozonesInfo.conflictingGeozones)
        ? geozonesInfo.conflictingGeozones
        : []

    return { volumes, conflictingIndices, conflictingGeozones }
  } catch {
    return empty
  }
}

function extractAltDisplay(alt: unknown): string {
  if (alt == null) return 'N/A'
  if (typeof alt === 'number') return `${alt.toFixed(1)}m`
  if (typeof alt === 'object' && alt !== null) {
    const a = alt as Record<string, unknown>
    if (a.value !== undefined) {
      const val = typeof a.value === 'number' ? a.value.toFixed(1) : String(a.value)
      return `${val}${a.uom || 'm'}`
    }
  }
  if (typeof alt === 'string') return alt
  return 'N/A'
}

/** Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lon] */
function toLeafletCoords(coordinates: number[][]): [number, number][] {
  return coordinates.map(([lon, lat]) => [lat, lon])
}

/** Fit map bounds to all rendered polygons */
function FitBoundsHandler({ allCoords }: { allCoords: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (allCoords.length === 0) return
    const lats = allCoords.map(c => c[0])
    const lngs = allCoords.map(c => c[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, allCoords])

  return null
}

function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [map])
  return null
}

export function DenialMapModal({ open, onClose, uplan, authorizationMessage, geoawarenessData }: DenialMapModalProps) {
  const { t } = useI18n()
  const denial = useMemo(() => parseDenialMessage(authorizationMessage), [authorizationMessage])
  
  // Extract the raw denial message for display
  const denialMessageData = useMemo(() => {
    if (!authorizationMessage) return null
    try {
      const parsed = typeof authorizationMessage === 'string'
        ? JSON.parse(authorizationMessage)
        : authorizationMessage
      return parsed
    } catch {
      return null
    }
  }, [authorizationMessage])

  // Parse FAS denial reasons from geozones_information
  const fasDenialReasons = useMemo(() => {
    if (!denialMessageData) return null
    const geozonesInfo = denialMessageData.geozones_information || denialMessageData.geozonesInformation
    if (!geozonesInfo) return null
    const conflicting = geozonesInfo.conflicting_geozones || geozonesInfo.conflictingGeozones
    if (!Array.isArray(conflicting) || conflicting.length === 0) return null
    return {
      count: geozonesInfo.number_conflicting_geozones ?? conflicting.length,
      geozones: conflicting as Array<{ id?: string; identifier?: string; type?: string; info?: string; conflict?: boolean }>,
    }
  }, [denialMessageData])

  // Look up geozone geometries from geoawarenessData by matching conflicting geozone IDs
  const geozoneGeometryLookup = useMemo(() => {
    const lookup = new Map<string, { type: string; coordinates: number[][][] | number[][] }>()
    if (!geoawarenessData || typeof geoawarenessData !== 'object') return lookup
    const data = geoawarenessData as { features?: Array<{ properties?: { identifier?: string; name?: string }; geometry?: { type: string; coordinates: number[][][] | number[][] } }> }
    if (!Array.isArray(data.features)) return lookup
    for (const feature of data.features) {
      const id = feature.properties?.identifier || feature.properties?.name
      if (id && feature.geometry?.coordinates) {
        lookup.set(id, feature.geometry)
      }
    }
    return lookup
  }, [geoawarenessData])

  const operationVolumes = useMemo(() => {
    if (!uplan?.operationVolumes || !Array.isArray(uplan.operationVolumes)) return []

    // Determine if we should use 2D polygon intersection for selective marking
    const hasSpecificIndices = denial.conflictingIndices.size > 0 || denial.volumes.length > 0
    const hasConflictingGeozones = denial.conflictingGeozones.length > 0

    // Build geozone polygons for intersection testing (from FAS response or geoawarenessData)
    const geozoneRings: [number, number][][] = []
    if (!hasSpecificIndices && hasConflictingGeozones) {
      for (const gz of denial.conflictingGeozones) {
        const gzId = gz.identifier || gz.id?.toString() || ''
        // Try geozone geometry from FAS response first, then from geoawarenessData
        const geometry = gz.geometry || (gzId ? geozoneGeometryLookup.get(gzId) : undefined)
        if (geometry?.coordinates) {
          geozoneRings.push(extractRing(geometry.coordinates, geometry.type))
        }
      }
    }

    const useIntersectionTest = !hasSpecificIndices && geozoneRings.length > 0
    // If no specific indices AND no geometry available, fall back to all-red
    const allConflicting = !hasSpecificIndices && !useIntersectionTest

    return uplan.operationVolumes.map((vol, idx) => {
      const coords = vol.geometry?.coordinates?.[0]
      if (!coords || !Array.isArray(coords)) return null
      const leafletCoords = toLeafletCoords(coords)

      let isConflicting: boolean
      if (hasSpecificIndices) {
        isConflicting = denial.conflictingIndices.has(vol.ordinal ?? idx)
      } else if (useIntersectionTest) {
        // Check 2D polygon intersection between this volume and each geozone
        const volRing = coords.map((c: number[]) => [c[0], c[1]] as [number, number])
        isConflicting = geozoneRings.some(gzRing => polygonsIntersect(volRing, gzRing))
      } else {
        isConflicting = allConflicting
      }

      return {
        coords: leafletCoords,
        idx,
        ordinal: vol.ordinal ?? idx,
        label: vol.name || `Volume ${idx + 1}`,
        isConflicting,
        timeBegin: vol.timeBegin,
        timeEnd: vol.timeEnd,
        minAlt: extractAltDisplay(vol.minAltitude),
        maxAlt: extractAltDisplay(vol.maxAltitude),
      }
    }).filter(Boolean) as {
      coords: [number, number][]
      idx: number
      ordinal: number
      label: string
      isConflicting: boolean
      timeBegin?: string
      timeEnd?: string
      minAlt: string
      maxAlt: string
    }[]
  }, [uplan, denial.conflictingIndices, denial.volumes.length, denial.conflictingGeozones, geozoneGeometryLookup])

  const geozonePolygons = useMemo(() => {
    return denial.conflictingGeozones
      .map((gz, idx) => {
        const gzId = gz.identifier || gz.id?.toString() || ''
        // Use geometry from FAS response first, then from geoawarenessData
        const geometry = gz.geometry || (gzId ? geozoneGeometryLookup.get(gzId) : undefined)
        if (!geometry?.coordinates) return null
        const rawCoords = geometry.type === 'Polygon'
          ? geometry.coordinates[0] as number[][]
          : geometry.coordinates as unknown as number[][]
        const leafletCoords = toLeafletCoords(rawCoords)
        return {
          coords: leafletCoords,
          identifier: gz.identifier || gz.id?.toString() || `Geozone ${idx + 1}`,
          name: gz.name || '',
          type: gz.type || 'Unknown',
          info: gz.info || '',
          raw: gz,
        }
      })
      .filter(Boolean) as {
        coords: [number, number][]
        identifier: string
        name: string
        type: string
        info: string
        raw: ConflictingGeozone
      }[]
  }, [denial.conflictingGeozones, geozoneGeometryLookup])

  // Collect all coords for bounds fitting
  const allCoords = useMemo(() => {
    const coords: [number, number][] = []
    for (const vol of operationVolumes) {
      coords.push(...vol.coords)
    }
    for (const gz of geozonePolygons) {
      coords.push(...gz.coords)
    }
    return coords
  }, [operationVolumes, geozonePolygons])

  if (!open) return null

  const hasContent = operationVolumes.length > 0 || geozonePolygons.length > 0
  const center: [number, number] = allCoords.length > 0
    ? [
        allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length,
        allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length,
      ]
    : [39.47, -0.38]

  const conflictCount = operationVolumes.filter(v => v.isConflicting).length

  return (
    <Modal open={open} onClose={onClose} title={t.flightPlans.denialMapTitle} maxWidth="4xl">
      {/* Summary banner */}
      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {t.flightPlans.denialAuthorization}
            </p>
            <p className="text-xs text-red-700 dark:text-red-400">
              {conflictCount > 0
                ? interpolate(t.flightPlans.conflictingVolumesDetected, { n: conflictCount })
                : t.flightPlans.reviewDenialDetails}
              {geozonePolygons.length > 0 && ` — ${geozonePolygons.length} ${geozonePolygons.length !== 1 ? t.flightPlans.conflictingGeozones.toLowerCase() : t.flightPlans.conflictingGeozone.toLowerCase()}`}
            </p>
            {/* Show FAS reason if available */}
            {denialMessageData?.status === 'WITHDRAWN' && denialMessageData?.message?.reason && (
              <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-700">
                <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                  {t.flightPlans.fasReason || 'FAS Reason'}:
                </p>
                <p className="text-xs text-red-700 dark:text-red-400">
                  {denialMessageData.message.reason}
                </p>
                {denialMessageData.message.reason.includes('outside of the service volume') && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                    ⚠️ {t.flightPlans.contactDifferentFAS || 'This operation must be authorized by a different FAS'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAS Denial Reason — geozone conflict details */}
      {fasDenialReasons && (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800 rounded-lg">
          <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">
            {t.flightPlans.fasDenialReasonHeader}
          </h4>
          <p className="text-xs text-orange-700 dark:text-orange-400 mb-2">
            {fasDenialReasons.count} {fasDenialReasons.count !== 1 ? t.flightPlans.conflictingGeozones.toLowerCase() : t.flightPlans.conflictingGeozone.toLowerCase()}
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {fasDenialReasons.geozones.map((gz, idx) => (
              <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold text-orange-800 dark:text-orange-300">
                    {gz.id || gz.identifier || `Geozone ${idx + 1}`}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-medium">
                    {gz.type || 'Unknown'}
                  </span>
                </div>
                {gz.info && (
                  <p className="text-xs text-[var(--text-secondary)]">{gz.info}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-geozone raw denial message fallback */}
      {!fasDenialReasons && denialMessageData && denialMessageData.status !== 'WITHDRAWN' && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            {t.flightPlans.fasReason}
          </h4>
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {typeof authorizationMessage === 'string' ? authorizationMessage : JSON.stringify(denialMessageData, null, 2)}
          </pre>
        </div>
      )}

      {/* Map */}
      {hasContent ? (
        <div className="w-full h-[50vh] md:h-[450px] max-h-[70vh] min-h-[200px] mb-4 relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <MapContainer
            center={center}
            zoom={14}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <FitBoundsHandler allCoords={allCoords} />
            <MapResizeHandler />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {/* Operation volumes */}
            {operationVolumes.map((vol) => (
              <Polygon
                key={`vol-${vol.idx}`}
                positions={vol.coords}
                pathOptions={{
                  color: vol.isConflicting ? '#dc2626' : '#6b7280',
                  fillColor: vol.isConflicting ? '#ef4444' : '#9ca3af',
                  fillOpacity: vol.isConflicting ? 0.4 : 0.2,
                  weight: vol.isConflicting ? 3 : 1.5,
                  dashArray: vol.isConflicting ? undefined : '5 5',
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} sticky>
                  <div className="text-xs min-w-[140px]">
                    <div className={`font-semibold mb-1 ${vol.isConflicting ? 'text-red-600' : 'text-gray-600'}`}>
                      {vol.label} {vol.isConflicting ? `⚠ ${t.flightPlans.conflictingStatus}` : `✓ ${t.flightPlans.okStatus}`}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-gray-500">{t.flightPlans.ordinal}:</span>
                      <span>{vol.ordinal}</span>
                      {vol.timeBegin && (
                        <>
                          <span className="text-gray-500">{t.flightPlans.startLabel}:</span>
                          <span>{new Date(vol.timeBegin).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                        </>
                      )}
                      {vol.timeEnd && (
                        <>
                          <span className="text-gray-500">{t.flightPlans.endLabel}:</span>
                          <span>{new Date(vol.timeEnd).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                        </>
                      )}
                      <span className="text-gray-500">{t.flightPlans.alt}:</span>
                      <span>{vol.minAlt} — {vol.maxAlt}</span>
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            ))}

            {/* Conflicting geozones */}
            {geozonePolygons.map((gz, idx) => (
              <Polygon
                key={`gz-${idx}`}
                positions={gz.coords}
                pathOptions={{
                  color: '#b91c1c',
                  fillColor: '#f87171',
                  fillOpacity: 0.3,
                  weight: 2,
                  dashArray: '8 4',
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} sticky>
                  <div className="text-xs min-w-[140px]">
                    <div className="font-semibold text-red-700 mb-1">
                      🚫 {gz.identifier}
                    </div>
                    {gz.name && (
                      <div className="text-gray-600 mb-1">{gz.name}</div>
                    )}
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-gray-500">{t.flightPlans.typeLabel}:</span>
                      <span>{gz.type}</span>
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="w-full h-48 mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">
            {t.flightPlans.noSpatialData}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded bg-red-500/50 border-2 border-red-600"></div>
          <span className="text-[var(--text-secondary)]">{t.flightPlans.conflictingVolume}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded bg-gray-400/30 border border-gray-500" style={{ borderStyle: 'dashed' }}></div>
          <span className="text-[var(--text-secondary)]">{t.flightPlans.okVolume}</span>
        </div>
        {geozonePolygons.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded bg-red-400/40 border-2 border-red-700" style={{ borderStyle: 'dashed' }}></div>
            <span className="text-[var(--text-secondary)]">{t.flightPlans.conflictingGeozone}</span>
          </div>
        )}
      </div>

      {/* Conflicting geozones detail list */}
      {geozonePolygons.length > 0 && (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t.flightPlans.conflictingGeozones}</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {geozonePolygons.map((gz, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded border border-red-200 dark:border-red-800">
                <span className="text-red-600 dark:text-red-400 text-xs font-mono font-semibold flex-shrink-0">
                  {gz.identifier}
                </span>
                <div className="text-xs text-[var(--text-secondary)]">
                  {gz.name && <span className="font-medium">{gz.name} — </span>}
                  <span className="text-red-600 dark:text-red-400">{gz.type}</span>
                  {gz.info && <p className="mt-0.5 text-[var(--text-muted)]">{gz.info}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-center text-xs text-[var(--text-muted)]">
        {operationVolumes.length > 0 && (
          <span>{operationVolumes.length} operation volume{operationVolumes.length !== 1 ? 's' : ''}</span>
        )}
        {operationVolumes.length > 0 && geozonePolygons.length > 0 && <span> · </span>}
        {geozonePolygons.length > 0 && (
          <span>{geozonePolygons.length} conflicting geozone{geozonePolygons.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </Modal>
  )
}

export default DenialMapModal
