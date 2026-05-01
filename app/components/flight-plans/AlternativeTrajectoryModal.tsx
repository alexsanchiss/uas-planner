'use client'

import React, { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Modal } from '../ui/modal'
import { useI18n } from '@/app/i18n'

export interface AlternativeTrajectoryModalProps {
  open: boolean
  onClose: () => void
  currentWaypoints: Array<{ lat: number; lon: number; alt?: number }>
  alternativeWaypoints: Array<{ lat: number; lon: number; alt?: number }>
  onAccept: () => void
  onReject: () => void
  isProcessing?: boolean
}

/** Fit map bounds to the union of both waypoint lists */
function FitBoundsHandler({
  allCoords,
}: {
  allCoords: [number, number][]
}) {
  const map = useMap()

  useEffect(() => {
    if (allCoords.length === 0) return
    const lats = allCoords.map((c) => c[0])
    const lngs = allCoords.map((c) => c[1])
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

export function AlternativeTrajectoryModal({
  open,
  onClose,
  currentWaypoints,
  alternativeWaypoints,
  onAccept,
  onReject,
  isProcessing = false,
}: AlternativeTrajectoryModalProps) {
  const { t } = useI18n()

  const currentLatLngs = useMemo<[number, number][]>(
    () => currentWaypoints.map((wp) => [wp.lat, wp.lon]),
    [currentWaypoints]
  )

  const alternativeLatLngs = useMemo<[number, number][]>(
    () => alternativeWaypoints.map((wp) => [wp.lat, wp.lon]),
    [alternativeWaypoints]
  )

  const allCoords = useMemo<[number, number][]>(
    () => [...currentLatLngs, ...alternativeLatLngs],
    [currentLatLngs, alternativeLatLngs]
  )

  const center = useMemo<[number, number]>(() => {
    if (allCoords.length === 0) return [39.47, -0.38]
    return [
      allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length,
      allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length,
    ]
  }, [allCoords])

  if (!open) return null

  const hasContent = currentLatLngs.length > 0 || alternativeLatLngs.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.flightPlans.alternativeTrajectory}
      maxWidth="4xl"
    >
      {/* Map */}
      {hasContent ? (
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
        </div>
      ) : (
        <div className="w-full h-48 mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">
            {t.flightPlans.noSpatialData}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 rounded bg-blue-500 border border-blue-500" style={{ height: '4px' }}></div>
          <span className="text-[var(--text-secondary)]">{t.flightPlans.currentRoute}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 rounded bg-green-500"
            style={{ height: '4px', backgroundImage: 'repeating-linear-gradient(to right, #22c55e 0, #22c55e 8px, transparent 8px, transparent 12px)' }}
          ></div>
          <span className="text-[var(--text-secondary)]">{t.flightPlans.proposedRoute}</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-5 flex flex-wrap justify-center gap-6 text-sm text-[var(--text-secondary)]">
        <span>
          {t.flightPlans.currentRoute}:{' '}
          <span className="font-semibold text-blue-500">
            {t.flightPlans.waypointsCount.replace('{n}', String(currentWaypoints.length))}
          </span>
        </span>
        <span>
          {t.flightPlans.proposedRoute}:{' '}
          <span className="font-semibold text-green-500">
            {t.flightPlans.waypointsCount.replace('{n}', String(alternativeWaypoints.length))}
          </span>
        </span>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onReject}
          disabled={isProcessing}
          className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-700 text-[var(--text-primary)] hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t.flightPlans.rejectAlternative}
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={isProcessing}
          className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isProcessing && (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {t.flightPlans.acceptAlternative}
        </button>
      </div>
    </Modal>
  )
}

export default AlternativeTrajectoryModal
