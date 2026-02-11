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

export function DenialMapModal({ open, onClose, uplan, authorizationMessage }: DenialMapModalProps) {
  const { t } = useI18n()
  const denial = useMemo(() => parseDenialMessage(authorizationMessage), [authorizationMessage])

  const operationVolumes = useMemo(() => {
    if (!uplan?.operationVolumes || !Array.isArray(uplan.operationVolumes)) return []
    // If no specific conflicting indices were identified but plan was denied,
    // mark all volumes as conflicting
    const allConflicting = denial.conflictingIndices.size === 0 && denial.volumes.length === 0
    return uplan.operationVolumes.map((vol, idx) => {
      const coords = vol.geometry?.coordinates?.[0]
      if (!coords || !Array.isArray(coords)) return null
      const leafletCoords = toLeafletCoords(coords)
      const isConflicting = allConflicting || denial.conflictingIndices.has(vol.ordinal ?? idx)
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
  }, [uplan, denial.conflictingIndices])

  const geozonePolygons = useMemo(() => {
    return denial.conflictingGeozones
      .filter(gz => gz.geometry?.coordinates)
      .map((gz, idx) => {
        const rawCoords = gz.geometry!.type === 'Polygon'
          ? gz.geometry!.coordinates[0] as number[][]
          : gz.geometry!.coordinates as unknown as number[][]
        const leafletCoords = toLeafletCoords(rawCoords)
        return {
          coords: leafletCoords,
          identifier: gz.identifier || gz.id?.toString() || `Geozone ${idx + 1}`,
          name: gz.name || '',
          type: gz.type || 'Unknown',
          raw: gz,
        }
      })
  }, [denial.conflictingGeozones])

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
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {t.flightPlans.denialAuthorization}
            </p>
            <p className="text-xs text-red-700 dark:text-red-400">
              {conflictCount > 0
                ? interpolate(t.flightPlans.conflictingVolumesDetected, { n: conflictCount })
                : t.flightPlans.reviewDenialDetails}
              {geozonePolygons.length > 0 && ` — ${geozonePolygons.length} ${geozonePolygons.length !== 1 ? t.flightPlans.conflictingGeozones.toLowerCase() : t.flightPlans.conflictingGeozone.toLowerCase()}`}
            </p>
          </div>
        </div>
      </div>

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
