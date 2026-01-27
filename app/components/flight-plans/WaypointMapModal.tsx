'use client'

import React, { useMemo, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Modal } from '../ui/modal'

// Dynamic import of Leaflet components to avoid SSR issues
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
const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
)

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  type?: 'takeoff' | 'cruise' | 'landing'
}

export interface WaypointMapModalProps {
  open: boolean
  onClose: () => void
  title: string
  waypoints: Waypoint[]
  planName?: string
}

/**
 * WaypointMapModal - Displays waypoints on an interactive street map
 * Shows the flight path with colored waypoint markers (green=takeoff, blue=cruise, red=landing)
 */
export function WaypointMapModal({ 
  open, 
  onClose, 
  title, 
  waypoints,
  planName 
}: WaypointMapModalProps) {
  const [isClient, setIsClient] = useState(false)

  // Only render map on client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Calculate map center and bounds
  const { center, polylinePath } = useMemo(() => {
    if (waypoints.length === 0) {
      return { 
        center: [39.4567, -0.3527] as [number, number], // Valencia default
        polylinePath: [] 
      }
    }

    const lats = waypoints.map(w => w.lat)
    const lngs = waypoints.map(w => w.lng)
    
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
    
    const path = waypoints.map(w => [w.lat, w.lng] as [number, number])
    
    return { 
      center: [centerLat, centerLng] as [number, number],
      polylinePath: path
    }
  }, [waypoints])

  // Keyboard handler for escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  // Get color for waypoint type
  const getWaypointColor = (type?: string, index?: number, total?: number) => {
    if (type === 'takeoff' || index === 0) return '#22c55e' // green
    if (type === 'landing' || (total && index === total - 1)) return '#ef4444' // red
    return '#3b82f6' // blue for cruise
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="w-full min-w-[320px] sm:min-w-[500px] md:min-w-[700px] lg:min-w-[800px] max-w-[95vw]">
        {/* Plan name if provided */}
        {planName && (
          <div className="mb-3 text-sm text-[var(--text-secondary)]">
            <span className="font-semibold">Plan:</span> {planName}
          </div>
        )}

        {/* Map container */}
        {isClient && waypoints.length > 0 ? (
          <div className="h-[350px] sm:h-[400px] lg:h-[450px] rounded-lg overflow-hidden border border-[var(--border-primary)] relative">
            <MapContainer
              center={center}
              zoom={15}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            >
              {/* Street map tile layer */}
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {/* Flight path polyline */}
              {polylinePath.length > 1 && (
                <Polyline 
                  positions={polylinePath} 
                  color="#3b82f6" 
                  weight={3}
                  opacity={0.8}
                />
              )}
              
              {/* Waypoint markers */}
              {waypoints.map((wp, idx) => {
                const color = getWaypointColor(wp.type, idx, waypoints.length)
                const label = wp.type === 'takeoff' ? 'Takeoff' : 
                             wp.type === 'landing' ? 'Landing' : 
                             `Waypoint ${idx}`
                return (
                  <CircleMarker
                    key={idx}
                    center={[wp.lat, wp.lng]}
                    radius={8}
                    pathOptions={{ 
                      color: color, 
                      fillColor: color, 
                      fillOpacity: 0.8,
                      weight: 2
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      <div className="text-xs">
                        <div className="font-semibold">{label}</div>
                        <div>Lat: {wp.lat.toFixed(6)}</div>
                        <div>Lng: {wp.lng.toFixed(6)}</div>
                        <div>Alt: {wp.alt}m</div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center bg-[var(--bg-tertiary)] rounded-lg">
            {waypoints.length === 0 ? (
              <span className="text-[var(--text-muted)]">No waypoints available</span>
            ) : (
              <span className="text-[var(--text-muted)]">Loading map...</span>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-[var(--text-secondary)]">Takeoff</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-[var(--text-secondary)]">Waypoint</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-[var(--text-secondary)]">Landing</span>
          </div>
        </div>

        {/* Waypoint count */}
        <div className="mt-3 text-center text-xs text-[var(--text-muted)]">
          {waypoints.length} waypoints total
        </div>
      </div>
    </Modal>
  )
}

export default WaypointMapModal
