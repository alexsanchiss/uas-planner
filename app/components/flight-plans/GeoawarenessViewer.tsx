'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useGeoawarenessWebSocket, type GeozoneData } from '@/app/hooks/useGeoawarenessWebSocket'
import L from 'leaflet'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
)
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

// Dynamically import GeozoneLayer
const GeozoneLayer = dynamic(
  () => import('@/app/components/plan-generator/GeozoneLayer').then((mod) => mod.GeozoneLayer),
  { ssr: false }
)
const GeozoneInfoPopup = dynamic(
  () => import('@/app/components/plan-generator/GeozoneInfoPopup').then((mod) => mod.GeozoneInfoPopup),
  { ssr: false }
)

// Geozone types for the legend and visualization
export type GeozoneType = 
  | 'prohibited'      // No-fly zone (red)
  | 'restricted'      // Restricted airspace (orange)
  | 'controlled'      // Controlled airspace (yellow)
  | 'advisory'        // Advisory zone (blue)
  | 'warning'         // Warning area (purple)
  | 'temporary'       // Temporary restriction (gray striped)

export interface Geozone {
  id: string
  name: string
  type: GeozoneType
  geometry?: unknown
  altitude?: { min: number; max: number }
  active?: boolean
}

export interface Violation {
  id: string
  geozoneId: string
  geozoneName: string
  geozoneType: GeozoneType
  severity: 'critical' | 'warning' | 'info'
  message: string
  waypointIndex?: number
}

/** Trajectory point from CSV */
interface TrajectoryPoint {
  lat: number
  lng: number
  alt?: number
  time?: number
  type?: 'takeoff' | 'cruise' | 'landing' | 'waypoint'
}

export interface GeoawarenessViewerProps {
  planId?: string
  planName?: string
  /** U-space identifier for WebSocket connection (from flightPlan.geoawarenessData.uspace_identifier) */
  uspaceId?: string | null
  trajectoryData?: unknown
  geozones?: Geozone[]
  violations?: Violation[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
}

// Color mapping for geozone types
const GEOZONE_COLORS: Record<GeozoneType, { bg: string; border: string; label: string }> = {
  prohibited: { bg: 'bg-red-500', border: 'border-red-600', label: 'Prohibited (No-Fly)' },
  restricted: { bg: 'bg-orange-500', border: 'border-orange-600', label: 'Restricted Airspace' },
  controlled: { bg: 'bg-yellow-500', border: 'border-yellow-600', label: 'Controlled Airspace' },
  advisory: { bg: 'bg-blue-400', border: 'border-blue-500', label: 'Advisory Zone' },
  warning: { bg: 'bg-purple-500', border: 'border-purple-600', label: 'Warning Area' },
  temporary: { bg: 'bg-gray-500', border: 'border-gray-600', label: 'Temporary Restriction' },
}

// Severity colors for violations
const SEVERITY_COLORS = {
  critical: 'text-red-600 dark:text-red-400',
  warning: 'text-orange-600 dark:text-orange-400',
  info: 'text-blue-600 dark:text-blue-400',
}

// Parse CSV content to trajectory points
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

  const points: TrajectoryPoint[] = []
  const dataLines = lines.slice(1).filter(line => line.trim().length > 0)

  for (let idx = 0; idx < dataLines.length; idx++) {
    const values = dataLines[idx].split(',').map(v => v.trim())
    const lat = parseFloat(values[latIdx])
    const lng = parseFloat(values[lngIdx])

    if (isNaN(lat) || isNaN(lng)) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

    points.push({
      lat,
      lng,
      alt: altIdx !== -1 ? parseFloat(values[altIdx]) || undefined : undefined,
      time: timeIdx !== -1 ? parseFloat(values[timeIdx]) || undefined : undefined,
      type: idx === 0 ? 'takeoff' : idx === dataLines.length - 1 ? 'landing' : 'waypoint',
    })
  }

  return points
}

// Calculate bounds from trajectory points
function calculateBounds(points: TrajectoryPoint[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null

  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity

  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }

  const latPad = (maxLat - minLat) * 0.15 || 0.01
  const lngPad = (maxLng - minLng) * 0.15 || 0.01

  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ]
}

// Get point color based on type
function getPointColor(type?: string): string {
  switch (type) {
    case 'takeoff': return '#22c55e' // green
    case 'landing': return '#ef4444' // red
    default: return '#3b82f6' // blue
  }
}

/**
 * GeoawarenessViewer - Component for geoawareness map visualization
 * 
 * TASK-057: Refactored to use WebSocket for real-time geozone data
 * TASK-058: Loading state while connecting to WebSocket
 * TASK-059: Error handling with retry button when connection fails
 * TASK-060: Trajectory overlay from flight plan CSV data
 * 
 * Features:
 * - Real-time geozone data via WebSocket connection
 * - Trajectory overlay visualization from plan's CSV data
 * - Error state handling with retry button
 * - Comprehensive legend for geozone types
 */
export function GeoawarenessViewer({
  planId,
  planName,
  uspaceId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trajectoryData: _trajectoryData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  geozones: _geozones = [],
  violations = [],
  isLoading: externalLoading = false,
  error: externalError = null,
  onRetry: externalRetry,
  className = '',
}: GeoawarenessViewerProps) {
  const [showLegend, setShowLegend] = useState(true)
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([])
  const [trajectoryLoading, setTrajectoryLoading] = useState(false)
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null)
  const [selectedGeozone, setSelectedGeozone] = useState<GeozoneData | null>(null)
  const [popupPosition, setPopupPosition] = useState<L.LatLngExpression | null>(null)
  const [showGeozones, setShowGeozones] = useState(true)
  
  // TASK-077: Time slider state for trajectory simulation
  const [simulationTime, setSimulationTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1) // 1x, 2x, 4x
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  // TASK-083: Connect to geoawareness WebSocket for geozones
  const {
    status: wsStatus,
    data: wsData,
    error: wsError,
    isConnected: wsConnected,
    reconnect,
  } = useGeoawarenessWebSocket({
    uspaceId: uspaceId || null,
    enabled: !!uspaceId && !!planId,
  })

  // Derive legacy-compatible variables from WebSocket data
  const wsGeozones = wsData?.geozones_data || []
  const wsLoading = wsStatus === 'connecting'
  const usingFallback = false // WebSocket does not use fallback

  // Combine fetched geozones with any externally provided ones
  const allGeozones = useMemo(() => {
    return wsGeozones.length > 0 ? wsGeozones : []
  }, [wsGeozones])

  // Loading state combines external + API + trajectory
  const isLoading = externalLoading || wsLoading || trajectoryLoading
  
  // Error state combines external + API + trajectory
  const displayError = externalError || 
    (wsError?.message || null) ||
    trajectoryError

  const hasViolations = violations.length > 0
  const hasTrajectory = trajectory.length > 0
  const hasGeozones = allGeozones.length > 0

  // TASK-060: Fetch trajectory data when planId changes
  useEffect(() => {
    async function fetchTrajectory() {
      if (!planId) {
        setTrajectory([])
        return
      }

      console.log('[GeoawarenessViewer] Fetching trajectory for planId:', planId)

      setTrajectoryLoading(true)
      setTrajectoryError(null)

      try {
        const token = localStorage.getItem('authToken')
        const headers: Record<string, string> = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        // Get the plan to find csvResult
        const planRes = await fetch(`/api/flightPlans/${planId}`, { headers })
        if (!planRes.ok) {
          if (planRes.status === 404) {
            setTrajectoryError('Flight plan not found')
            return
          }
          throw new Error(`Failed to load plan (HTTP ${planRes.status})`)
        }
        
        const plan = await planRes.json()
        const csvResultId = plan.csvResult
        
        console.log('[GeoawarenessViewer] Found plan:', {
          planId: plan.id,
          planName: plan.customName,
          csvResultId,
          status: plan.status
        })
        
        if (!csvResultId) {
          // No trajectory data yet - not necessarily an error
          setTrajectory([])
          return
        }

        // Fetch the CSV content
        console.log('[GeoawarenessViewer] Fetching CSV with id:', csvResultId)
        const csvRes = await fetch(`/api/csvResult?id=${csvResultId}`, { headers })
        if (!csvRes.ok) {
          if (csvRes.status === 404) {
            setTrajectoryError('Trajectory data not found')
            return
          }
          throw new Error(`Error loading CSV (HTTP ${csvRes.status})`)
        }
        
        const data = await csvRes.json()
        const content = data.csvResult || data.content || data.csvContent || ''
        
        const points = parseCSVToTrajectory(content)
        setTrajectory(points)
      } catch (err) {
        setTrajectoryError(err instanceof Error ? err.message : 'Failed to load trajectory')
      } finally {
        setTrajectoryLoading(false)
      }
    }

    fetchTrajectory()
  }, [planId])

  // Calculate map bounds and center
  const { bounds, center } = useMemo(() => {
    if (trajectory.length > 0) {
      const calculatedBounds = calculateBounds(trajectory)
      const lat = trajectory.reduce((sum, p) => sum + p.lat, 0) / trajectory.length
      const lng = trajectory.reduce((sum, p) => sum + p.lng, 0) / trajectory.length
      return { bounds: calculatedBounds, center: [lat, lng] as [number, number] }
    }
    // Default to Madrid if no trajectory
    return { bounds: null, center: [40.4168, -3.7038] as [number, number] }
  }, [trajectory])

  // Create polyline positions
  const polylinePositions = useMemo(() => 
    trajectory.map(p => [p.lat, p.lng] as [number, number]),
    [trajectory]
  )

  // TASK-077: Calculate total trajectory duration
  const trajectoryDuration = useMemo(() => {
    if (trajectory.length < 2) return 0
    // Check if trajectory has time data
    const lastPoint = trajectory[trajectory.length - 1]
    if (lastPoint.time !== undefined) {
      return lastPoint.time
    }
    // Estimate duration based on point count (1 second per point as fallback)
    return trajectory.length - 1
  }, [trajectory])

  // TASK-077: Interpolate current position along trajectory based on simulation time
  const simulatedPosition = useMemo(() => {
    if (trajectory.length < 2 || trajectoryDuration === 0) return null
    
    // Clamp simulation time
    const t = Math.max(0, Math.min(simulationTime, trajectoryDuration))
    
    // Find segment based on time or index
    for (let i = 0; i < trajectory.length - 1; i++) {
      const p1 = trajectory[i]
      const p2 = trajectory[i + 1]
      
      const t1 = p1.time !== undefined ? p1.time : i
      const t2 = p2.time !== undefined ? p2.time : i + 1
      
      if (t >= t1 && t <= t2) {
        // Interpolate between these two points
        const segmentProgress = t2 !== t1 ? (t - t1) / (t2 - t1) : 0
        return {
          lat: p1.lat + (p2.lat - p1.lat) * segmentProgress,
          lng: p1.lng + (p2.lng - p1.lng) * segmentProgress,
          alt: p1.alt !== undefined && p2.alt !== undefined
            ? p1.alt + (p2.alt - p1.alt) * segmentProgress
            : p1.alt,
          time: t,
        }
      }
    }
    
    // Return last point if beyond range
    const lastPoint = trajectory[trajectory.length - 1]
    return {
      lat: lastPoint.lat,
      lng: lastPoint.lng,
      alt: lastPoint.alt,
      time: trajectoryDuration,
    }
  }, [trajectory, trajectoryDuration, simulationTime])

  // TASK-077: Animation loop for playback
  useEffect(() => {
    if (!isPlaying || trajectoryDuration === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    lastTimeRef.current = performance.now()
    
    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTimeRef.current) / 1000 // Convert to seconds
      lastTimeRef.current = currentTime
      
      setSimulationTime(prev => {
        const next = prev + delta * playbackSpeed
        if (next >= trajectoryDuration) {
          setIsPlaying(false)
          return trajectoryDuration
        }
        return next
      })
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, trajectoryDuration, playbackSpeed])

  // Reset simulation when trajectory changes
  useEffect(() => {
    setSimulationTime(0)
    setIsPlaying(false)
  }, [trajectory])

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (simulationTime >= trajectoryDuration) {
      setSimulationTime(0)
    }
    setIsPlaying(prev => !prev)
  }, [simulationTime, trajectoryDuration])

  // Handle retry
  const handleRetry = useCallback(() => {
    if (externalRetry) {
      externalRetry()
    }
    if (wsError && uspaceId) {
      reconnect()
    }
    if (trajectoryError && planId) {
      setTrajectoryError(null)
      setTrajectory([])
    }
  }, [externalRetry, wsError, uspaceId, reconnect, trajectoryError, planId])

  // Handle geozone click
  const handleGeozoneClick = useCallback((geozone: GeozoneData, event: L.LeafletMouseEvent) => {
    setSelectedGeozone(geozone)
    setPopupPosition(event.latlng)
  }, [])

  return (
    <div
      className={`relative bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden ${className}`}
      style={{ minHeight: '400px' }}
    >
      {/* Loading overlay (TASK-058) */}
      {isLoading && (
        <div className="absolute inset-0 bg-[var(--bg-primary)]/80 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-10 w-10 text-blue-500" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-[var(--text-secondary)]">
              {wsLoading && 'Loading geoawareness data...'}
              {trajectoryLoading && !wsLoading && 'Loading trajectory data...'}
              {externalLoading && 'Loading...'}
            </span>
            {usingFallback && (
              <span className="text-xs text-[var(--text-tertiary)]">
                Using fallback data
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error state (TASK-059) */}
      {displayError && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20 bg-[var(--bg-primary)]/95">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Geoawareness Error
              </h4>
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                Failed to load geoawareness data
                {planName && <span className="font-medium"> for &ldquo;{planName}&rdquo;</span>}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2 mt-2">
                {displayError}
              </p>
            </div>

            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Map content */}
      {!displayError && (
        <div className="absolute inset-0 flex flex-col">
          {/* Map area */}
          <div className="flex-1 relative">
            {/* No plan selected state */}
            {!planId && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[var(--bg-secondary)]">
                <svg
                  className="w-16 h-16 text-[var(--text-tertiary)] mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <h4 className="text-lg font-medium text-[var(--text-secondary)] mb-2">
                  Geoawareness Map
                </h4>
                <p className="text-sm text-[var(--text-tertiary)] text-center max-w-xs">
                  Select a flight plan to view trajectory and geoawareness data
                </p>
              </div>
            )}

            {/* Leaflet Map (TASK-060) */}
            {planId && (
              <MapContainer
                center={center}
                zoom={13}
                bounds={bounds || undefined}
                className="w-full h-full"
                style={{ background: '#f3f4f6', zIndex: 1 }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* Geozone layer from WebSocket (TASK-057) */}
                {hasGeozones && showGeozones && (
                  <GeozoneLayer
                    geozones={allGeozones}
                    visible={showGeozones}
                    onGeozoneClick={handleGeozoneClick}
                    fillOpacity={0.3}
                    hoverFillOpacity={0.5}
                  />
                )}

                {/* Geozone info popup */}
                {selectedGeozone && popupPosition && (
                  <GeozoneInfoPopup
                    geozone={selectedGeozone}
                    position={popupPosition}
                    onClose={() => {
                      setSelectedGeozone(null)
                      setPopupPosition(null)
                    }}
                  />
                )}

                {/* Trajectory overlay (TASK-060) */}
                {hasTrajectory && (
                  <>
                    <Polyline
                      positions={polylinePositions}
                      pathOptions={{
                        color: '#3b82f6',
                        weight: 3,
                        opacity: 0.9,
                      }}
                    />

                    {trajectory.map((point, idx) => (
                      <CircleMarker
                        key={idx}
                        center={[point.lat, point.lng]}
                        radius={idx === 0 || idx === trajectory.length - 1 ? 8 : 5}
                        pathOptions={{
                          color: '#fff',
                          fillColor: getPointColor(point.type),
                          fillOpacity: 1,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-sm min-w-[150px]">
                            <p className="font-bold text-gray-900 mb-1">
                              {idx === 0 ? '🛫 Takeoff' : idx === trajectory.length - 1 ? '🛬 Landing' : `📍 Point ${idx + 1}`}
                            </p>
                            <div className="text-xs text-gray-600 space-y-0.5">
                              <p>Lat: {point.lat.toFixed(6)}</p>
                              <p>Lng: {point.lng.toFixed(6)}</p>
                              {point.alt !== undefined && <p>Alt: {point.alt.toFixed(1)}m</p>}
                              {point.time !== undefined && <p>Time: {point.time.toFixed(1)}s</p>}
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}

                    {/* TASK-077: Simulation position marker */}
                    {simulatedPosition && (
                      <CircleMarker
                        center={[simulatedPosition.lat, simulatedPosition.lng]}
                        radius={10}
                        pathOptions={{
                          color: '#fff',
                          fillColor: '#f97316', // Orange for drone/simulation position
                          fillOpacity: 1,
                          weight: 3,
                        }}
                      >
                        <Popup>
                          <div className="text-sm min-w-[150px]">
                            <p className="font-bold text-gray-900 mb-1">🛸 Drone Position</p>
                            <div className="text-xs text-gray-600 space-y-0.5">
                              <p>Lat: {simulatedPosition.lat.toFixed(6)}</p>
                              <p>Lng: {simulatedPosition.lng.toFixed(6)}</p>
                              {simulatedPosition.alt !== undefined && (
                                <p>Alt: {simulatedPosition.alt.toFixed(1)}m</p>
                              )}
                              <p>Time: {simulatedPosition.time.toFixed(1)}s</p>
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    )}
                  </>
                )}
              </MapContainer>
            )}

            {/* Overlay controls */}
            {planId && (
              <>
                {/* Plan info overlay */}
                <div className="absolute top-3 left-3 bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md z-[1000]">
                  <div className="text-xs text-[var(--text-tertiary)]">Flight Plan</div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {planName || planId}
                  </div>
                </div>

                {/* Status indicator */}
                <div className="absolute top-3 right-3 bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md z-[1000]">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        hasViolations
                          ? 'bg-red-500 animate-pulse'
                          : !wsLoading && !wsError
                          ? 'bg-green-500'
                          : wsLoading
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {hasViolations
                        ? `${violations.length} Violation${violations.length !== 1 ? 's' : ''}`
                        : !wsLoading && !wsError
                        ? `${allGeozones.length} Geozones${usingFallback ? ' (fallback)' : ''}`
                        : wsLoading
                        ? 'Loading...'
                        : !uspaceId
                        ? 'No U-space'
                        : 'Error'}
                    </span>
                  </div>
                </div>

                {/* Geozone visibility toggle */}
                {hasGeozones && (
                  <div className="absolute bottom-24 right-3 bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md z-[1000]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGeozones}
                        onChange={(e) => setShowGeozones(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-[var(--text-secondary)]">
                        Show Geozones
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          {/* TASK-077: Time slider for trajectory simulation */}
          {hasTrajectory && trajectoryDuration > 0 && (
            <div className="border-t border-[var(--border-primary)] bg-[var(--surface-primary)] px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Play/Pause button */}
                <button
                  onClick={togglePlayback}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                  title={isPlaying ? 'Pause simulation' : 'Play simulation'}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Time slider */}
                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="range"
                    min={0}
                    max={trajectoryDuration}
                    step={0.1}
                    value={simulationTime}
                    onChange={(e) => {
                      setIsPlaying(false)
                      setSimulationTime(parseFloat(e.target.value))
                    }}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(simulationTime / trajectoryDuration) * 100}%, #e5e7eb ${(simulationTime / trajectoryDuration) * 100}%, #e5e7eb 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                    <span>{simulationTime.toFixed(1)}s</span>
                    <span>{trajectoryDuration.toFixed(1)}s</span>
                  </div>
                </div>

                {/* Speed control */}
                <div className="flex items-center gap-1">
                  {[1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title={`${speed}x speed`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                {/* Reset button */}
                <button
                  onClick={() => {
                    setIsPlaying(false)
                    setSimulationTime(0)
                  }}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="Reset to start"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Current simulation info */}
              {simulatedPosition && (
                <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    Drone: {simulatedPosition.lat.toFixed(5)}, {simulatedPosition.lng.toFixed(5)}
                  </span>
                  {simulatedPosition.alt !== undefined && (
                    <span>Alt: {simulatedPosition.alt.toFixed(1)}m</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Violations list */}
          {hasViolations && (
            <div className="border-t border-[var(--border-primary)] bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Airspace Violations Detected
                </span>
              </div>
              <ul className="space-y-1 max-h-24 overflow-y-auto">
                {violations.map((v) => (
                  <li
                    key={v.id}
                    className={`text-xs ${SEVERITY_COLORS[v.severity]} flex items-start gap-1`}
                  >
                    <span className="font-medium">{v.geozoneName}:</span>
                    <span className="text-gray-600 dark:text-gray-400">{v.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legend */}
          <div className="border-t border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center justify-between w-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span>Map Legend</span>
              <svg
                className={`w-4 h-4 transition-transform ${showLegend ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLegend && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                {/* Trajectory markers */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-0.5 bg-blue-500 rounded" />
                  <span className="text-[var(--text-tertiary)]">Trajectory</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-green-500 rounded-full border border-white shadow-sm" />
                  <span className="text-[var(--text-tertiary)]">Takeoff</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm" />
                  <span className="text-[var(--text-tertiary)]">Waypoint</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm" />
                  <span className="text-[var(--text-tertiary)]">Landing</span>
                </div>
                {/* TASK-077: Simulation marker */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-sm" />
                  <span className="text-[var(--text-tertiary)]">Drone Position</span>
                </div>

                {/* Geozone types */}
                {Object.entries(GEOZONE_COLORS).map(([type, config]) => (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-3 h-3 ${config.bg} ${config.border} border rounded opacity-70`}
                      style={type === 'temporary' ? {
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'
                      } : undefined}
                    />
                    <span className="text-[var(--text-tertiary)]">{config.label}</span>
                  </div>
                ))}

                {/* Violation indicator */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-red-500/30 border-2 border-red-500 rounded animate-pulse" />
                  <span className="text-[var(--text-tertiary)]">Violation Zone</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GeoawarenessViewer
