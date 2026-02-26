'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'

interface OperationVolume {
  geometry: {
    type: string
    coordinates: number[][][]
  }
  minAltitude?: { value: number; reference?: string; uom?: string }
  maxAltitude?: { value: number; reference?: string; uom?: string }
  name?: string
  ordinal?: number
  timeBegin?: string
  timeEnd?: string
}

interface Cesium3DModalProps {
  isOpen: boolean
  onClose: () => void
  uplanData: {
    operationVolumes?: OperationVolume[]
  } | null
}

/** Parsed time range for a volume */
interface VolumeTimeRange {
  index: number
  beginMs: number
  endMs: number
}

function formatDateTime(ms: number): string {
  const date = new Date(ms)
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

/** Load Cesium from the pre-built UMD bundle via script tag */
function loadCesiumScript(): Promise<any> {
  if ((window as any).Cesium) {
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

const SPEED_OPTIONS = [1, 2, 5, 10] as const

const Cesium3DModal: React.FC<Cesium3DModalProps> = ({ isOpen, onClose, uplanData }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const entitiesRef = useRef<any[]>([])
  const cesiumRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 4D time slider state
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const lastFrameRef = useRef<number>(0)
  const animFrameRef = useRef<number>(0)

  // Parse volume time ranges
  const volumeTimeRanges = useMemo<VolumeTimeRange[]>(() => {
    const volumes = uplanData?.operationVolumes
    if (!volumes) return []
    const ranges: VolumeTimeRange[] = []
    volumes.forEach((vol, idx) => {
      if (vol.timeBegin && vol.timeEnd) {
        const beginMs = new Date(vol.timeBegin).getTime()
        const endMs = new Date(vol.timeEnd).getTime()
        if (!isNaN(beginMs) && !isNaN(endMs)) {
          ranges.push({ index: idx, beginMs, endMs })
        }
      }
    })
    return ranges
  }, [uplanData])

  const hasTimeData = volumeTimeRanges.length > 0
  const globalStartMs = hasTimeData ? Math.min(...volumeTimeRanges.map(r => r.beginMs)) : 0
  const globalEndMs = hasTimeData ? Math.max(...volumeTimeRanges.map(r => r.endMs)) : 0

  // Initialize currentTimeMs to globalStartMs when time data changes
  useEffect(() => {
    if (hasTimeData) setCurrentTimeMs(globalStartMs)
  }, [hasTimeData, globalStartMs])

  // Update entity colors based on current time
  const updateVolumeColors = useCallback((timeMs: number) => {
    const Cesium = cesiumRef.current
    const entities = entitiesRef.current
    if (!Cesium || entities.length === 0) return

    entities.forEach(({ entity, beginMs, endMs }) => {
      const isActive = timeMs >= beginMs && timeMs <= endMs
      if (entity.polygon) {
        entity.polygon.material = isActive
          ? Cesium.Color.fromCssColorString('rgba(51, 148, 255, 0.65)')
          : Cesium.Color.fromCssColorString('rgba(160, 160, 160, 0.25)')
        entity.polygon.outlineColor = isActive
          ? Cesium.Color.fromCssColorString('rgba(51, 148, 255, 0.9)')
          : Cesium.Color.fromCssColorString('rgba(160, 160, 160, 0.45)')
      }
    })
  }, [])

  // Play animation loop — use ref to read latest time for direct entity updates
  const currentTimeMsRef = useRef(currentTimeMs)
  currentTimeMsRef.current = currentTimeMs

  useEffect(() => {
    if (!playing || !hasTimeData) return

    lastFrameRef.current = performance.now()

    const tick = (now: number) => {
      const deltaMs = (now - lastFrameRef.current) * speed
      lastFrameRef.current = now

      const next = currentTimeMsRef.current + deltaMs
      if (next >= globalEndMs) {
        setPlaying(false)
        setCurrentTimeMs(globalEndMs)
        updateVolumeColors(globalEndMs)
      } else {
        setCurrentTimeMs(next)
        updateVolumeColors(next)
      }

      if (next < globalEndMs) {
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [playing, speed, hasTimeData, globalEndMs, updateVolumeColors])

  // Sync entity colors when currentTimeMs changes (both slider and play animation)
  useEffect(() => {
    if (hasTimeData) updateVolumeColors(currentTimeMs)
  }, [currentTimeMs, hasTimeData, updateVolumeColors])

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    let destroyed = false

    const init = async () => {
      setLoading(true)
      setError(null)
      entitiesRef.current = []

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

        // 2. Load Cesium from pre-built bundle
        const Cesium = await loadCesiumScript()
        cesiumRef.current = Cesium

        if (destroyed) return

        // 3. Set access token and base URL
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

        // 5. Add OSM buildings
        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync()
          if (!destroyed) {
            viewer.scene.primitives.add(osmBuildings)
          }
        } catch {
          // OSM Buildings is optional
        }

        if (destroyed) {
          viewer.destroy()
          return
        }

        // 6. Add operation volumes as extruded polygons
        const volumes = uplanData?.operationVolumes
        if (volumes && volumes.length > 0) {
          const allPositions: any[] = []
          const trackedEntities: any[] = []

          volumes.forEach((vol, idx) => {
            const coords = vol.geometry?.coordinates?.[0]
            if (!coords || coords.length === 0) return

            // GeoJSON coordinates are [lon, lat]
            const degreesArray: number[] = []
            coords.forEach(([lon, lat]) => {
              degreesArray.push(lon, lat)
              allPositions.push(Cesium.Cartographic.fromDegrees(lon, lat))
            })

            const lowerLimit = vol.minAltitude?.value ?? 10
            const upperLimit = vol.maxAltitude?.value ?? 120

            const material = Cesium.Color.fromCssColorString('rgba(51, 128, 255, 0.35)')
            const outlineColor = Cesium.Color.fromCssColorString('rgba(51, 128, 255, 0.8)')

            const entity = viewer.entities.add({
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
                `<tr><td><b>Min Alt</b></td><td>${lowerLimit} m AGL</td></tr>`,
                `<tr><td><b>Max Alt</b></td><td>${upperLimit} m AGL</td></tr>`,
                vol.timeBegin ? `<tr><td><b>Start</b></td><td>${vol.timeBegin}</td></tr>` : '',
                vol.timeEnd ? `<tr><td><b>End</b></td><td>${vol.timeEnd}</td></tr>` : '',
                '</table>',
              ].join(''),
            })

            // Track entity with its time range for 4D coloring
            const beginMs = vol.timeBegin ? new Date(vol.timeBegin).getTime() : NaN
            const endMs = vol.timeEnd ? new Date(vol.timeEnd).getTime() : NaN
            if (!isNaN(beginMs) && !isNaN(endMs)) {
              trackedEntities.push({ entity, beginMs, endMs })
            }
          })

          entitiesRef.current = trackedEntities

          // 7. Camera - fly to all volumes
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
      cancelAnimationFrame(animFrameRef.current)
      setPlaying(false)
      entitiesRef.current = []
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [isOpen, uplanData])

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
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            3D U-Plan Viewer
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

        {/* Cesium container */}
        <div className="flex-1 relative" style={{ minHeight: '500px' }}>
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: '500px' }} />

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
        </div>

        {/* 4D Time Slider Controls */}
        {hasTimeData && !loading && !error && (
          <div className="px-6 py-3 border-t border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              {/* Play/Pause */}
              <button
                onClick={() => {
                  if (currentTimeMs >= globalEndMs) setCurrentTimeMs(globalStartMs)
                  setPlaying(p => !p)
                }}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Time slider */}
              <input
                type="range"
                min={globalStartMs}
                max={globalEndMs}
                value={currentTimeMs}
                onChange={e => {
                  setPlaying(false)
                  setCurrentTimeMs(Number(e.target.value))
                }}
                className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
                step={1000}
              />

              {/* Speed control */}
              <select
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="flex-shrink-0 bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                {SPEED_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}x</option>
                ))}
              </select>
            </div>

            {/* Current time display */}
            <div className="text-center text-xs text-gray-300 font-mono">
              {formatDateTime(currentTimeMs)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
          <span>
            {uplanData?.operationVolumes?.length
              ? `${uplanData.operationVolumes.length} operation volume${uplanData.operationVolumes.length > 1 ? 's' : ''}`
              : 'No operation volumes'}
          </span>
          <span>Powered by CesiumJS</span>
        </div>
      </div>
    </div>
  )
}

export default Cesium3DModal
