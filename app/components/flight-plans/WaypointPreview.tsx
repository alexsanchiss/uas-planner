'use client'

import React, { useMemo } from 'react'

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  type?: 'takeoff' | 'cruise' | 'landing'
}

export interface WaypointPreviewProps {
  waypoints: Waypoint[]
  className?: string
  /** Show as mini preview (smaller, less detail) */
  mini?: boolean
}

/**
 * WaypointPreview - Shows a visual representation of waypoints
 * Can be used as a mini preview in plan cards or expanded view
 */
export function WaypointPreview({ waypoints, className = '', mini = false }: WaypointPreviewProps) {
  // Calculate bounds and normalized positions
  const { normalizedWaypoints, bounds } = useMemo(() => {
    if (waypoints.length === 0) {
      return { normalizedWaypoints: [], bounds: null }
    }

    const lats = waypoints.map(w => w.lat)
    const lngs = waypoints.map(w => w.lng)
    
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    
    // Add padding
    const latPadding = (maxLat - minLat) * 0.15 || 0.001
    const lngPadding = (maxLng - minLng) * 0.15 || 0.001
    
    const bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    }
    
    const latRange = bounds.maxLat - bounds.minLat
    const lngRange = bounds.maxLng - bounds.minLng
    
    const normalized = waypoints.map((w, idx) => ({
      ...w,
      x: ((w.lng - bounds.minLng) / lngRange) * 100,
      y: 100 - ((w.lat - bounds.minLat) / latRange) * 100, // Invert Y for SVG
      index: idx,
    }))
    
    return { normalizedWaypoints: normalized, bounds }
  }, [waypoints])

  if (waypoints.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded ${mini ? 'h-12 w-16' : 'h-32'} ${className}`}>
        <span className="text-xs text-gray-400">Sin waypoints</span>
      </div>
    )
  }

  // Generate path
  const pathD = normalizedWaypoints.length > 1
    ? `M ${normalizedWaypoints.map(w => `${w.x} ${w.y}`).join(' L ')}`
    : ''

  const markerSize = mini ? 3 : 5
  const strokeWidth = mini ? 1.5 : 2

  return (
    <div className={`relative bg-gray-100 dark:bg-gray-800 rounded overflow-hidden ${mini ? 'h-12 w-16' : 'h-32'} ${className}`}>
      <svg 
        viewBox="0 0 100 100" 
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Path connecting waypoints */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Waypoint markers */}
        {normalizedWaypoints.map((w, idx) => {
          const isFirst = idx === 0
          const isLast = idx === normalizedWaypoints.length - 1
          const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6'
          
          return (
            <circle
              key={idx}
              cx={w.x}
              cy={w.y}
              r={markerSize}
              fill={color}
              stroke="white"
              strokeWidth={mini ? 0.5 : 1}
            />
          )
        })}
      </svg>
      
      {/* Waypoint count badge */}
      {!mini && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-white font-medium">
          {waypoints.length} pts
        </div>
      )}
    </div>
  )
}

export default WaypointPreview
