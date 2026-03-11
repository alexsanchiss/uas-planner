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
  if (typeof alt === 'object' && (alt as any).value != null) {
    let val = Number((alt as any).value)
    const uom = ((alt as any).uom || 'M').toUpperCase()
    if (uom === 'FT') val = val * 0.3048
    return val
  }
  return null
}

/**
 * Returns true when the altitude uses WGS84/absolute reference (i.e. already
 * an ellipsoid height — must NOT have terrain height added on top).
 */
function isAbsoluteAlt(alt: unknown): boolean {
  if (alt == null || typeof alt !== 'object') return false
  const ref = ((alt as any).reference || '').toUpperCase()
  return ref === 'WGS84' || ref === 'W84' || ref === 'AMSL' || ref === 'MSL'
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

/**
 * Detect if coordinate pair is in [lat, lng] order instead of GeoJSON [lng, lat].
 * Latitude: -90..90; if |first| ≤ 90 and |second| > 90, it's [lat, lng].
 */
function isLatLngOrderCesium(coord: number[]): boolean {
  if (coord.length < 2) return false
  const [first, second] = coord
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    if (Math.abs(second) > 90) return true
    // European heuristic: lat ~30-50, lng near 0
    if (first > 30 && first < 50 && Math.abs(second) < 10) return true
  }
  return false
}

/**
 * Extract outer ring from geozone geometry as [lng, lat] pairs (Cesium-ready).
 * Handles Polygon, MultiPolygon, various nesting depths, string-encoded coords,
 * and auto-detects/swaps [lat, lng] → [lng, lat] when needed.
 */
function extractGeozoneRingForCesium(geometry: { type: string; coordinates: unknown }): number[][] | null {
  if (!geometry?.coordinates) return null
  const rawCoords = geometry.coordinates
  if (!Array.isArray(rawCoords) || rawCoords.length === 0) return null

  let ring: unknown[]
  try {
    const parsed = typeof rawCoords === 'string' ? JSON.parse(rawCoords) : rawCoords

    if (geometry.type === 'MultiPolygon') {
      const multi = parsed as number[][][][]
      if (!multi[0]?.[0]) return null
      ring = multi[0][0]
    } else {
      // Polygon or similar — detect nesting level
      const first = parsed[0]
      if (!Array.isArray(first)) return null
      if (typeof first[0] === 'number') {
        // [[lng, lat], ...] — missing outer ring wrapper
        ring = parsed
      } else if (Array.isArray(first[0])) {
        // [[[lng, lat], ...]] — properly nested
        ring = first
      } else return null
    }
  } catch { return null }

  if (!Array.isArray(ring) || ring.length === 0) return null
  const firstCoord = ring[0]
  if (!Array.isArray(firstCoord) || firstCoord.length < 2) return null

  const needsSwap = isLatLngOrderCesium(firstCoord as number[])
  return ring
    .filter((c): c is number[] => Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number')
    .map(c => needsSwap ? [c[1], c[0]] : [c[0], c[1]])
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
        viewer.scene.requestRenderMode = false

        // 5. Dark InfoBox CSS injection
        try {
          const frame = viewer.infoBox?.frame
          if (frame) {
            frame.addEventListener('load', () => {
              const doc = frame.contentDocument || frame.contentWindow?.document
              if (doc) {
                const s = doc.createElement('style')
                s.textContent = `
                  html, body { background: #1e1e1e !important; color: #e0e0e0 !important; }
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

        // Force Cesium widget styling for dark-theme readability
        const cesiumStyle = document.createElement('style')
        cesiumStyle.textContent = `
          .cesium-viewer .cesium-widget-credits,
          .cesium-viewer .cesium-widget-credits * { color: #aaa !important; }
          .cesium-viewer .cesium-viewer-toolbar button { color: #fff !important; }
          .cesium-viewer .cesium-navigation-help,
          .cesium-viewer .cesium-navigation-help * { color: #e0e0e0 !important; background: rgba(38,38,38,0.95) !important; }
          .cesium-viewer .cesium-baseLayerPicker-dropDown,
          .cesium-viewer .cesium-baseLayerPicker-dropDown * { color: #e0e0e0 !important; background: rgba(38,38,38,0.95) !important; }
          .cesium-viewer .cesium-viewer-selectionIndicator { color: #fff !important; }
          .cesium-viewer .cesium-infoBox { color: #e0e0e0 !important; background: rgba(38,38,38,0.95) !important; }
          .cesium-viewer .cesium-infoBox-title { color: #fff !important; background: rgba(30,30,30,0.9) !important; }
        `
        containerRef.current!.appendChild(cesiumStyle)

        // 6. OSM Buildings
        try { const b = await Cesium.createOsmBuildingsAsync(); if (!destroyed) viewer.scene.primitives.add(b) } catch { /* optional */ }
        if (destroyed) { viewer.destroy(); return }

        const allPositions: any[] = []    // all entity positions (geozone + volume + trajectory)
        const flightPositions: any[] = []  // volume + trajectory only, used for primary camera focus

        // ─── 7. Render geozones ──────────────────────────────────────────
        for (const gz of geozones) {
          const geom = gz.geometry
          if (!geom) continue
          // Support Polygon and MultiPolygon with coordinate order detection
          const ring = extractGeozoneRingForCesium(geom as { type: string; coordinates: unknown })
          if (!ring || ring.length < 3) continue

          const degreesArr: number[] = []
          ring.forEach((c: number[]) => {
            degreesArr.push(c[0], c[1]) // already [lng, lat] from helper
            allPositions.push(Cesium.Cartesian3.fromDegrees(c[0], c[1]))
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

        // ─── 8. Render operation volumes (AGL → absolute AMSL via terrain sampling) ───
        // Strategy: sample the WGS84 ellipsoid height at each volume's centre once,
        // then compute absolute heights (groundH + AGL value) so the polygon renders
        // correctly regardless of when terrain tiles finish loading.
        //
        // Per-volume fallback: if the terrain sample for a specific volume is
        // undefined or NaN (provider not ready, no data for that tile), that volume
        // falls back to HeightReference.RELATIVE_TO_GROUND individually — avoiding
        // the previous bug where a single failed sample (returning undefined → 0)
        // caused the whole plan to appear at sea-level when hasTerrain was still true.
        const volumes = uplanData?.operationVolumes
        if (volumes && volumes.length > 0) {
          // Collect one representative point per volume for batch terrain sampling.
          interface VolSample { volIdx: number; cart: any }
          const sampleData: VolSample[] = []
          volumes.forEach((vol, i) => {
            const coords = vol.geometry?.coordinates?.[0]
            if (coords && coords.length > 0) {
              const [lon, lat] = coords[Math.floor(coords.length / 2)]
              sampleData.push({ volIdx: i, cart: Cesium.Cartographic.fromDegrees(lon, lat) })
            }
          })

          // terrainH[volIdx] = WGS84 ellipsoid height of terrain at that volume's centre.
          // Only populated when the sampled height is a finite number — avoids treating
          // an undefined/NaN result (provider not ready) as sea-level (0).
          const terrainH: Record<number, number> = {}
          if (sampleData.length > 0) {
            try {
              const sampled = await Cesium.sampleTerrainMostDetailed(
                viewer.terrainProvider,
                sampleData.map(s => s.cart),
              )
              sampleData.forEach((s, i) => {
                const h = sampled[i]?.height
                if (typeof h === 'number' && isFinite(h)) {
                  terrainH[s.volIdx] = h
                }
                // If h is undefined/NaN, leave terrainH[volIdx] unset so this
                // volume falls back to RELATIVE_TO_GROUND individually.
              })
            } catch {
              // Terrain sampling failed entirely — all volumes will use fallback.
            }
          }

          for (let idx = 0; idx < volumes.length; idx++) {
            const vol = volumes[idx]
            const coords = vol.geometry?.coordinates?.[0]
            if (!coords || coords.length === 0) continue

            const deg: number[] = []
            coords.forEach(([lon, lat]: number[]) => {
              deg.push(lon, lat)
              allPositions.push(Cesium.Cartesian3.fromDegrees(lon, lat))
              flightPositions.push(Cesium.Cartesian3.fromDegrees(lon, lat))
            })

            const lo = extractAlt(vol.minAltitude) ?? 10
            const hi = extractAlt(vol.maxAltitude) ?? 120

            // If the altitude is already WGS84-absolute, use it directly.
            // Otherwise treat as AGL and add sampled terrain height.
            const loAbsolute = isAbsoluteAlt(vol.minAltitude)
            const hiAbsolute = isAbsoluteAlt(vol.maxAltitude)

            // Per-volume: did we get a valid terrain sample for this specific volume?
            const hasSampledTerrain = idx in terrainH
            const groundH = terrainH[idx] ?? 0

            let lowerH: number
            let upperH: number
            let polygonHeightRef: any

            if (loAbsolute || hiAbsolute) {
              // Absolute (WGS84) altitude — render directly, no terrain offset.
              lowerH = lo
              upperH = hi
              polygonHeightRef = undefined
            } else if (hasSampledTerrain) {
              // AGL + successful terrain sample → absolute AMSL heights.
              lowerH = groundH + lo
              upperH = groundH + hi
              polygonHeightRef = undefined
            } else {
              // AGL + no terrain sample → RELATIVE_TO_GROUND fallback for this volume.
              lowerH = lo
              upperH = hi
              polygonHeightRef = Cesium.HeightReference.RELATIVE_TO_GROUND
            }

            viewer.entities.add({
              name: vol.name || `Volume ${idx + 1}`,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(deg),
                height: lowerH,
                extrudedHeight: upperH,
                ...(polygonHeightRef !== undefined ? {
                  heightReference: polygonHeightRef,
                  extrudedHeightReference: polygonHeightRef,
                } : {}),
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

        // ─── 9. Render trajectory: polyline path + takeoff/landing markers ──
        if (trajectory.length > 0) {
          // Sample terrain height for each trajectory waypoint so the polyline
          // uses the same absolute-height coordinate system as the volumes.
          // This ensures the path visually starts at 0 m AGL (ground) and rises
          // consistently alongside the operation volume geometry.
          const trajTerrainH: number[] = new Array(trajectory.length).fill(0)
          try {
            const trajCarts = trajectory.map(p => Cesium.Cartographic.fromDegrees(p.lng, p.lat))
            const trajSampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, trajCarts)
            trajSampled.forEach((c: any, i: number) => {
              const h = c?.height
              if (typeof h === 'number' && isFinite(h)) trajTerrainH[i] = h
            })
          } catch { /* fallback: keep 0s — polyline appears at absolute AGL values */ }

          // Build absolute Cartesian3 positions for the polyline
          const trajAbsPositions = trajectory.map((p, i) =>
            Cesium.Cartesian3.fromDegrees(p.lng, p.lat, trajTerrainH[i] + p.alt)
          )

          // Polyline connecting all waypoints
          viewer.entities.add({
            polyline: {
              positions: trajAbsPositions,
              width: 3,
              material: new Cesium.PolylineGlowMaterialProperty({
                color: Cesium.Color.CYAN.withAlpha(0.9),
                glowPower: 0.15,
              }),
              depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
                color: Cesium.Color.CYAN.withAlpha(0.3),
                glowPower: 0.1,
              }),
            },
          })

          // Takeoff / landing markers
          trajectory.forEach((p, idx) => {
            const isTakeoff = idx === 0
            const isLanding = idx === trajectory.length - 1
            if (!isTakeoff && !isLanding) {
              // Only render key markers to keep the 3D scene uncluttered
              allPositions.push(Cesium.Cartesian3.fromDegrees(p.lng, p.lat))
              flightPositions.push(Cesium.Cartesian3.fromDegrees(p.lng, p.lat))
              return
            }
            const color = isTakeoff ? Cesium.Color.LIMEGREEN : Cesium.Color.RED
            const label = isTakeoff ? 'Takeoff' : 'Landing'

            viewer.entities.add({
              name: label,
              position: trajAbsPositions[idx],
              point: {
                pixelSize: 12,
                color,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
              },
              label: {
                text: label,
                font: '13px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -16),
              },
              description: [
                '<table style="width:100%">',
                `<tr><td><b>${label}</b></td></tr>`,
                `<tr><td>Lat</td><td>${p.lat.toFixed(6)}</td></tr>`,
                `<tr><td>Lon</td><td>${p.lng.toFixed(6)}</td></tr>`,
                `<tr><td>Alt</td><td>${p.alt.toFixed(1)} m AGL</td></tr>`,
                '</table>',
              ].join(''),
            })

            allPositions.push(Cesium.Cartesian3.fromDegrees(p.lng, p.lat))
            flightPositions.push(Cesium.Cartesian3.fromDegrees(p.lng, p.lat))
          })
        }

        // ─── 10. Fly camera — focus on operation volumes + trajectory (tight zoom)
        //         fall back to all entities if no flight data
        const cameraPositions = flightPositions.length > 0 ? flightPositions : allPositions
        if (cameraPositions.length > 0) {
          const bs = Cesium.BoundingSphere.fromPoints(cameraPositions)
          bs.radius = Math.max(bs.radius * 1.5, 300)
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
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#32cd32' }} />
                    <span>Takeoff</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6495ed' }} />
                    <span>Cruise waypoint</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff0000' }} />
                    <span>Landing</span>
                  </div>
                </>
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
