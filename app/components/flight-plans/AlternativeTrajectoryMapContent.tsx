'use client'

import React, { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'

export interface AlternativeTrajectoryMapContentProps {
  currentLatLngs: [number, number][]
  alternativeLatLngs: [number, number][]
  allCoords: [number, number][]
  center: [number, number]
}

function FitBoundsHandler({ allCoords }: { allCoords: [number, number][] }) {
  const map = useMap()
  const fittedRef = useRef(false)
  useEffect(() => {
    if (fittedRef.current || allCoords.length === 0) return
    const lats = allCoords.map((c) => c[0])
    const lngs = allCoords.map((c) => c[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]
    map.fitBounds(bounds, { padding: [40, 40] })
    fittedRef.current = true
  }, [map, allCoords])
  return null
}

function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [map])
  return null
}

export default function AlternativeTrajectoryMapContent({
  currentLatLngs,
  alternativeLatLngs,
  allCoords,
  center,
}: AlternativeTrajectoryMapContentProps) {
  const mapRef = useRef<LeafletMap | null>(null)

  // react-leaflet v4 creates the map in a ref callback during commit, so its
  // own useEffect cleanup has context=null on the first render and never calls
  // map.remove() during React 18 StrictMode's mount→cleanup→remount cycle.
  // This explicit cleanup ensures _leaflet_id is always cleared on unmount.
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={14}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%' }}
    >
      <FitBoundsHandler allCoords={allCoords} />
      <MapResizeHandler />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {/* Current route — blue solid */}
      {currentLatLngs.length > 1 && (
        <Polyline
          positions={currentLatLngs}
          pathOptions={{ color: '#3b82f6', weight: 4 }}
        />
      )}
      {currentLatLngs.map((pos, idx) => (
        <CircleMarker
          key={`cur-${idx}`}
          center={pos}
          radius={4}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.85,
            weight: 1,
          }}
        />
      ))}

      {/* Alternative route — green dashed */}
      {alternativeLatLngs.length > 1 && (
        <Polyline
          positions={alternativeLatLngs}
          pathOptions={{
            color: '#22c55e',
            weight: 4,
            dashArray: '8 4',
          }}
        />
      )}
      {alternativeLatLngs.map((pos, idx) => (
        <CircleMarker
          key={`alt-${idx}`}
          center={pos}
          radius={4}
          pathOptions={{
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.85,
            weight: 1,
          }}
        />
      ))}
    </MapContainer>
  )
}
