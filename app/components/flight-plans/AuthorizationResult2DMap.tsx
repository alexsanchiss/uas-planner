'use client'

import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap } from 'leaflet'

export interface VolumePoly {
  coords: [number, number][]
  idx: number
  ordinal: number
  label: string
  isConflicting: boolean
  timeBegin?: string
  timeEnd?: string
  minAlt: string
  maxAlt: string
}

export interface GeozonePoly {
  coords: [number, number][]
  identifier: string
  name: string
  type: string
  info: string
  isConflicting: boolean
}

export interface Auth2DMapProps {
  center2D: [number, number]
  volCoords2D: [number, number][]
  isApproved: boolean
  operationVolumes2D: VolumePoly[]
  geozonePolygons2D: GeozonePoly[]
}

const GEOZONE_COLORS: Record<string, string> = {
  'U-SPACE':           '#e41a1c',
  'PROHIBITED':        '#4daf4a',
  'REQ_AUTHORIZATION': '#ff7f00',
  'CONDITIONAL':       '#a65628',
  'NO_RESTRICTION':    '#999999',
}

function getGeozoneColor(type: string | undefined): string {
  if (!type) return '#999999'
  return GEOZONE_COLORS[type.toUpperCase()] || '#999999'
}

function FitBoundsHandler({ allCoords }: { allCoords: [number, number][] }) {
  const map = useMap()
  const fittedRef = useRef(false)
  useEffect(() => {
    if (fittedRef.current || allCoords.length === 0) return
    const lats = allCoords.map(c => c[0])
    const lngs = allCoords.map(c => c[1])
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

export default function Auth2DMap({
  center2D,
  volCoords2D,
  isApproved,
  operationVolumes2D,
  geozonePolygons2D,
}: Auth2DMapProps) {
  const mapRef = useRef<LeafletMap | null>(null)

  // react-leaflet v4 sets context via setState inside a ref callback, so its
  // own useEffect cleanup has context=null on the first render and skips
  // map.remove() during React 18 StrictMode's mount→cleanup→remount cycle.
  // This ensures the DOM node is always clean on unmount.
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
      center={center2D}
      zoom={14}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%' }}
    >
      <FitBoundsHandler allCoords={volCoords2D} />
      <MapResizeHandler />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {operationVolumes2D.map(vol => {
        let color: string, fillColor: string, fillOpacity: number, weight: number
        if (isApproved) {
          color = '#16a34a'; fillColor = '#22c55e'; fillOpacity = 0.35; weight = 2
        } else if (vol.isConflicting) {
          color = '#dc2626'; fillColor = '#ef4444'; fillOpacity = 0.4; weight = 3
        } else {
          color = '#3b82f6'; fillColor = '#60a5fa'; fillOpacity = 0.2; weight = 1.5
        }
        return (
          <Polygon
            key={`vol-${vol.idx}`}
            positions={vol.coords}
            pathOptions={{ color, fillColor, fillOpacity, weight }}
          >
            <Tooltip direction="top" offset={[0, -10]} sticky>
              <div className="text-xs min-w-[140px]">
                <div className={`font-semibold mb-1 ${
                  isApproved ? 'text-green-600' : vol.isConflicting ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {vol.label} {isApproved ? '✓ Authorized' : vol.isConflicting ? '⚠ Conflicting' : '✓ OK'}
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-500">Ordinal:</span>
                  <span>{vol.ordinal}</span>
                  {vol.timeBegin && (
                    <>
                      <span className="text-gray-500">Start:</span>
                      <span>{new Date(vol.timeBegin).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                    </>
                  )}
                  {vol.timeEnd && (
                    <>
                      <span className="text-gray-500">End:</span>
                      <span>{new Date(vol.timeEnd).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                    </>
                  )}
                  <span className="text-gray-500">Alt:</span>
                  <span>{vol.minAlt} — {vol.maxAlt}</span>
                </div>
              </div>
            </Tooltip>
          </Polygon>
        )
      })}
      {geozonePolygons2D.map((gz, idx) => {
        const typeColor = getGeozoneColor(gz.type?.toUpperCase())
        const color = gz.isConflicting ? '#dc2626' : typeColor
        const fillColor = gz.isConflicting ? '#ef4444' : typeColor
        return (
          <Polygon
            key={`gz-${idx}`}
            positions={gz.coords}
            pathOptions={{
              color,
              fillColor,
              fillOpacity: gz.isConflicting ? 0.4 : 0.25,
              weight: gz.isConflicting ? 3 : 1.5,
              dashArray: gz.isConflicting ? '8 4' : undefined,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} sticky>
              <div className="text-xs min-w-[140px]">
                <div className="font-semibold mb-1" style={{ color: gz.isConflicting ? '#b91c1c' : typeColor }}>
                  {gz.isConflicting ? '🚫 ' : '📍 '}{gz.identifier}
                </div>
                {gz.name && <div className="text-gray-600 mb-1">{gz.name}</div>}
                <div><span className="text-gray-500">Type:</span> {gz.type}</div>
                {gz.isConflicting && <div className="text-red-600 font-medium mt-1">⚠ Conflicting</div>}
              </div>
            </Tooltip>
          </Polygon>
        )
      })}
    </MapContainer>
  )
}
