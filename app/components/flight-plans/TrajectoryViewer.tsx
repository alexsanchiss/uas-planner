'use client'

import React from 'react'

export interface TrajectoryViewerProps {
  planId?: string
  trajectoryData?: unknown
  waypoints?: Array<{ lat: number; lng: number; alt: number }>
  isLoading?: boolean
  showPlayback?: boolean
  className?: string
}

/**
 * TrajectoryViewer - Placeholder component for trajectory visualization
 * 
 * This component will be enhanced later to display:
 * - 2D/3D trajectory visualization on a map
 * - Waypoint markers with altitude indicators
 * - Flight path animation/playback
 * - Speed and altitude profiles
 */
export function TrajectoryViewer({
  planId,
  trajectoryData,
  waypoints = [],
  isLoading = false,
  showPlayback = false,
  className = '',
}: TrajectoryViewerProps) {
  const hasTrajectory = waypoints.length > 0 || trajectoryData !== undefined

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
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading trajectory...</span>
          </div>
        </div>
      )}

      {/* Placeholder content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {/* Trajectory icon placeholder */}
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
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>

        <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Trajectory Viewer
        </h4>

        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          {planId
            ? 'Map will display the flight trajectory and waypoints'
            : 'Select a flight plan to view its trajectory'}
        </p>

        {/* Waypoint count */}
        {waypoints.length > 0 && (
          <div className="mt-4 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <span className="text-sm text-blue-700 dark:text-blue-400">
              {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Playback controls placeholder */}
        {showPlayback && hasTrajectory && (
          <div className="mt-6 flex items-center gap-3">
            <button
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Rewind"
              disabled
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14V6a1 1 0 00-1.555-.832l-5 3.333a1 1 0 000 1.664l5 3.333z" />
                <path d="M15.445 14.832A1 1 0 0017 14V6a1 1 0 00-1.555-.832l-5 3.333a1 1 0 000 1.664l5 3.333z" />
              </svg>
            </button>
            <button
              className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              aria-label="Play"
              disabled
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Fast forward"
              disabled
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832l5-3.333a1 1 0 000-1.664l-5-3.333z" />
                <path d="M11.555 5.168A1 1 0 0010 6v8a1 1 0 001.555.832l5-3.333a1 1 0 000-1.664l-5-3.333z" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats placeholder */}
        {hasTrajectory && (
          <div className="mt-6 grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <div className="text-gray-400 dark:text-gray-500">Distance</div>
              <div className="font-medium text-gray-700 dark:text-gray-300">--</div>
            </div>
            <div>
              <div className="text-gray-400 dark:text-gray-500">Duration</div>
              <div className="font-medium text-gray-700 dark:text-gray-300">--</div>
            </div>
            <div>
              <div className="text-gray-400 dark:text-gray-500">Max Alt</div>
              <div className="font-medium text-gray-700 dark:text-gray-300">--</div>
            </div>
          </div>
        )}
      </div>

      {/* Future: Actual map component will be rendered here */}
      {/* <MapComponent trajectory={trajectoryData} waypoints={waypoints} /> */}
    </div>
  )
}

export default TrajectoryViewer
