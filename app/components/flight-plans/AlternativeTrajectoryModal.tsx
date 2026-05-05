'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Modal } from '../ui/modal'
import type { AlternativeTrajectoryMapContentProps } from './AlternativeTrajectoryMapContent'

const AlternativeTrajectoryMapContent = dynamic<AlternativeTrajectoryMapContentProps>(
  () => import('./AlternativeTrajectoryMapContent'),
  { ssr: false },
)

export interface AlternativeTrajectoryModalProps {
  open: boolean
  onClose: () => void
  currentWaypoints: Array<{ lat: number; lon: number; alt?: number }>
  alternativeWaypoints: Array<{ lat: number; lon: number; alt?: number }>
  onAccept: () => void
  onReject: () => void
  isProcessing?: boolean
}

function isValidCoord(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v) && isFinite(v)
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
  const currentLatLngs = useMemo<[number, number][]>(
    () =>
      currentWaypoints
        .filter((wp) => isValidCoord(wp.lat) && isValidCoord(wp.lon))
        .map((wp) => [wp.lat, wp.lon]),
    [currentWaypoints],
  )

  const alternativeLatLngs = useMemo<[number, number][]>(
    () =>
      alternativeWaypoints
        .filter((wp) => isValidCoord(wp.lat) && isValidCoord(wp.lon))
        .map((wp) => [wp.lat, wp.lon]),
    [alternativeWaypoints],
  )

  const allCoords = useMemo<[number, number][]>(
    () => [...currentLatLngs, ...alternativeLatLngs],
    [currentLatLngs, alternativeLatLngs],
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
    <Modal open={open} onClose={onClose} title="Alternative trajectory" maxWidth="4xl" overlayZIndex="z-[60]">
      {/* Map */}
      {hasContent ? (
        <div className="w-full h-[50vh] md:h-[450px] max-h-[70vh] min-h-[200px] mb-4 relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <AlternativeTrajectoryMapContent
            currentLatLngs={currentLatLngs}
            alternativeLatLngs={alternativeLatLngs}
            allCoords={allCoords}
            center={center}
          />
        </div>
      ) : (
        <div className="w-full h-48 mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">
            No spatial data available to display.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 rounded bg-blue-500" style={{ height: '4px' }} />
          <span className="text-[var(--text-secondary)]">Current route</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 rounded bg-green-500"
            style={{
              height: '4px',
              backgroundImage:
                'repeating-linear-gradient(to right, #22c55e 0, #22c55e 8px, transparent 8px, transparent 12px)',
            }}
          />
          <span className="text-[var(--text-secondary)]">Proposed route (SCRS)</span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onReject}
          disabled={isProcessing}
          className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-700 text-[var(--text-primary)] hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Reject alternative
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
          Accept alternative
        </button>
      </div>
    </Modal>
  )
}

export default AlternativeTrajectoryModal
