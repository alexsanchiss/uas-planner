'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'

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
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

export interface TrajectoryPoint {
  lat: number
  lng: number
  alt?: number
  time?: number
  speed?: number
  heading?: number
  type?: 'takeoff' | 'cruise' | 'landing' | 'waypoint'
}

export interface TrajectoryMapViewerProps {
  planId: string
  planName?: string
  onClose: () => void
  className?: string
}

// Parse CSV content to trajectory points
function parseCSVToTrajectory(csvContent: string): TrajectoryPoint[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const latIdx = header.findIndex(h => h.includes('lat'))
  const lngIdx = header.findIndex(h => h.includes('lon') || h.includes('lng'))
  const altIdx = header.findIndex(h => h.includes('alt'))
  const timeIdx = header.findIndex(h => h.includes('time'))
  const speedIdx = header.findIndex(h => h.includes('speed') || h.includes('vel'))
  const headingIdx = header.findIndex(h => h.includes('head') || h.includes('bearing'))

  if (latIdx === -1 || lngIdx === -1) return []

  const dataLines = lines.slice(1)
  const points: TrajectoryPoint[] = []

  for (let idx = 0; idx < dataLines.length; idx++) {
    const line = dataLines[idx]
    const values = line.split(',').map(v => v.trim())
    const lat = parseFloat(values[latIdx])
    const lng = parseFloat(values[lngIdx])

    if (isNaN(lat) || isNaN(lng)) continue

    points.push({
      lat,
      lng,
      alt: altIdx !== -1 ? parseFloat(values[altIdx]) || undefined : undefined,
      time: timeIdx !== -1 ? parseFloat(values[timeIdx]) || undefined : undefined,
      speed: speedIdx !== -1 ? parseFloat(values[speedIdx]) || undefined : undefined,
      heading: headingIdx !== -1 ? parseFloat(values[headingIdx]) || undefined : undefined,
      type: idx === 0 ? 'takeoff' : idx === dataLines.length - 1 ? 'landing' : 'waypoint',
    })
  }

  return points
}

// Calculate bounds from trajectory
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

  // Add padding
  const latPad = (maxLat - minLat) * 0.1 || 0.01
  const lngPad = (maxLng - minLng) * 0.1 || 0.01

  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ]
}

function CloseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--text-secondary)]">Loading trajectory...</p>
    </div>
  )
}

export function TrajectoryMapViewer({ planId, planName, onClose, className = '' }: TrajectoryMapViewerProps) {
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [showLabels, setShowLabels] = useState(true)
  const [selectedPoint, setSelectedPoint] = useState<TrajectoryPoint | null>(null)

  // Fetch trajectory data
  useEffect(() => {
    async function fetchTrajectory() {
      setLoading(true)
      setError(null)

      try {
        const token = localStorage.getItem('authToken')
        const headers: Record<string, string> = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        // First get the plan to find csvResult
        const planRes = await fetch(`/api/flightPlans/${planId}`, { headers })
        if (!planRes.ok) throw new Error('Error loading plan')
        
        const plan = await planRes.json()
        if (!plan.csvResult?.id) {
          throw new Error('No processed trajectory available')
        }

        // Fetch the CSV content
        const csvRes = await fetch(`/api/csvResult/${plan.csvResult.id}`, { headers })
        if (!csvRes.ok) throw new Error('Error loading CSV')
        
        const data = await csvRes.json()
        const content = data.content || data.csvContent || ''
        setCsvContent(content)
        
        const points = parseCSVToTrajectory(content)
        if (points.length === 0) {
          throw new Error('No valid trajectory data in CSV')
        }
        
        setTrajectory(points)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTrajectory()
  }, [planId])

  // Calculate map bounds
  const bounds = useMemo(() => calculateBounds(trajectory), [trajectory])
  const center = useMemo(() => {
    if (trajectory.length === 0) return [40.4168, -3.7038] as [number, number] // Madrid default
    const lat = trajectory.reduce((sum, p) => sum + p.lat, 0) / trajectory.length
    const lng = trajectory.reduce((sum, p) => sum + p.lng, 0) / trajectory.length
    return [lat, lng] as [number, number]
  }, [trajectory])

  // Download CSV function
  const handleDownload = () => {
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
  }

  // Create polyline positions
  const polylinePositions = trajectory.map(p => [p.lat, p.lng] as [number, number])

  // Color for point based on type
  function getPointColor(type?: string): string {
    switch (type) {
      case 'takeoff': return '#22c55e' // green
      case 'landing': return '#ef4444' // red
      default: return '#3b82f6' // blue
    }
  }

  return (
    <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 ${className}`}>
      <div className="bg-[var(--bg-primary)] rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Trajectory: {planName || 'Unnamed'}
            </h2>
            {trajectory.length > 0 && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {trajectory.length} points · 
                {trajectory[0]?.alt && ` ${Math.round(trajectory[0].alt)}m altitude`}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Toggle labels */}
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show numbers
            </label>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={!csvContent}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download CSV"
            >
              <DownloadIcon />
              <span className="hidden sm:inline">CSV</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Map container */}
        <div className="flex-1 relative">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={15}
              bounds={bounds || undefined}
              className="w-full h-full"
              style={{ background: '#f3f4f6' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Trajectory line */}
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#3b82f6',
                  weight: 3,
                  opacity: 0.8,
                }}
              />

              {/* Trajectory points */}
              {trajectory.map((point, idx) => (
                <CircleMarker
                  key={idx}
                  center={[point.lat, point.lng]}
                  radius={idx === 0 || idx === trajectory.length - 1 ? 10 : 6}
                  pathOptions={{
                    color: getPointColor(point.type),
                    fillColor: getPointColor(point.type),
                    fillOpacity: 0.8,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => setSelectedPoint(point),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold">
                        {idx === 0 ? '🛫 Takeoff' : idx === trajectory.length - 1 ? '🛬 Landing' : `Point ${idx + 1}`}
                      </p>
                      <p>Lat: {point.lat.toFixed(6)}</p>
                      <p>Lng: {point.lng.toFixed(6)}</p>
                      {point.alt !== undefined && <p>Alt: {point.alt.toFixed(1)}m</p>}
                      {point.speed !== undefined && <p>Speed: {point.speed.toFixed(1)}m/s</p>}
                      {point.time !== undefined && <p>T: {point.time.toFixed(1)}s</p>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Stats footer */}
        {!loading && !error && trajectory.length > 0 && (
          <div className="px-6 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)]">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6 text-[var(--text-secondary)]">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  Takeoff
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  Trajectory
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full" />
                  Landing
                </span>
              </div>
              {selectedPoint && (
                <div className="text-[var(--text-primary)]">
                  Selected point: ({selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)})
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrajectoryMapViewer
