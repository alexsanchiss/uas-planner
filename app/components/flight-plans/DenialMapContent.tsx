'use client'

import React, { useEffect } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'
import { useMap } from 'react-leaflet'
import { useI18n } from '@/app/i18n'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Polygon = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polygon),
  { ssr: false }
)
const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
)

/** Fit map bounds to all rendered polygons */
function FitBoundsHandler({ allCoords }: { allCoords: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (allCoords.length === 0) return
    const lats = allCoords.map(c => c[0])
    const lngs = allCoords.map(c => c[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]
    map.fitBounds(bounds, { padding: [40, 40] })
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

export interface OperationVolumeRendered {
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

export interface GeozonePolygonRendered {
  coords: [number, number][]
  identifier: string
  name: string
  type: string
  info: string
  raw?: unknown
}

export interface DenialMapContentProps {
  operationVolumes: OperationVolumeRendered[]
  geozonePolygons: GeozonePolygonRendered[]
  center: [number, number]
  allCoords: [number, number][]
  hasContent: boolean
}

export default function DenialMapContent({
  operationVolumes,
  geozonePolygons,
  center,
  allCoords,
  hasContent,
}: DenialMapContentProps) {
  const { t } = useI18n()

  if (!hasContent) {
    return (
      <div className="w-full h-48 mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-[var(--text-secondary)]">
          {t.flightPlans.noSpatialData}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-[50vh] md:h-[450px] max-h-[70vh] min-h-[200px] mb-4 relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <MapContainer
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

        {/* Operation volumes */}
        {operationVolumes.map((vol) => (
          <Polygon
            key={`vol-${vol.idx}`}
            positions={vol.coords}
            pathOptions={{
              color: vol.isConflicting ? '#dc2626' : '#6b7280',
              fillColor: vol.isConflicting ? '#ef4444' : '#9ca3af',
              fillOpacity: vol.isConflicting ? 0.4 : 0.2,
              weight: vol.isConflicting ? 3 : 1.5,
              dashArray: vol.isConflicting ? undefined : '5 5',
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} sticky>
              <div className="text-xs min-w-[140px]">
                <div className={`font-semibold mb-1 ${vol.isConflicting ? 'text-red-600' : 'text-gray-600'}`}>
                  {vol.label} {vol.isConflicting ? `⚠ ${t.flightPlans.conflictingStatus}` : `✓ ${t.flightPlans.okStatus}`}
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-500">{t.flightPlans.ordinal}:</span>
                  <span>{vol.ordinal}</span>
                  {vol.timeBegin && (
                    <>
                      <span className="text-gray-500">{t.flightPlans.startLabel}:</span>
                      <span>{new Date(vol.timeBegin).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                    </>
                  )}
                  {vol.timeEnd && (
                    <>
                      <span className="text-gray-500">{t.flightPlans.endLabel}:</span>
                      <span>{new Date(vol.timeEnd).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                    </>
                  )}
                  <span className="text-gray-500">{t.flightPlans.alt}:</span>
                  <span>{vol.minAlt} — {vol.maxAlt}</span>
                </div>
              </div>
            </Tooltip>
          </Polygon>
        ))}

        {/* Conflicting geozones */}
        {geozonePolygons.map((gz, idx) => (
          <Polygon
            key={`gz-${idx}`}
            positions={gz.coords}
            pathOptions={{
              color: '#b91c1c',
              fillColor: '#f87171',
              fillOpacity: 0.3,
              weight: 2,
              dashArray: '8 4',
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} sticky>
              <div className="text-xs min-w-[140px]">
                <div className="font-semibold text-red-700 mb-1">
                  🚫 {gz.identifier}
                </div>
                {gz.name && (
                  <div className="text-gray-600 mb-1">{gz.name}</div>
                )}
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-500">{t.flightPlans.typeLabel}:</span>
                  <span>{gz.type}</span>
                </div>
              </div>
            </Tooltip>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  )
}
