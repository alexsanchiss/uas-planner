'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'

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

export interface Denial3DModalProps {
  isOpen: boolean
  onClose: () => void
  uplan: { operationVolumes?: OperationVolume[]; [key: string]: unknown } | null | undefined
  authorizationMessage?: string | null
  geoawarenessData?: unknown
}

/** Load Cesium from the pre-built UMD bundle via script tag */
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
      if ((window as any).Cesium) {
        resolve((window as any).Cesium)
      } else {
        reject(new Error('Cesium failed to load'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load Cesium script'))
    document.head.appendChild(script)
  })
}

function parseDenialMessage(authorizationMessage?: string | null): ParsedDenial {
  const empty: ParsedDenial = { volumes: [], conflictingIndices: new Set(), conflictingGeozones: [] }
  if (!authorizationMessage) return empty

  try {
    const parsed = typeof authorizationMessage === 'string'
      ? JSON.parse(authorizationMessage)
      : authorizationMessage

    // Handle WITHDRAWN format
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

/** Convert feet to meters */
function feetToMeters(ft: number): number {
  return ft * 0.3048
}

const Denial3DModal: React.FC<Denial3DModalProps> = ({ isOpen, onClose, uplan, authorizationMessage, geoawarenessData }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const denial = useMemo(() => parseDenialMessage(authorizationMessage), [authorizationMessage])

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

  // Determine which operation volumes are conflicting
  const volumeClassification = useMemo(() => {
    const volumes = uplan?.operationVolumes
    if (!volumes) return []

    const hasSpecificIndices = denial.conflictingIndices.size > 0
    // If no specific indices were identified, assume all are conflicting
    const allConflicting = !hasSpecificIndices

    return volumes.map((vol, idx) => {
      const isConflicting = hasSpecificIndices
        ? denial.conflictingIndices.has(vol.ordinal ?? idx)
        : allConflicting
      return { volume: vol, idx, isConflicting }
    })
  }, [uplan, denial.conflictingIndices])

  // Resolve geozone polygons with geometry from FAS response or geoawarenessData
  const resolvedGeozones = useMemo(() => {
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
        identifier: string
        name: string
        type: string
        info: string
        geometry: { type: string; coordinates: number[][][] | number[][] }
        verticalReference?: ConflictingGeozone['verticalReference']
      }[]
  }, [denial.conflictingGeozones, geozoneGeometryLookup])

  // Summary stats
  const conflictCount = volumeClassification.filter(v => v.isConflicting).length
  const totalVolumes = volumeClassification.length

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    let destroyed = false

    const init = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1. Fetch Cesium Ion token
        const tokenRes = await fetch('/api/cesium/token', {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        })
        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to fetch Cesium token')
        }
        const { token } = await tokenRes.json()

        if (destroyed) return

        // 2. Load Cesium
        const Cesium = await loadCesiumScript()

        if (destroyed) return

        // 3. Configure Cesium
        Cesium.Ion.defaultAccessToken = token
        ;(window as any).CESIUM_BASE_URL = '/cesium'

        // 4. Create viewer
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
          selectionIndicator: true,
          infoBox: true,
        })

        viewerRef.current = viewer

        // Force InfoBox to use dark, readable styling regardless of app theme
        try {
          const infoBoxFrame = viewer.infoBox?.frame
          if (infoBoxFrame) {
            infoBoxFrame.addEventListener('load', () => {
              const frameDoc = infoBoxFrame.contentDocument || infoBoxFrame.contentWindow?.document
              if (frameDoc) {
                const style = frameDoc.createElement('style')
                style.textContent = `
                  html, body { background: transparent !important; }
                  .cesium-infoBox { background: rgba(38, 38, 38, 0.95) !important; color: #e0e0e0 !important; }
                  .cesium-infoBox-title { color: #ffffff !important; background: rgba(30, 30, 30, 0.9) !important; }
                  .cesium-infoBox-description { color: #e0e0e0 !important; }
                  .cesium-infoBox-description * { color: #e0e0e0 !important; }
                  table { color: #e0e0e0 !important; width: 100%; }
                  td, th { color: #e0e0e0 !important; border-color: #555 !important; padding: 4px 8px; }
                  a { color: #6cb4ee !important; }
                `
                frameDoc.head.appendChild(style)
              }
            })
          }
        } catch (e) {
          console.warn('Could not style Cesium InfoBox:', e)
        }

        // 5. Add OSM buildings (optional)
        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync()
          if (!destroyed) viewer.scene.primitives.add(osmBuildings)
        } catch { /* optional */ }

        if (destroyed) {
          viewer.destroy()
          return
        }

        const allPositions: any[] = []

        // 6. Add operation volumes
        for (const { volume: vol, idx, isConflicting } of volumeClassification) {
          const coords = vol.geometry?.coordinates?.[0]
          if (!coords || coords.length === 0) continue

          const degreesArray: number[] = []
          coords.forEach(([lon, lat]: number[]) => {
            degreesArray.push(lon, lat)
            allPositions.push(Cesium.Cartographic.fromDegrees(lon, lat))
          })

          const lowerLimit = extractAltValue(vol.minAltitude) ?? 10
          const upperLimit = extractAltValue(vol.maxAltitude) ?? 120

          const material = isConflicting
            ? Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.55)')
            : Cesium.Color.fromCssColorString('rgba(160, 160, 160, 0.15)')
          const outlineColor = isConflicting
            ? Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.9)')
            : Cesium.Color.fromCssColorString('rgba(160, 160, 160, 0.4)')

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
            description: [
              '<table style="width:100%">',
              `<tr><td><b>Volume</b></td><td>${vol.name || `Volume ${idx + 1}`}</td></tr>`,
              `<tr><td><b>Status</b></td><td style="color:${isConflicting ? '#dc2626' : '#6b7280'}">${isConflicting ? 'CONFLICTING' : 'OK'}</td></tr>`,
              `<tr><td><b>Min Alt</b></td><td>${lowerLimit} m AGL</td></tr>`,
              `<tr><td><b>Max Alt</b></td><td>${upperLimit} m AGL</td></tr>`,
              vol.timeBegin ? `<tr><td><b>Start</b></td><td>${vol.timeBegin}</td></tr>` : '',
              vol.timeEnd ? `<tr><td><b>End</b></td><td>${vol.timeEnd}</td></tr>` : '',
              '</table>',
            ].join(''),
          })
        }

        // 7. Add geozone volumes
        for (const gz of resolvedGeozones) {
          const rawCoords = gz.geometry.type === 'Polygon'
            ? gz.geometry.coordinates[0] as number[][]
            : gz.geometry.coordinates as unknown as number[][]
          if (!rawCoords || rawCoords.length === 0) continue

          const degreesArray: number[] = []
          rawCoords.forEach((c: number[]) => {
            degreesArray.push(c[0], c[1])
            allPositions.push(Cesium.Cartographic.fromDegrees(c[0], c[1]))
          })

          // Parse geozone altitudes
          let lowerAlt = 0
          let upperAlt = 150
          const vRef = gz.verticalReference
          if (vRef) {
            const uom = (vRef.uom || 'M').toUpperCase()
            if (typeof vRef.lower === 'number') {
              lowerAlt = uom === 'FT' ? feetToMeters(vRef.lower) : vRef.lower
            }
            if (typeof vRef.upper === 'number') {
              upperAlt = uom === 'FT' ? feetToMeters(vRef.upper) : vRef.upper
            }
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
            description: [
              '<table style="width:100%">',
              `<tr><td><b>Geozone</b></td><td>${gz.identifier}</td></tr>`,
              gz.name ? `<tr><td><b>Name</b></td><td>${gz.name}</td></tr>` : '',
              `<tr><td><b>Type</b></td><td>${gz.type}</td></tr>`,
              `<tr><td><b>Lower</b></td><td>${lowerAlt.toFixed(0)} m AGL</td></tr>`,
              `<tr><td><b>Upper</b></td><td>${upperAlt.toFixed(0)} m AGL</td></tr>`,
              gz.info ? `<tr><td><b>Info</b></td><td>${gz.info}</td></tr>` : '',
              '</table>',
            ].join(''),
          })
        }

        // 8. Camera - fly to all entities
        if (allPositions.length > 0) {
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
      } catch (err: any) {
        if (!destroyed) {
          setError(err.message || 'Failed to initialize 3D viewer')
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
  }, [isOpen, volumeClassification, resolvedGeozones])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            3D Denial Viewer
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Denial info panel */}
        <div className="px-6 py-3 border-b border-gray-700 bg-red-900/20">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-400 font-semibold">Authorization Denied</span>
            <span className="text-gray-400">—</span>
            <span className="text-gray-300">
              {conflictCount > 0
                ? `${conflictCount} of ${totalVolumes} volume${totalVolumes !== 1 ? 's' : ''} conflicting`
                : `${totalVolumes} volume${totalVolumes !== 1 ? 's' : ''}`}
              {resolvedGeozones.length > 0 && ` · ${resolvedGeozones.length} geozone${resolvedGeozones.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {denial.withdrawnReason && (
            <p className="text-xs text-red-300 mt-1">{denial.withdrawnReason}</p>
          )}
        </div>

        {/* Cesium container */}
        <div className="flex-1 relative" style={{ minHeight: '500px' }}>
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: '500px' }} />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-10 h-10 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-300 text-sm">Loading 3D denial viewer...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-300 text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-2 px-4 py-2 text-sm bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Legend overlay */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(220, 38, 38, 0.7)' }}></div>
                <span>Conflicting volume</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(160, 160, 160, 0.3)' }}></div>
                <span>OK volume</span>
              </div>
              {resolvedGeozones.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(245, 158, 11, 0.5)' }}></div>
                  <span>Geozone</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
          <span>
            {totalVolumes > 0
              ? `${totalVolumes} operation volume${totalVolumes !== 1 ? 's' : ''} · ${conflictCount} conflicting`
              : 'No operation volumes'}
            {resolvedGeozones.length > 0 && ` · ${resolvedGeozones.length} geozone${resolvedGeozones.length !== 1 ? 's' : ''}`}
          </span>
          <span>Powered by CesiumJS</span>
        </div>
      </div>
    </div>
  )
}

export default Denial3DModal
