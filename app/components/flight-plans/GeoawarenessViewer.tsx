'use client'

import React, { useState, useCallback } from 'react'

// Geozone types for the legend and visualization
export type GeozoneType = 
  | 'prohibited'      // No-fly zone (red)
  | 'restricted'      // Restricted airspace (orange)
  | 'controlled'      // Controlled airspace (yellow)
  | 'advisory'        // Advisory zone (blue)
  | 'warning'         // Warning area (purple)
  | 'temporary'       // Temporary restriction (gray striped)

export interface Geozone {
  id: string
  name: string
  type: GeozoneType
  geometry?: unknown
  altitude?: { min: number; max: number }
  active?: boolean
}

export interface Violation {
  id: string
  geozoneId: string
  geozoneName: string
  geozoneType: GeozoneType
  severity: 'critical' | 'warning' | 'info'
  message: string
  waypointIndex?: number
}

export interface GeoawarenessViewerProps {
  planId?: string
  planName?: string
  trajectoryData?: unknown
  geozones?: Geozone[]
  violations?: Violation[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
}

// Color mapping for geozone types
const GEOZONE_COLORS: Record<GeozoneType, { bg: string; border: string; label: string }> = {
  prohibited: { bg: 'bg-red-500', border: 'border-red-600', label: 'Prohibited (No-Fly)' },
  restricted: { bg: 'bg-orange-500', border: 'border-orange-600', label: 'Restricted Airspace' },
  controlled: { bg: 'bg-yellow-500', border: 'border-yellow-600', label: 'Controlled Airspace' },
  advisory: { bg: 'bg-blue-400', border: 'border-blue-500', label: 'Advisory Zone' },
  warning: { bg: 'bg-purple-500', border: 'border-purple-600', label: 'Warning Area' },
  temporary: { bg: 'bg-gray-500', border: 'border-gray-600', label: 'Temporary Restriction' },
}

// Severity colors for violations
const SEVERITY_COLORS = {
  critical: 'text-red-600 dark:text-red-400',
  warning: 'text-orange-600 dark:text-orange-400',
  info: 'text-blue-600 dark:text-blue-400',
}

/**
 * GeoawarenessViewer - Component for geoawareness map visualization
 * 
 * Features:
 * - Error state handling with retry button (TASK-111, TASK-112, TASK-113)
 * - Trajectory overlay visualization placeholder (TASK-114)
 * - Violated geozone highlighting with colors/patterns (TASK-115)
 * - Comprehensive legend for geozone types (TASK-116)
 */
export function GeoawarenessViewer({
  planId,
  planName,
  trajectoryData,
  geozones = [],
  violations = [],
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}: GeoawarenessViewerProps) {
  const [showLegend, setShowLegend] = useState(true)
  const hasViolations = violations.length > 0
  const hasData = geozones.length > 0 || trajectoryData

  // Get violated geozone IDs for highlighting
  const violatedGeozoneIds = new Set(violations.map(v => v.geozoneId))

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry()
    }
  }, [onRetry])

  return (
    <div
      className={`relative bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
      style={{ minHeight: '400px' }}
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
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Loading geoawareness data...
            </span>
          </div>
        </div>
      )}

      {/* Error state (TASK-111, TASK-112, TASK-113) */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-10 bg-white/95 dark:bg-gray-900/95">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            {/* Error icon */}
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Geoawareness Error
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Failed to load geoawareness data
                {planName && <span className="font-medium"> for &ldquo;{planName}&rdquo;</span>}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">
                {error}
              </p>
            </div>

            {/* Retry button (TASK-113) */}
            {onRetry && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map placeholder content (TASK-114) */}
      {!error && (
        <div className="absolute inset-0 flex flex-col">
          {/* Map area - placeholder for actual map integration */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900">
            {/* Simulated map grid pattern */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Placeholder trajectory line (TASK-114) */}
            {planId && Boolean(trajectoryData) && (
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                  </marker>
                </defs>
                {/* Sample trajectory path */}
                <path
                  d="M 10% 70% Q 25% 40%, 40% 50% T 60% 35% T 85% 25%"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="none"
                  markerEnd="url(#arrowhead)"
                  className="drop-shadow-md"
                />
                {/* Waypoint markers */}
                <circle cx="10%" cy="70%" r="6" fill="#22c55e" stroke="white" strokeWidth="2" />
                <circle cx="40%" cy="50%" r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                <circle cx="60%" cy="35%" r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                <circle cx="85%" cy="25%" r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
              </svg>
            )}

            {/* Sample geozone overlays (TASK-115) */}
            {planId && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Restricted zone example - orange with pattern for violations */}
                <div
                  className={`absolute w-24 h-24 rounded-full border-2 ${
                    hasViolations ? 'border-red-500 bg-red-500/30' : 'border-orange-400 bg-orange-400/20'
                  }`}
                  style={{ top: '30%', left: '35%', transform: 'translate(-50%, -50%)' }}
                >
                  {hasViolations && (
                    <div className="absolute inset-0 rounded-full animate-pulse bg-red-500/20" />
                  )}
                </div>

                {/* Advisory zone example */}
                <div
                  className="absolute w-32 h-20 rounded-lg border-2 border-blue-400 bg-blue-400/15"
                  style={{ top: '60%', right: '15%', transform: 'translate(0, -50%)' }}
                />

                {/* Controlled airspace example */}
                <div
                  className="absolute border-2 border-yellow-400 bg-yellow-400/15"
                  style={{
                    top: '15%',
                    left: '55%',
                    width: '80px',
                    height: '60px',
                    borderRadius: '8px',
                  }}
                />
              </div>
            )}

            {/* Center content when no plan selected */}
            {!planId && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
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
                  Select a flight plan to view trajectory and geoawareness data
                </p>
              </div>
            )}

            {/* Plan info overlay */}
            {planId && (
              <div className="absolute top-3 left-3 bg-white/90 dark:bg-gray-800/90 rounded-lg px-3 py-2 shadow-md backdrop-blur-sm">
                <div className="text-xs text-gray-500 dark:text-gray-400">Flight Plan</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {planName || planId}
                </div>
              </div>
            )}

            {/* Status indicator */}
            {planId && (
              <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-800/90 rounded-lg px-3 py-2 shadow-md backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      hasViolations
                        ? 'bg-red-500 animate-pulse'
                        : hasData
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {hasViolations
                      ? `${violations.length} Violation${violations.length !== 1 ? 's' : ''}`
                      : hasData
                      ? 'Clear'
                      : 'No Data'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Violations list (TASK-115) */}
          {hasViolations && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Airspace Violations Detected
                </span>
              </div>
              <ul className="space-y-1 max-h-24 overflow-y-auto">
                {violations.map((v) => (
                  <li
                    key={v.id}
                    className={`text-xs ${SEVERITY_COLORS[v.severity]} flex items-start gap-1`}
                  >
                    <span className="font-medium">{v.geozoneName}:</span>
                    <span className="text-gray-600 dark:text-gray-400">{v.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legend (TASK-116) */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center justify-between w-full text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>Map Legend</span>
              <svg
                className={`w-4 h-4 transition-transform ${showLegend ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLegend && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                {/* Trajectory markers */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-0.5 bg-blue-500 rounded" />
                  <span className="text-gray-600 dark:text-gray-400">Trajectory</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-green-500 rounded-full border border-white shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">Start Point</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-blue-500 rounded-full border border-white shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">Waypoint</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">End Point</span>
                </div>

                {/* Geozone types - comprehensive legend (TASK-116) */}
                {Object.entries(GEOZONE_COLORS).map(([type, config]) => (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-3 h-3 ${config.bg} ${config.border} border rounded opacity-70`}
                      style={type === 'temporary' ? {
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'
                      } : undefined}
                    />
                    <span className="text-gray-600 dark:text-gray-400">{config.label}</span>
                  </div>
                ))}

                {/* Violation indicator */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-red-500/30 border-2 border-red-500 rounded animate-pulse" />
                  <span className="text-gray-600 dark:text-gray-400">Violation Zone</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GeoawarenessViewer
