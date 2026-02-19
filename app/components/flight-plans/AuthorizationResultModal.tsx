'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OperationVolume {
  geometry: {
    type: string
    coordinates: number[][][]
  }
  minAltitude?: { value: number; reference?: string; uom?: string } | number
  maxAltitude?: { value: number; reference?: string; uom?: string } | number
  name?: string
  ordinal?: number
  timeBegin?: string
  timeEnd?: string
  [key: string]: unknown
}

interface ConflictingGeozone {
  identifier?: string
  id?: string | number
  name?: string
  type?: string
  info?: string
  geometry?: {
    type: string
    coordinates: number[][][] | number[][]
  }
  verticalReference?: {
    upper?: number
    upperReference?: string
    lower?: number
    lowerReference?: string
    uom?: string
  }
  [key: string]: unknown
}

interface ParsedDenial {
  volumes: { ordinal: number; status: string }[]
  conflictingIndices: Set<number>
  conflictingGeozones: ConflictingGeozone[]
  withdrawnReason?: string
}

export interface AuthorizationResultModalProps {
  isOpen: boolean
  onClose: () => void
  uplanData: { operationVolumes?: OperationVolume[]; [key: string]: unknown } | null | undefined
  status: 'aprobado' | 'denegado' | string
  reason: string | null | undefined
  geoawarenessData?: unknown
  planName: string
}

type TabId = '2d' | '3d' | 'details'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDenialMessage(authorizationMessage?: string | null): ParsedDenial {
  const empty: ParsedDenial = { volumes: [], conflictingIndices: new Set(), conflictingGeozones: [] }
  if (!authorizationMessage) return empty

  try {
    const parsed = typeof authorizationMessage === 'string'
      ? JSON.parse(authorizationMessage)
      : authorizationMessage

    if (parsed.status === 'WITHDRAWN' && parsed.message?.reason) {
      const reason = parsed.message.reason
      const volumeMatch = reason.match(/\[(\d+(?:,\s*\d+)*)\]/)
      if (volumeMatch) {
        const indices = volumeMatch[1].split(',').map((s: string) => parseInt(s.trim(), 10))
        const conflictingIndices = new Set<number>(indices)
        const volumes = indices.map((idx: number) => ({ ordinal: idx, status: 'CONFLICTING' }))
        return { volumes, conflictingIndices, conflictingGeozones: [], withdrawnReason: reason }
      }
      return { ...empty, withdrawnReason: reason }
    }

    const rawVolumes = parsed.volumes
    const conflictingIndices = new Set<number>()
    const volumes: { ordinal: number; status: string }[] = []

    if (Array.isArray(rawVolumes)) {
      for (const vol of rawVolumes) {
        if (typeof vol === 'number') {
          conflictingIndices.add(vol)
          volumes.push({ ordinal: vol, status: 'CONFLICTING' })
        } else if (typeof vol === 'object' && vol !== null) {
          const ordinal = typeof vol.ordinal === 'number' ? vol.ordinal : -1
          const status = typeof vol.status === 'string' ? vol.status : 'UNKNOWN'
          volumes.push({ ordinal, status })
          if (status.toUpperCase() === 'CONFLICTING' && ordinal >= 0) {
            conflictingIndices.add(ordinal)
          }
        }
      }
    }

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

function extractAltValue(alt: unknown): number | null {
  if (alt == null) return null
  if (typeof alt === 'number') return alt
  if (typeof alt === 'object' && alt !== null) {
    const a = alt as Record<string, unknown>
    if (typeof a.value === 'number') return a.value
  }
  return null
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

function toLeafletCoords(coordinates: number[][]): [number, number][] {
  return coordinates.map(([lon, lat]) => [lat, lon])
}

function feetToMeters(ft: number): number {
  return ft * 0.3048
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCesiumScript(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Cesium) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.resolve((window as any).Cesium)
  }

  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[href="/cesium/Widgets/widgets.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/cesium/Widgets/widgets.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = '/cesium/Cesium.js'
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).Cesium) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve((window as any).Cesium)
      } else {
        reject(new Error('Cesium failed to load'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load Cesium script'))
    document.head.appendChild(script)
  })
}

// ─── Leaflet helpers ─────────────────────────────────────────────────────────

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

// ─── 3D Viewer Sub-component ────────────────────────────────────────────────

interface Cesium3DViewProps {
  volumes: OperationVolume[]
  isApproved: boolean
  conflictingIndices: Set<number>
  geozones: {
    identifier: string
    name: string
    type: string
    info: string
    geometry: { type: string; coordinates: number[][][] | number[][] }
    verticalReference?: ConflictingGeozone['verticalReference']
  }[]
}

function Cesium3DView({ volumes, isApproved, conflictingIndices, geozones }: Cesium3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false

    const init = async () => {
      setLoading(true)
      setError(null)
      try {
        const tokenRes = await fetch('/api/cesium/token', {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        })
        if (!tokenRes.ok) throw new Error('Failed to fetch Cesium token')
        const { token } = await tokenRes.json()
        if (destroyed) return

        const Cesium = await loadCesiumScript()
        if (destroyed) return

        Cesium.Ion.defaultAccessToken = token
        ;(window as any).CESIUM_BASE_URL = '/cesium'

        const viewer = new Cesium.Viewer(containerRef.current!, {
          terrain: Cesium.Terrain.fromWorldTerrain(),
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
        })
        viewerRef.current = viewer

        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync()
          if (!destroyed) viewer.scene.primitives.add(osmBuildings)
        } catch { /* optional */ }

        if (destroyed) { viewer.destroy(); return }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allPositions: any[] = []
        const hasSpecificIndices = conflictingIndices.size > 0
        const allConflicting = !isApproved && !hasSpecificIndices

        for (let idx = 0; idx < volumes.length; idx++) {
          const vol = volumes[idx]
          const coords = vol.geometry?.coordinates?.[0]
          if (!coords || coords.length === 0) continue

          const degreesArray: number[] = []
          coords.forEach(([lon, lat]: number[]) => {
            degreesArray.push(lon, lat)
            allPositions.push(Cesium.Cartographic.fromDegrees(lon, lat))
          })

          const lowerLimit = extractAltValue(vol.minAltitude) ?? 10
          const upperLimit = extractAltValue(vol.maxAltitude) ?? 120

          let isConflicting = false
          if (!isApproved) {
            isConflicting = hasSpecificIndices
              ? conflictingIndices.has(vol.ordinal ?? idx)
              : allConflicting
          }

          let material, outlineColor: any
          if (isApproved) {
            material = Cesium.Color.fromCssColorString('rgba(34, 197, 94, 0.45)')
            outlineColor = Cesium.Color.fromCssColorString('rgba(22, 163, 74, 0.9)')
          } else if (isConflicting) {
            material = Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.55)')
            outlineColor = Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.9)')
          } else {
            material = Cesium.Color.fromCssColorString('rgba(59, 130, 246, 0.35)')
            outlineColor = Cesium.Color.fromCssColorString('rgba(59, 130, 246, 0.8)')
          }

          viewer.entities.add({
            name: vol.name || `Volume ${idx + 1}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArray),
              height: lowerLimit,
              extrudedHeight: upperLimit,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              material,
              outline: true,
              outlineColor,
              outlineWidth: 2,
            },
          })
        }

        // Add geozones (denied only)
        for (const gz of geozones) {
          const rawCoords = gz.geometry.type === 'Polygon'
            ? gz.geometry.coordinates[0] as number[][]
            : gz.geometry.coordinates as unknown as number[][]
          if (!rawCoords || rawCoords.length === 0) continue

          const degreesArray: number[] = []
          rawCoords.forEach((c: number[]) => {
            degreesArray.push(c[0], c[1])
            allPositions.push(Cesium.Cartographic.fromDegrees(c[0], c[1]))
          })

          let lowerAlt = 0
          let upperAlt = 150
          const vRef = gz.verticalReference
          if (vRef) {
            const uom = (vRef.uom || 'M').toUpperCase()
            if (typeof vRef.lower === 'number') lowerAlt = uom === 'FT' ? feetToMeters(vRef.lower) : vRef.lower
            if (typeof vRef.upper === 'number') upperAlt = uom === 'FT' ? feetToMeters(vRef.upper) : vRef.upper
          }

          viewer.entities.add({
            name: `🚫 ${gz.identifier}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArray),
              height: lowerAlt,
              extrudedHeight: upperAlt,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              material: Cesium.Color.fromCssColorString('rgba(245, 158, 11, 0.35)'),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('rgba(245, 158, 11, 0.9)'),
              outlineWidth: 2,
            },
          })
        }

        // Camera
        if (allPositions.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cartesians = allPositions.map((c: any) =>
            Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, c.height || 0)
          )
          const boundingSphere = Cesium.BoundingSphere.fromPoints(cartesians)
          boundingSphere.radius = Math.max(boundingSphere.radius * 2.5, 500)
          viewer.camera.flyToBoundingSphere(boundingSphere, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0),
          })
        }

        setLoading(false)
      } catch (err: unknown) {
        if (!destroyed) {
          setError(err instanceof Error ? err.message : 'Failed to initialize 3D viewer')
          setLoading(false)
        }
      }
    }

    init()
    return () => {
      destroyed = true
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [volumes, isApproved, conflictingIndices, geozones])

  return (
    <div className="relative w-full" style={{ minHeight: '450px' }}>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '450px' }} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-10 h-10 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-300 text-sm">Loading 3D viewer...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
      {/* Legend */}
      {!loading && !error && (
        <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 space-y-1.5">
          {isApproved ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.7)' }} />
              <span>Authorized volume</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.7)' }} />
                <span>Conflicting volume</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(59, 130, 246, 0.5)' }} />
                <span>OK volume</span>
              </div>
              {geozones.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(245, 158, 11, 0.5)' }} />
                  <span>Geozone</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

const AuthorizationResultModal: React.FC<AuthorizationResultModalProps> = ({
  isOpen,
  onClose,
  uplanData,
  status,
  reason,
  geoawarenessData,
  planName,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('2d')

  const isApproved = status === 'aprobado'
  const denial = useMemo(() => (isApproved ? null : parseDenialMessage(reason)), [isApproved, reason])

  // Build geozone geometry lookup from geoawarenessData
  const geozoneGeometryLookup = useMemo(() => {
    const lookup = new Map<string, { type: string; coordinates: number[][][] | number[][]; verticalReference?: ConflictingGeozone['verticalReference'] }>()
    if (!geoawarenessData || typeof geoawarenessData !== 'object') return lookup
    const data = geoawarenessData as { features?: Array<{ properties?: { identifier?: string; name?: string }; geometry?: { type: string; coordinates: number[][][] | number[][] }; verticalReference?: ConflictingGeozone['verticalReference'] }> }
    if (!Array.isArray(data.features)) return lookup
    for (const feature of data.features) {
      const id = feature.properties?.identifier || feature.properties?.name
      if (id && feature.geometry?.coordinates) {
        lookup.set(id, { ...feature.geometry, verticalReference: feature.verticalReference })
      }
    }
    return lookup
  }, [geoawarenessData])

  // Resolve geozones for 3D/2D view
  const resolvedGeozones = useMemo(() => {
    if (!denial) return []
    return denial.conflictingGeozones
      .map((gz, idx) => {
        const gzId = gz.identifier || gz.id?.toString() || ''
        const lookedUp = gzId ? geozoneGeometryLookup.get(gzId) : undefined
        const geometry = gz.geometry || (lookedUp ? { type: lookedUp.type, coordinates: lookedUp.coordinates } : undefined)
        const vertRef = gz.verticalReference || lookedUp?.verticalReference
        if (!geometry?.coordinates) return null
        return {
          identifier: gzId || `Geozone ${idx + 1}`,
          name: gz.name || '',
          type: gz.type || 'Unknown',
          info: gz.info || '',
          geometry,
          verticalReference: vertRef,
        }
      })
      .filter(Boolean) as {
        identifier: string; name: string; type: string; info: string
        geometry: { type: string; coordinates: number[][][] | number[][] }
        verticalReference?: ConflictingGeozone['verticalReference']
      }[]
  }, [denial, geozoneGeometryLookup])

  // 2D map data
  const operationVolumes2D = useMemo(() => {
    const vols = uplanData?.operationVolumes
    if (!vols || !Array.isArray(vols)) return []

    const hasSpecificIndices = denial ? denial.conflictingIndices.size > 0 : false

    return vols.map((vol, idx) => {
      const coords = vol.geometry?.coordinates?.[0]
      if (!coords || !Array.isArray(coords)) return null
      const leafletCoords = toLeafletCoords(coords)

      let isConflicting = false
      if (!isApproved && denial) {
        isConflicting = hasSpecificIndices
          ? denial.conflictingIndices.has(vol.ordinal ?? idx)
          : true // all conflicting fallback
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
      coords: [number, number][]; idx: number; ordinal: number; label: string
      isConflicting: boolean; timeBegin?: string; timeEnd?: string; minAlt: string; maxAlt: string
    }[]
  }, [uplanData, isApproved, denial])

  const geozonePolygons2D = useMemo(() => {
    return resolvedGeozones.map((gz) => {
      const rawCoords = gz.geometry.type === 'Polygon'
        ? gz.geometry.coordinates[0] as number[][]
        : gz.geometry.coordinates as unknown as number[][]
      const leafletCoords = toLeafletCoords(rawCoords)
      return { coords: leafletCoords, identifier: gz.identifier, name: gz.name, type: gz.type, info: gz.info }
    })
  }, [resolvedGeozones])

  const allCoords2D = useMemo(() => {
    const coords: [number, number][] = []
    for (const vol of operationVolumes2D) coords.push(...vol.coords)
    for (const gz of geozonePolygons2D) coords.push(...gz.coords)
    return coords
  }, [operationVolumes2D, geozonePolygons2D])

  const center2D: [number, number] = allCoords2D.length > 0
    ? [
        allCoords2D.reduce((s, c) => s + c[0], 0) / allCoords2D.length,
        allCoords2D.reduce((s, c) => s + c[1], 0) / allCoords2D.length,
      ]
    : [39.47, -0.38]

  // Parse details from reason
  const parsedDetails = useMemo(() => {
    if (!reason) return null
    try {
      const parsed = typeof reason === 'string' ? JSON.parse(reason) : reason
      return parsed
    } catch {
      return null
    }
  }, [reason])

  const conflictingVolumeIndices = useMemo(() => {
    if (!parsedDetails) return null
    // Try different FAS formats
    if (parsedDetails.status === 'WITHDRAWN' && parsedDetails.message?.reason) {
      const match = parsedDetails.message.reason.match(/\[(\d+(?:,\s*\d+)*)\]/)
      if (match) return match[1].split(',').map((s: string) => parseInt(s.trim(), 10))
    }
    if (Array.isArray(parsedDetails.volumes)) {
      return parsedDetails.volumes.map((v: number | { ordinal?: number }) =>
        typeof v === 'number' ? v : v.ordinal ?? -1
      ).filter((n: number) => n >= 0)
    }
    return null
  }, [parsedDetails])

  const geozonesDetail = useMemo(() => {
    if (!parsedDetails) return null
    const info = parsedDetails.geozones_information || parsedDetails.geozonesInformation
    if (!info) return null
    const conflicting = info.conflicting_geozones || info.conflictingGeozones
    if (!Array.isArray(conflicting)) return null
    return {
      count: info.number_conflicting_geozones ?? conflicting.length,
      geozones: conflicting as Array<{ id?: string; identifier?: string; type?: string; info?: string }>,
    }
  }, [parsedDetails])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) setActiveTab('2d')
  }, [isOpen])

  if (!isOpen) return null

  const hasVolumes = operationVolumes2D.length > 0
  const conflictCount = operationVolumes2D.filter(v => v.isConflicting).length
  const totalVolumes = operationVolumes2D.length

  const tabs: { id: TabId; label: string }[] = [
    { id: '2d', label: '2D Map' },
    { id: '3d', label: '3D Map' },
    { id: 'details', label: 'Details' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--surface-primary)] dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isApproved
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            {isApproved ? (
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016A11.955 11.955 0 0112 2.944zm3.707 7.763a1 1 0 00-1.414-1.414L11 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <div>
              <h2 className={`text-lg font-semibold ${
                isApproved ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {planName}
              </h2>
              <span className={`text-sm font-medium ${
                isApproved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isApproved ? 'APPROVED' : 'DENIED'}
                {!isApproved && conflictCount > 0 && ` — ${conflictCount} of ${totalVolumes} volumes conflicting`}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-[var(--border-primary)] dark:border-gray-700 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--surface-tertiary)] dark:bg-gray-700 text-[var(--text-primary)] dark:text-white border-b-2 border-blue-500'
                  : 'text-[var(--text-secondary)] dark:text-gray-400 hover:bg-[var(--bg-hover)] dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {/* 2D Map Tab */}
          {activeTab === '2d' && (
            <div className="p-4">
              {hasVolumes ? (
                <div className="w-full h-[50vh] md:h-[450px] max-h-[60vh] min-h-[200px] relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <MapContainer
                    center={center2D}
                    zoom={14}
                    scrollWheelZoom={true}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <FitBoundsHandler allCoords={allCoords2D} />
                    <MapResizeHandler />
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />
                    {operationVolumes2D.map(vol => {
                      let color: string, fillColor: string, fillOpacity: number, weight: number
                      if (isApproved) {
                        color = '#16a34a'; fillColor = '#22c55e'; fillOpacity = 0.35; weight = 2
                      } else if (vol.isConflicting) {
                        color = '#dc2626'; fillColor = '#ef4444'; fillOpacity = 0.4; weight = 3
                      } else {
                        color = '#3b82f6'; fillColor = '#60a5fa'; fillOpacity = 0.2; weight = 1.5
                      }
                      return (
                        <Polygon
                          key={`vol-${vol.idx}`}
                          positions={vol.coords}
                          pathOptions={{ color, fillColor, fillOpacity, weight }}
                        >
                          <Tooltip direction="top" offset={[0, -10]} sticky>
                            <div className="text-xs min-w-[140px]">
                              <div className={`font-semibold mb-1 ${
                                isApproved ? 'text-green-600' : vol.isConflicting ? 'text-red-600' : 'text-blue-600'
                              }`}>
                                {vol.label} {isApproved ? '✓ Authorized' : vol.isConflicting ? '⚠ Conflicting' : '✓ OK'}
                              </div>
                              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                <span className="text-gray-500">Ordinal:</span>
                                <span>{vol.ordinal}</span>
                                {vol.timeBegin && (
                                  <>
                                    <span className="text-gray-500">Start:</span>
                                    <span>{new Date(vol.timeBegin).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                                  </>
                                )}
                                {vol.timeEnd && (
                                  <>
                                    <span className="text-gray-500">End:</span>
                                    <span>{new Date(vol.timeEnd).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                                  </>
                                )}
                                <span className="text-gray-500">Alt:</span>
                                <span>{vol.minAlt} — {vol.maxAlt}</span>
                              </div>
                            </div>
                          </Tooltip>
                        </Polygon>
                      )
                    })}
                    {geozonePolygons2D.map((gz, idx) => (
                      <Polygon
                        key={`gz-${idx}`}
                        positions={gz.coords}
                        pathOptions={{ color: '#b91c1c', fillColor: '#f87171', fillOpacity: 0.3, weight: 2, dashArray: '8 4' }}
                      >
                        <Tooltip direction="top" offset={[0, -10]} sticky>
                          <div className="text-xs min-w-[140px]">
                            <div className="font-semibold text-red-700 mb-1">🚫 {gz.identifier}</div>
                            {gz.name && <div className="text-gray-600 mb-1">{gz.name}</div>}
                            <span className="text-gray-500">Type:</span> {gz.type}
                          </div>
                        </Tooltip>
                      </Polygon>
                    ))}
                  </MapContainer>
                </div>
              ) : (
                <div className="w-full h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-[var(--text-secondary)]">No spatial data available for this plan.</p>
                </div>
              )}

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm">
                {isApproved ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded bg-green-500/50 border-2 border-green-600" />
                    <span className="text-[var(--text-secondary)]">Authorized volume</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded bg-red-500/50 border-2 border-red-600" />
                      <span className="text-[var(--text-secondary)]">Conflicting volume</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded bg-blue-400/30 border border-blue-500" />
                      <span className="text-[var(--text-secondary)]">OK volume</span>
                    </div>
                    {geozonePolygons2D.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded bg-red-400/40 border-2 border-red-700" style={{ borderStyle: 'dashed' }} />
                        <span className="text-[var(--text-secondary)]">Geozone</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3D Map Tab */}
          {activeTab === '3d' && (
            <div className="bg-gray-900">
              <Cesium3DView
                volumes={uplanData?.operationVolumes || []}
                isApproved={isApproved}
                conflictingIndices={denial?.conflictingIndices ?? new Set()}
                geozones={resolvedGeozones}
              />
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="p-6 space-y-4">
              {/* Status summary */}
              <div className={`p-4 rounded-lg border ${
                isApproved
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-semibold ${
                    isApproved ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                  }`}>
                    Status: {isApproved ? 'Approved' : 'Denied'}
                  </span>
                </div>
                {isApproved ? (
                  <p className="text-sm text-green-700 dark:text-green-400">
                    All {totalVolumes} operation volume{totalVolumes !== 1 ? 's' : ''} authorized.
                  </p>
                ) : (
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {conflictCount > 0
                      ? `${conflictCount} of ${totalVolumes} volume${totalVolumes !== 1 ? 's' : ''} conflicting.`
                      : `${totalVolumes} volume${totalVolumes !== 1 ? 's' : ''} denied.`}
                  </p>
                )}
              </div>

              {/* Conflicting volumes */}
              {!isApproved && conflictingVolumeIndices && conflictingVolumeIndices.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Conflicting Volumes</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Volumes: {conflictingVolumeIndices.join(', ')}
                  </p>
                </div>
              )}

              {/* WITHDRAWN reason */}
              {denial?.withdrawnReason && (
                <div className="p-4 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">FAS Reason</h4>
                  <p className="text-sm text-red-700 dark:text-red-400">{denial.withdrawnReason}</p>
                </div>
              )}

              {/* Geozone conflicts */}
              {geozonesDetail && geozonesDetail.geozones.length > 0 && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">
                    Conflicting Geozones ({geozonesDetail.count})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {geozonesDetail.geozones.map((gz, idx) => (
                      <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-orange-800 dark:text-orange-300">
                            {gz.id || gz.identifier || `Geozone ${idx + 1}`}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-medium">
                            {gz.type || 'Unknown'}
                          </span>
                        </div>
                        {gz.info && <p className="text-xs text-[var(--text-secondary)]">{gz.info}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No geozones info for approved */}
              {isApproved && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Geozone Conflicts</h4>
                  <p className="text-sm text-[var(--text-secondary)]">No conflicting geozones.</p>
                </div>
              )}

              {/* Raw FAS response */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Raw FAS Response</h4>
                <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-tertiary)] dark:bg-gray-900 p-3 rounded-lg border border-[var(--border-primary)] dark:border-gray-700 max-h-48 overflow-y-auto">
                  {reason
                    ? typeof reason === 'string' ? reason : JSON.stringify(reason, null, 2)
                    : 'No FAS response available.'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-primary)] dark:border-gray-700 text-xs text-[var(--text-muted)] dark:text-gray-400 flex items-center justify-between">
          <span>
            {totalVolumes > 0
              ? `${totalVolumes} operation volume${totalVolumes !== 1 ? 's' : ''}`
              : 'No operation volumes'}
            {resolvedGeozones.length > 0 && ` · ${resolvedGeozones.length} geozone${resolvedGeozones.length !== 1 ? 's' : ''}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] dark:text-gray-300 bg-[var(--bg-tertiary)] dark:bg-gray-700 rounded-md hover:bg-[var(--bg-hover)] dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthorizationResultModal
