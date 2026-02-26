'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'

interface Trajectory3DViewerProps {
  isOpen: boolean
  onClose: () => void
  planId: string
  planName?: string
}

interface TrajectoryPoint {
  lat: number
  lng: number
  alt: number
  time: number
}

const SPEED_OPTIONS = [1, 2, 5, 10] as const

/* eslint-disable @typescript-eslint/no-explicit-any */
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

/** Parse CSV content to trajectory points. Times normalised to start at 0. */
function parseCSVToTrajectory(csvContent: string): TrajectoryPoint[] {
  if (!csvContent || csvContent.trim().length === 0) return []

  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const latIdx = header.findIndex(h => h.includes('lat'))
  const lngIdx = header.findIndex(h => h.includes('lon') || h.includes('lng'))
  const altIdx = header.findIndex(h => h.includes('alt'))
  const timeIdx = header.findIndex(h => h.includes('time'))

  if (latIdx === -1 || lngIdx === -1) return []

  const rawPoints: { lat: number; lng: number; alt: number; time: number }[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const lat = parseFloat(values[latIdx])
    const lng = parseFloat(values[lngIdx])
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

    const alt = altIdx !== -1 ? (parseFloat(values[altIdx]) || 0) : 0
    const time = timeIdx !== -1 ? (parseFloat(values[timeIdx]) || 0) : i
    rawPoints.push({ lat, lng, alt, time })
  }

  if (rawPoints.length === 0) return []

  // Normalise times to start at 0
  const firstTime = rawPoints[0].time
  return rawPoints.map(p => ({ ...p, time: p.time - firstTime }))
}

/** Format seconds to mm:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/** Interpolate position between two trajectory points at a given time */
function interpolatePosition(
  points: TrajectoryPoint[],
  currentTime: number,
): { lat: number; lng: number; alt: number } | null {
  if (points.length === 0) return null
  if (currentTime <= points[0].time) return points[0]
  if (currentTime >= points[points.length - 1].time) return points[points.length - 1]

  // Find the segment
  for (let i = 0; i < points.length - 1; i++) {
    if (currentTime >= points[i].time && currentTime <= points[i + 1].time) {
      const t = (currentTime - points[i].time) / (points[i + 1].time - points[i].time)
      return {
        lat: points[i].lat + t * (points[i + 1].lat - points[i].lat),
        lng: points[i].lng + t * (points[i + 1].lng - points[i].lng),
        alt: points[i].alt + t * (points[i + 1].alt - points[i].alt),
      }
    }
  }

  return points[points.length - 1]
}

const Trajectory3DViewer: React.FC<Trajectory3DViewerProps> = ({
  isOpen,
  onClose,
  planId,
  planName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const cesiumRef = useRef<any>(null)
  const droneEntityRef = useRef<any>(null)
  const currentTimeRef = useRef<number>(0)
  const pointsRef = useRef<TrajectoryPoint[]>([])
  const followDroneRef = useRef<boolean>(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<TrajectoryPoint[]>([])
  const [csvContent, setCsvContent] = useState<string>('')

  // Animation state
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [followDrone, setFollowDrone] = useState(false)
  const lastFrameRef = useRef<number>(0)
  const animFrameRef = useRef<number>(0)

  const endTime = useMemo(
    () => (points.length > 0 ? points[points.length - 1].time : 0),
    [points],
  )

  // Keep refs in sync with state for use inside RAF tick
  useEffect(() => { pointsRef.current = points }, [points])
  useEffect(() => { followDroneRef.current = followDrone }, [followDrone])

  // Play animation loop — directly updates drone via refs to bypass React batching
  useEffect(() => {
    if (!playing || endTime === 0) return

    lastFrameRef.current = performance.now()

    const tick = (now: number) => {
      if (viewerRef.current?.isDestroyed()) return

      const deltaSec = ((now - lastFrameRef.current) / 1000) * speed
      lastFrameRef.current = now

      const prev = currentTimeRef.current
      let next = prev + deltaSec
      let finished = false

      if (next >= endTime) {
        next = endTime
        finished = true
      }

      currentTimeRef.current = next
      setCurrentTime(next)

      // Directly update drone entity position (bypasses React state batching)
      const Cesium = cesiumRef.current
      const drone = droneEntityRef.current
      const pts = pointsRef.current
      if (Cesium && drone && pts.length > 0) {
        const pos = interpolatePosition(pts, next)
        if (pos) {
          drone.position = Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt)

          if (followDroneRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
            viewerRef.current.camera.lookAt(
              Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt),
              new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), 200),
            )
          }
        }
      }

      if (finished) {
        setPlaying(false)
      } else {
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [playing, speed, endTime])

  // Update drone entity position when slider changes (play mode updates in tick)
  useEffect(() => {
    if (playing) return
    const Cesium = cesiumRef.current
    const drone = droneEntityRef.current
    if (!Cesium || !drone || points.length === 0) return

    const pos = interpolatePosition(points, currentTime)
    if (!pos) return

    drone.position = Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt)

    if (followDrone && viewerRef.current) {
      viewerRef.current.camera.lookAt(
        Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt),
        new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), 200),
      )
    }
  }, [currentTime, points, followDrone, playing])

  // Unlock camera when follow mode is turned off
  useEffect(() => {
    if (!followDrone && viewerRef.current && cesiumRef.current) {
      try {
        viewerRef.current.camera.lookAtTransform(cesiumRef.current.Matrix4.IDENTITY)
      } catch {
        // ignore if camera is already unlocked
      }
    }
  }, [followDrone])

  // Main initialisation: load Cesium, fetch CSV, build scene
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    let destroyed = false

    const init = async () => {
      setLoading(true)
      setError(null)
      setPoints([])
      setCsvContent('')
      setCurrentTime(0)
      currentTimeRef.current = 0
      setPlaying(false)

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

        // 2. Fetch trajectory CSV
        const headers: Record<string, string> = {}
        const authToken = localStorage.getItem('authToken')
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        // Get plan to find csvResult flag
        const planRes = await fetch(`/api/flightPlans/${planId}`, { headers })
        if (!planRes.ok) throw new Error('Failed to load flight plan')
        const plan = await planRes.json()
        if (!plan.csvResult) throw new Error('No trajectory data available for this plan')

        // Fetch CSV content
        const csvRes = await fetch(`/api/csvResult?id=${plan.id}`, { headers })
        if (!csvRes.ok) throw new Error('Failed to load trajectory CSV')
        const data = await csvRes.json()
        const csvContentStr = data.csvResult || data.content || data.csvContent || ''
        setCsvContent(csvContentStr)

        const parsedPoints = parseCSVToTrajectory(csvContentStr)
        if (parsedPoints.length === 0) throw new Error('No valid trajectory points found in CSV')
        if (destroyed) return

        setPoints(parsedPoints)

        // 3. Load Cesium
        const Cesium = await loadCesiumScript()
        cesiumRef.current = Cesium
        if (destroyed) return

        // 4. Configure Cesium
        Cesium.Ion.defaultAccessToken = token
        ;(window as any).CESIUM_BASE_URL = '/cesium'

        // 5. Create viewer
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
        if (destroyed) { viewer.destroy(); return }

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

        // 6. Add OSM buildings
        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync()
          if (!destroyed) viewer.scene.primitives.add(osmBuildings)
        } catch {
          // optional
        }
        if (destroyed) { viewer.destroy(); return }

        // 7. Sample terrain heights for AGL-to-absolute altitude conversion (polyline)
        let terrainHeights: number[] = new Array(parsedPoints.length).fill(0)
        try {
          const terrainProvider = viewer.scene.globe.terrainProvider
          if (terrainProvider.readyPromise) {
            await terrainProvider.readyPromise
          }
          const cartographics = parsedPoints.map((p: TrajectoryPoint) =>
            Cesium.Cartographic.fromDegrees(p.lng, p.lat),
          )
          const sampled = await Cesium.sampleTerrainMostDetailed(terrainProvider, cartographics)
          terrainHeights = sampled.map((c: any) => c.height || 0)
        } catch {
          // Terrain sampling failed — polyline uses raw AGL alts (may mismatch markers)
        }
        if (destroyed) { viewer.destroy(); return }

        // 8. Build trajectory polyline with terrain-corrected absolute altitudes
        const cartesianPositions = parsedPoints.map((p, i) =>
          Cesium.Cartesian3.fromDegrees(p.lng, p.lat, terrainHeights[i] + p.alt),
        )

        // Trajectory polyline entity
        viewer.entities.add({
          name: 'Trajectory Path',
          polyline: {
            positions: cartesianPositions,
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.15,
              color: Cesium.Color.DODGERBLUE.withAlpha(0.7),
            }),
            clampToGround: false,
          },
        })

        // 8. Waypoint markers: takeoff (green), landing (red), cruise (blue)
        // All waypoints are clickable via infoBox
        parsedPoints.forEach((p, idx) => {
          const isTakeoff = idx === 0
          const isLanding = idx === parsedPoints.length - 1
          const color = isTakeoff
            ? Cesium.Color.LIMEGREEN
            : isLanding
              ? Cesium.Color.RED
              : Cesium.Color.CORNFLOWERBLUE
          const label = isTakeoff ? 'Takeoff' : isLanding ? 'Landing' : `WP ${idx + 1}`
          const pixelSize = isTakeoff || isLanding ? 10 : 6

          viewer.entities.add({
            name: label,
            position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt),
            point: {
              pixelSize,
              color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            },
            label: isTakeoff || isLanding
              ? {
                  text: label,
                  font: '12px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                  pixelOffset: new Cesium.Cartesian2(0, -14),
                }
              : undefined,
            description: [
              '<table style="width:100%">',
              `<tr><td><b>${label}</b></td></tr>`,
              `<tr><td>Lat</td><td>${p.lat.toFixed(6)}</td></tr>`,
              `<tr><td>Lon</td><td>${p.lng.toFixed(6)}</td></tr>`,
              `<tr><td>Alt</td><td>${p.alt.toFixed(1)} m AGL</td></tr>`,
              `<tr><td>Time</td><td>${formatTime(p.time)}</td></tr>`,
              '</table>',
            ].join(''),
          })
        })

        // 9. Drone entity — large highlighted point
        const firstPos = parsedPoints[0]
        const droneEntity = viewer.entities.add({
          name: 'Drone',
          position: Cesium.Cartesian3.fromDegrees(firstPos.lng, firstPos.lat, firstPos.alt),
          point: {
            pixelSize: 16,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          },
          label: {
            text: 'Drone',
            font: 'bold 13px sans-serif',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
          },
        })
        droneEntityRef.current = droneEntity

        // 10. Camera — fly to encompass full trajectory
        const boundingSphere = Cesium.BoundingSphere.fromPoints(cartesianPositions)
        boundingSphere.radius = Math.max(boundingSphere.radius * 2.5, 300)
        viewer.camera.flyToBoundingSphere(boundingSphere, {
          duration: 1.5,
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0),
        })

        setLoading(false)
      } catch (err: any) {
        if (!destroyed) {
          setError(err.message || 'Failed to initialise 3D trajectory viewer')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      destroyed = true
      cancelAnimationFrame(animFrameRef.current)
      setPlaying(false)
      droneEntityRef.current = null
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [isOpen, planId])

  // Escape key to close
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
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            3D Trajectory: {planName || 'Unnamed'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Download CSV button */}
            <button
              onClick={() => {
                if (!csvContent) return
                const blob = new Blob([csvContent], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${planName || 'trajectory'}.csv`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              disabled={!csvContent}
              className="px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
              title="Download CSV"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
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
        </div>

        {/* Cesium container */}
        <div className="flex-1 relative" style={{ minHeight: '500px' }}>
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: '500px' }} />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-10 h-10 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-gray-300 text-sm">Loading 3D trajectory...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <svg
                  className="w-10 h-10 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
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

        {/* Animation Controls */}
        {!loading && !error && points.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              {/* Play/Pause */}
              <button
                onClick={() => {
                  if (currentTime >= endTime) {
                    currentTimeRef.current = 0
                    setCurrentTime(0)
                  }
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
                min={0}
                max={endTime || 1}
                value={currentTime}
                onChange={e => {
                  const val = Number(e.target.value)
                  setPlaying(false)
                  currentTimeRef.current = val
                  setCurrentTime(val)
                }}
                className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
                step={0.1}
              />

              {/* Speed control */}
              <select
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="flex-shrink-0 bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                {SPEED_OPTIONS.map(s => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>

              {/* Follow drone toggle */}
              <button
                onClick={() => setFollowDrone(f => !f)}
                className={`flex-shrink-0 px-2 py-1.5 text-xs rounded border transition-colors ${
                  followDrone
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
                title="Follow drone camera"
              >
                Follow
              </button>
            </div>

            {/* Time display */}
            <div className="text-center text-xs text-gray-300 font-mono">
              {formatTime(currentTime)} / {formatTime(endTime)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
          <span>
            {points.length > 0
              ? `${points.length} trajectory points · Alt shown as AGL`
              : 'No trajectory data'}
          </span>
          <span>Powered by CesiumJS</span>
        </div>
      </div>
    </div>
  )
}

export default Trajectory3DViewer
