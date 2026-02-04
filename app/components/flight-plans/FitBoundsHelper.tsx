'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  type?: 'takeoff' | 'cruise' | 'landing'
}

/**
 * Component to auto-fit map bounds to all waypoints
 * TASK-073: Auto-center map on all waypoints in MapModal
 * 
 * This component must be rendered inside a MapContainer.
 * It uses the useMap hook to access the Leaflet map instance
 * and calls fitBounds to ensure all waypoints are visible.
 */
export function FitBoundsToWaypoints({ waypoints }: { waypoints: Waypoint[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (!map || waypoints.length === 0) return
    
    // Calculate bounds with padding
    const lats = waypoints.map(w => w.lat)
    const lngs = waypoints.map(w => w.lng)
    
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    
    // Add 10% padding to ensure waypoints aren't at the edge
    const latPad = (maxLat - minLat) * 0.1 || 0.001
    const lngPad = (maxLng - minLng) * 0.1 || 0.001
    
    const bounds: [[number, number], [number, number]] = [
      [minLat - latPad, minLng - lngPad],
      [maxLat + latPad, maxLng + lngPad]
    ]
    
    // Delay fitBounds to ensure map is fully rendered
    const timer = setTimeout(() => {
      map.fitBounds(bounds, { padding: [20, 20] })
      // Invalidate size after fit to ensure proper rendering
      map.invalidateSize()
    }, 150)
    
    return () => clearTimeout(timer)
  }, [map, waypoints])
  
  return null
}

export default FitBoundsToWaypoints
