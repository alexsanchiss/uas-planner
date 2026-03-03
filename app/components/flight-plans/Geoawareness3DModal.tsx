'use client'

/**
 * Geoawareness3DModal - 3D Cesium viewer for geozones with extruded volumes
 *
 * Task 32: Shows geozone restrictions as 3D extruded polygons alongside
 * operation volumes and the flight trajectory. Uses the same Cesium loading
 * pattern as Cesium3DModal.tsx.
 *
 * Features:
 * - Geozones rendered as 3D extruded polygons colored by type
 * - Operation volumes rendered as semi-transparent blue prisms
 * - Flight trajectory rendered as a blue polyline
 * - Clickable geozones with InfoBox showing detailed information
 * - Dark-theme InfoBox CSS injection
 * - UOM conversion (M, FT) and AGL height reference
 */

import React, { useEffect, useRef, useState } from 'react'
import { useGeoawarenessWebSocket, type GeozoneData } from '@/app/hooks/useGeoawarenessWebSocket'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperationVolume {
  geometry: { type: string; coordinates: number[][][] }
  minAltitude?: { value: number; reference?: string; uom?: string } | number
  maxAltitude?: { value: number; reference?: string; uom?: string } | number
  name?: string
  ordinal?: number
  timeBegin?: string
  timeEnd?: string
}

export interface Geoawareness3DModalProps {
  isOpen: boolean
  onClose: () => void
  planId: string
  uspaceId: string | null
  uplanData: { operationVolumes?: OperationVolume[]; [key: string]: unknown } | null
}

// ─── Color map matching GeoawarenessModal.tsx ─────────────────────────────────

const GEOZONE_COLORS: Record<string, string> = {
  'U-SPACE':           '#e41a1c',
  'PROHIBITED':        '#4daf4a',
  'REQ_AUTHORIZATION': '#ff7f00',
  'CONDITIONAL':       '#a65628',
  'NO_RESTRICTION':    '#999999',
}

function geozoneColor(type: string | undefined): string {
  if (!type) return '#999999'
  return GEOZONE_COLORS[type] || GEOZONE_COLORS[type.toUpperCase()] || '#999999'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadCesiumScript(): Promise<any> {
  if ((window as any).Cesium) return Promise.resolve((window as any).Cesium)
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
      ;(window as any).Cesium ? resolve((window as any).Cesium) : reject(new Error('Cesium failed to load'))
    }
    script.onerror = () => reject(new Error('Failed to load Cesium script'))
    document.head.appendChild(script)
  })
}

function extractAlt(alt: unknown): number | null {
  if (alt == null) return null
  if (typeof alt === 'number') return alt
  if (typeof alt === 'object' && (alt as any).value != null) return Number((alt as any).value)
  return null
}

function feetToMeters(ft: number): number {
  return ft * 0.3048
}

/** Parse CSV trajectory text → array of {lat,lng,alt} */
function parseTrajectoryCSV(csv: string): { lat: number; lng: number; alt: number }[] {
  if (!csv || csv.trim().length === 0) return []
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const latIdx = header.findIndex(h => h.includes('lat'))
  const lngIdx = header.findIndex(h => h.includes('lon') || h.includes('lng'))
  const altIdx = header.findIndex(h => h.includes('alt'))
  if (latIdx === -1 || lngIdx === -1) return []
  const pts: { lat: number; lng: number; alt: number }[] = []
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(',').map(s => s.trim())
    const lat = parseFloat(v[latIdx])
    const lng = parseFloat(v[lngIdx])
    const alt = altIdx !== -1 ? parseFloat(v[altIdx]) || 0 : 0
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90) pts.push({ lat, lng, alt })
  }
  return pts
}

/** Safely parse JSON-or-object fields used in geozone properties */
function safeParse<T>(v: unknown): T | null {
  if (v == null) return null
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T } catch { return null }
  }
  return null
}

/** Format date for display */
function fmtDate(d: string | undefined | null): string {
  if (!d) return 'N/A'
  try { return new Date(d).toLocaleString() } catch { return d }
}

/** Build InfoBox HTML description for a geozone */
function buildGeozoneHTML(gz: GeozoneData, lowerAlt: number, upperAlt: number): string {
  const p = gz.properties as any
  const identifier = gz.uas_geozones_identifier || p?.identifier || ''
  const name = p?.name || ''
  const type = p?.type || ''
  const country = p?.country || ''
  const region = p?.region || ''
  const color = geozoneColor(type)

  // Restrictions
  const rc = safeParse<any>(p?.restrictionConditions) || {}
  // Authority
  const za = safeParse<any>(p?.zoneAuthority) || {}
  // Applicability
  const la = safeParse<any>(p?.limitedApplicability) || {}
  // Vertical ref
  const vr = (gz.geometry as any)?.verticalReference || {}

  let html = `<div style="font-family:sans-serif;font-size:12px;max-width:400px">`

  // Header
  html += `<div style="background:${color};padding:8px 12px;border-radius:4px 4px 0 0;margin-bottom:8px">`
  html += `<div style="color:#fff;font-size:15px;font-weight:bold">${identifier}</div>`
  if (name) html += `<div style="color:#ffffffcc;font-size:11px;margin-top:2px">${name}</div>`
  html += `</div>`

  // General info
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">`
  if (country) html += `<tr><td style="padding:3px 6px;font-weight:bold;color:#ccc">Country</td><td style="padding:3px 6px">${country}</td></tr>`
  if (region) html += `<tr><td style="padding:3px 6px;font-weight:bold;color:#ccc">Region</td><td style="padding:3px 6px">${region}</td></tr>`
  html += `<tr><td style="padding:3px 6px;font-weight:bold;color:#ccc">Type</td><td style="padding:3px 6px">${type}</td></tr>`
  html += `<tr><td style="padding:3px 6px;font-weight:bold;color:#ccc">Lower</td><td style="padding:3px 6px">${lowerAlt.toFixed(0)} m ${vr.lowerReference ? `(${vr.lowerReference})` : 'AGL'}</td></tr>`
  html += `<tr><td style="padding:3px 6px;font-weight:bold;color:#ccc">Upper</td><td style="padding:3px 6px">${upperAlt.toFixed(0)} m ${vr.upperReference ? `(${vr.upperReference})` : 'AGL'}</td></tr>`
  html += `</table>`

  // Restriction conditions
  if (rc.authorized || rc.uasClass || rc.maxNoise || rc.photograph || rc.specialOperation || rc.specialoperation) {
    html += `<div style="font-weight:bold;color:#ccc;margin-bottom:4px;border-top:1px solid #555;padding-top:6px">Restriction Conditions</div>`
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">`
    if (rc.authorized) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Authorization</td><td style="padding:2px 6px">${rc.authorized}</td></tr>`
    if (rc.uasClass?.length) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">UAS Classes</td><td style="padding:2px 6px">${rc.uasClass.join(', ')}</td></tr>`
    if (rc.uasOperationMode) {
      const modes = Array.isArray(rc.uasOperationMode) ? rc.uasOperationMode.join(', ') : rc.uasOperationMode
      html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Op. Mode</td><td style="padding:2px 6px">${modes}</td></tr>`
    }
    if (rc.maxNoise != null) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Max Noise</td><td style="padding:2px 6px">${rc.maxNoise} dB</td></tr>`
    if (rc.photograph) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Photography</td><td style="padding:2px 6px">${rc.photograph}</td></tr>`
    if (rc.specialOperation || rc.specialoperation) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Special Ops</td><td style="padding:2px 6px">${rc.specialOperation || rc.specialoperation}</td></tr>`
    html += `</table>`
  }

  // Zone authority
  if (za.name || za.phone || za.email || za.SiteURL || za.siteURL) {
    html += `<div style="font-weight:bold;color:#ccc;margin-bottom:4px;border-top:1px solid #555;padding-top:6px">Authority Information</div>`
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">`
    if (za.name) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Name</td><td style="padding:2px 6px">${za.name}</td></tr>`
    if (za.phone) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Phone</td><td style="padding:2px 6px">${za.phone}</td></tr>`
    if (za.email) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Email</td><td style="padding:2px 6px">${za.email}</td></tr>`
    const url = za.SiteURL || za.siteURL
    if (url) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Website</td><td style="padding:2px 6px"><a href="${url}" target="_blank" style="color:#6cb4ee">Visit</a></td></tr>`
    html += `</table>`
  }

  // Applicability
  const startDt = la.startDatetime || la.startDateTime
  const endDt = la.endDatetime || la.endDateTime
  if (startDt || endDt) {
    html += `<div style="font-weight:bold;color:#ccc;margin-bottom:4px;border-top:1px solid #555;padding-top:6px">Applicability</div>`
    html += `<table style="width:100%;border-collapse:collapse">`
    if (startDt) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Start</td><td style="padding:2px 6px">${fmtDate(startDt)}</td></tr>`
    if (endDt) html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">End</td><td style="padding:2px 6px">${fmtDate(endDt)}</td></tr>`
    if (la.schedule && typeof la.schedule === 'object' && la.schedule.day) {
      html += `<tr><td style="padding:2px 6px;font-weight:bold;color:#ccc">Days</td><td style="padding:2px 6px">${Array.isArray(la.schedule.day) ? la.schedule.day.join(', ') : la.schedule.day}</td></tr>`
    }
    html += `</table>`
  }

  html += `</div>`
  return html
}

// ─── Component ────────────────────────────────────────────────────────────────

const Geoawareness3DModal: React.FC<Geoawareness3DModalProps> = ({
  isOpen,
  onClose,
  planId,
  uspaceId,
  uplanData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const cesiumRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trajectory, setTrajectory] = useState<{ lat: number; lng: number; alt: number }[]>([])
  const initDoneRef = useRef(false)

  // Connect to geoawareness WebSocket
  const {
    status: wsStatus,
    data: wsData,
    error: wsError,
  } = useGeoawarenessWebSocket({
    uspaceId: isOpen ? uspaceId : null,
    enabled: isOpen && !!uspaceId,
    enableFallback: false,
    maxRetries: 10,
  })

  const geozones: GeozoneData[] = wsData?.geozones_data || []
  const wsReady = wsStatus === 'connected' && geozones.length > 0
  const wsLoading = wsStatus === 'connecting'
  const wsFailed = wsStatus === 'error' && !wsLoading

  // Fetch trajectory CSV when modal opens
  useEffect(() => {
    if (!isOpen || !planId) { setTrajectory([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const token = localStorage.getItem('authToken')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        // Check if plan has CSV
        const planRes = await fetch(`/api/flightPlans/${planId}`, { headers })
        if (!planRes.ok) return
        const plan = await planRes.json()
        if (!plan.csvResult) return
        const csvRes = await fetch(`/api/csvResult?id=${plan.id}`, { headers })
        if (!csvRes.ok) return
        const data = await csvRes.json()
        const content = data.csvResult || data.content || data.csvContent || ''
        if (!cancelled) setTrajectory(parseTrajectoryCSV(content))
      } catch {
        // Trajectory is optional
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, planId])

  // Initialize Cesium and render entities when data is ready
  useEffect(() => {
    if (!isOpen || !containerRef.current) return
    // Wait until WebSocket data (or failure) before initialising so geozones are available
    if (wsLoading && geozones.length === 0) return

    let destroyed = false
    initDoneRef.current = false

    const init = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1. Fetch Cesium Ion token
        const tokenRes = await fetch('/api/cesium/token', {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        })
        if (!tokenRes.ok) throw new Error((await tokenRes.json().catch(() => ({}))).error || 'Failed to fetch Cesium token')
        const { token } = await tokenRes.json()
        if (destroyed) return

        // 2. Load Cesium
        const Cesium = await loadCesiumScript()
        cesiumRef.current = Cesium
        if (destroyed) return

        // 3. Configure
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

        // 5. Dark InfoBox CSS injection
        try {
          const frame = viewer.infoBox?.frame
          if (frame) {
            frame.addEventListener('load', () => {
              const doc = frame.contentDocument || frame.contentWindow?.document
              if (doc) {
                const s = doc.createElement('style')
                s.textContent = `
                  html, body { background: transparent !important; }
                  .cesium-infoBox { background: rgba(38,38,38,0.95) !important; color: #e0e0e0 !important; }
                  .cesium-infoBox-title { color: #fff !important; background: rgba(30,30,30,0.9) !important; }
                  .cesium-infoBox-description { color: #e0e0e0 !important; }
                  .cesium-infoBox-description * { color: #e0e0e0 !important; }
                  table { color: #e0e0e0 !important; width: 100%; }
                  td, th { color: #e0e0e0 !important; border-color: #555 !important; padding: 4px 8px; }
                  a { color: #6cb4ee !important; }
                `
                doc.head.appendChild(s)
              }
            })
          }
        } catch { /* optional */ }

        // 6. OSM Buildings
        try { const b = await Cesium.createOsmBuildingsAsync(); if (!destroyed) viewer.scene.primitives.add(b) } catch { /* optional */ }
        if (destroyed) { viewer.destroy(); return }

        const allPositions: any[] = []

        // ─── 7. Render geozones ──────────────────────────────────────────
        for (const gz of geozones) {
          const geom = gz.geometry
          if (!geom || geom.type !== 'Polygon') continue
          const rawCoords = geom.coordinates
          if (!rawCoords || !Array.isArray(rawCoords) || rawCoords.length === 0) continue
          // Coordinates: either number[][][] (Polygon) or string
          let ring: number[][]
          try {
            const parsed = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : rawCoords
            ring = (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) ? parsed[0] : parsed
          } catch { continue }
          if (!ring || ring.length === 0) continue

          const degreesArr: number[] = []
          ring.forEach((c: number[]) => {
            if (c.length >= 2) {
              degreesArr.push(c[0], c[1])
              allPositions.push(Cesium.Cartographic.fromDegrees(c[0], c[1]))
            }
          })
          if (degreesArr.length < 6) continue // need at least 3 points

          // Altitude from verticalReference
          const vr = geom.verticalReference || (geom as any).vertical_reference
          let lowerAlt = 0
          let upperAlt = 150
          if (vr) {
            const uom = (vr.uom || 'M').toUpperCase()
            if (typeof vr.lower === 'number') lowerAlt = uom === 'FT' ? feetToMeters(vr.lower) : vr.lower
            if (typeof vr.upper === 'number') upperAlt = uom === 'FT' ? feetToMeters(vr.upper) : vr.upper
          }

          // Determine height reference
          const lowerRef = vr?.lowerReference?.toUpperCase() || 'AGL'
          const heightRef = lowerRef.includes('AGL') || lowerRef.includes('GROUND')
            ? Cesium.HeightReference.RELATIVE_TO_GROUND
            : Cesium.HeightReference.NONE

          const gzType = gz.properties?.type || ''
          const color = geozoneColor(gzType)
          const identifier = gz.uas_geozones_identifier || (gz.properties as any)?.identifier || ''
          const name = gz.properties?.name || identifier

          viewer.entities.add({
            name: `🗺 ${name || `Geozone`}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArr),
              height: lowerAlt,
              extrudedHeight: upperAlt,
              heightReference: heightRef,
              extrudedHeightReference: heightRef,
              material: Cesium.Color.fromCssColorString(color).withAlpha(0.4),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.85),
              outlineWidth: 2,
            },
            description: buildGeozoneHTML(gz, lowerAlt, upperAlt),
          })
        }

        // ─── 8. Render operation volumes ─────────────────────────────────
        const volumes = uplanData?.operationVolumes
        if (volumes && volumes.length > 0) {
          for (let idx = 0; idx < volumes.length; idx++) {
            const vol = volumes[idx]
            const coords = vol.geometry?.coordinates?.[0]
            if (!coords || coords.length === 0) continue

            const deg: number[] = []
            coords.forEach(([lon, lat]: number[]) => {
              deg.push(lon, lat)
              allPositions.push(Cesium.Cartographic.fromDegrees(lon, lat))
            })

            const lo = extractAlt(vol.minAltitude) ?? 10
            const hi = extractAlt(vol.maxAltitude) ?? 120

            viewer.entities.add({
              name: vol.name || `Volume ${idx + 1}`,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(deg),
                height: lo,
                extrudedHeight: hi,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                material: Cesium.Color.fromCssColorString('rgba(51, 128, 255, 0.30)'),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString('rgba(51, 128, 255, 0.8)'),
                outlineWidth: 2,
              },
              description: [
                '<table style="width:100%">',
                `<tr><td><b>Volume</b></td><td>${vol.name || `Volume ${idx + 1}`}</td></tr>`,
                `<tr><td><b>Min Alt</b></td><td>${lo} m AGL</td></tr>`,
                `<tr><td><b>Max Alt</b></td><td>${hi} m AGL</td></tr>`,
                vol.timeBegin ? `<tr><td><b>Start</b></td><td>${vol.timeBegin}</td></tr>` : '',
                vol.timeEnd ? `<tr><td><b>End</b></td><td>${vol.timeEnd}</td></tr>` : '',
                '</table>',
              ].join(''),
            })
          }
        }

        // ─── 9. Render trajectory polyline ───────────────────────────────
        if (trajectory.length > 1) {
          const positions = trajectory.map(p => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt))
          viewer.entities.add({
            name: 'Flight Trajectory',
            polyline: {
              positions,
              width: 3,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.15,
                color: Cesium.Color.fromCssColorString('#2196F3'),
              }),
              clampToGround: false,
            },
          })

          // Takeoff marker
          const first = trajectory[0]
          viewer.entities.add({
            name: 'Takeoff',
            position: Cesium.Cartesian3.fromDegrees(first.lng, first.lat, first.alt),
            point: { pixelSize: 10, color: Cesium.Color.GREEN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND },
            label: { text: 'Takeoff', font: '12px sans-serif', fillColor: Cesium.Color.WHITE, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -14), heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND },
          })

          // Landing marker
          const last = trajectory[trajectory.length - 1]
          viewer.entities.add({
            name: 'Landing',
            position: Cesium.Cartesian3.fromDegrees(last.lng, last.lat, last.alt),
            point: { pixelSize: 10, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND },
            label: { text: 'Landing', font: '12px sans-serif', fillColor: Cesium.Color.WHITE, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -14), heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND },
          })

          // Add trajectory points to bounds
          trajectory.forEach(p => allPositions.push(Cesium.Cartographic.fromDegrees(p.lng, p.lat)))
        }

        // ─── 10. Fly camera to all entities ──────────────────────────────
        if (allPositions.length > 0) {
          const cartesians = allPositions.map((c: any) =>
            Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, c.height || 0)
          )
          const bs = Cesium.BoundingSphere.fromPoints(cartesians)
          bs.radius = Math.max(bs.radius * 2.5, 500)
          viewer.camera.flyToBoundingSphere(bs, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0),
          })
        }

        initDoneRef.current = true
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
      initDoneRef.current = false
    }
    // Re-init when geozones arrive or trajectory loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, wsReady, wsFailed, trajectory.length, uplanData])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const geozoneCount = geozones.length
  const volumeCount = uplanData?.operationVolumes?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            3D Geoawareness Viewer
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

        {/* Status bar */}
        <div className="px-6 py-2 border-b border-gray-700 bg-gray-800/50 flex items-center gap-4 text-xs text-gray-300">
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${wsReady ? 'bg-green-500' : wsLoading ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{wsReady ? `${geozoneCount} geozone${geozoneCount !== 1 ? 's' : ''}` : wsLoading ? 'Connecting...' : 'No geozone data'}</span>
          </div>
          {volumeCount > 0 && (
            <span className="text-blue-400">{volumeCount} operation volume{volumeCount !== 1 ? 's' : ''}</span>
          )}
          {trajectory.length > 0 && (
            <span className="text-blue-300">{trajectory.length} trajectory points</span>
          )}
        </div>

        {/* Cesium container */}
        <div className="flex-1 relative" style={{ minHeight: '500px' }}>
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: '500px' }} />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-10 h-10 animate-spin text-green-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-300 text-sm">
                  {wsLoading ? 'Connecting to geoawareness service...' : 'Loading 3D viewer...'}
                </p>
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
                <button onClick={onClose} className="mt-2 px-4 py-2 text-sm bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors">Close</button>
              </div>
            </div>
          )}

          {/* Legend overlay */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300 space-y-1.5">
              {trajectory.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#2196F3' }} />
                  <span>Flight trajectory</span>
                </div>
              )}
              {volumeCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(51, 128, 255, 0.5)' }} />
                  <span>Operation volume</span>
                </div>
              )}
              {Object.entries(GEOZONE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
                  <span>{type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
          <span>
            {geozoneCount > 0
              ? `${geozoneCount} geozone${geozoneCount !== 1 ? 's' : ''}`
              : 'No geozones'}
            {volumeCount > 0 && ` · ${volumeCount} volume${volumeCount !== 1 ? 's' : ''}`}
          </span>
          <span>Powered by CesiumJS</span>
        </div>
      </div>
    </div>
  )
}

export default Geoawareness3DModal
