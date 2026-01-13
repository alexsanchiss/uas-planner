'use client'

import React from 'react'

export interface GeoawarenessViewerProps {
  planId?: string
  trajectoryData?: unknown
  geozones?: unknown[]
  violations?: unknown[]
  isLoading?: boolean
  className?: string
}

/**
 * GeoawarenessViewer - Placeholder component for geoawareness map visualization
 * 
 * This component will be enhanced later to display:
 * - Flight trajectory on a map
 * - Geozones (restricted airspace, no-fly zones)
 * - Violations highlighted in red
 * - Interactive zoom and pan
 */
export function GeoawarenessViewer({
  planId,
  trajectoryData,
  geozones = [],
  violations = [],
  isLoading = false,
  className = '',
}: GeoawarenessViewerProps) {
  const hasViolations = violations.length > 0

  return (
    <div
      className={`relative bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
      style={{ minHeight: '300px' }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
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
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading geoawareness data...</span>
          </div>
        </div>
      )}

      {/* Placeholder content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {/* Map icon placeholder */}
        <svg
          className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4"
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

        <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Geoawareness Map
        </h4>

        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          {planId
            ? 'Map visualization will display trajectory and geozones'
            : 'Select a flight plan to view geoawareness data'}
        </p>

        {/* Status indicator */}
        {planId && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                hasViolations
                  ? 'bg-red-500'
                  : geozones.length > 0
                  ? 'bg-green-500'
                  : 'bg-gray-400'
              }`}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {hasViolations
                ? `${violations.length} violation(s) detected`
                : geozones.length > 0
                ? 'No violations'
                : 'No data loaded'}
            </span>
          </div>
        )}

        {/* Legend placeholder */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-gray-600 dark:text-gray-400">Trajectory</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded opacity-50" />
            <span className="text-gray-600 dark:text-gray-400">Restricted Zone</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded opacity-50" />
            <span className="text-gray-600 dark:text-gray-400">No-Fly Zone</span>
          </div>
        </div>
      </div>

      {/* Future: Actual map component will be rendered here */}
      {/* <MapComponent data={trajectoryData} geozones={geozones} violations={violations} /> */}
    </div>
  )
}

export default GeoawarenessViewer
