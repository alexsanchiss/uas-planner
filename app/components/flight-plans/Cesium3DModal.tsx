'use client'

import React, { useEffect, useRef, useState } from 'react'

interface Cesium3DModalProps {
  isOpen: boolean
  onClose: () => void
  uplanData: {
    operationVolumes?: {
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
    }[]
  } | null
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

const Cesium3DModal: React.FC<Cesium3DModalProps> = ({ isOpen, onClose, uplanData }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // 2. Load Cesium from pre-built bundle
        const Cesium = await loadCesiumScript()

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
          selectionIndicator: false,
          infoBox: false,
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

            viewer.entities.add({
              name: vol.name || `Volume ${idx + 1}`,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArray),
                height: lowerLimit,
                extrudedHeight: upperLimit,
                material,
                outline: true,
                outlineColor,
                outlineWidth: 2,
              },
              description: [
                '<table style="width:100%">',
                `<tr><td><b>Volume</b></td><td>${vol.name || `Volume ${idx + 1}`}</td></tr>`,
                `<tr><td><b>Min Alt</b></td><td>${lowerLimit} m</td></tr>`,
                `<tr><td><b>Max Alt</b></td><td>${upperLimit} m</td></tr>`,
                vol.timeBegin ? `<tr><td><b>Start</b></td><td>${vol.timeBegin}</td></tr>` : '',
                vol.timeEnd ? `<tr><td><b>End</b></td><td>${vol.timeEnd}</td></tr>` : '',
                '</table>',
              ].join(''),
            })
          })

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
