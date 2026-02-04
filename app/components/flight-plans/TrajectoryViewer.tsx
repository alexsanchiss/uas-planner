'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

/** Available playback speeds */
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export interface TrajectoryViewerProps {
  planId?: string
  trajectoryData?: unknown
  waypoints?: Array<{ lat: number; lng: number; alt: number; time?: number }>
  isLoading?: boolean
  showPlayback?: boolean
  /** Total duration of trajectory in seconds (defaults to 60s if not provided) */
  totalDuration?: number
  className?: string
}

/**
 * Format time in seconds to MM:SS display
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * TrajectoryViewer - Component for trajectory visualization with time-based playback
 * 
 * Features:
 * - Play/pause trajectory playback
 * - Adjustable playback speed (0.5x, 1x, 2x, 4x)
 * - Current time display with progress bar
 * - Visual waypoint markers and path
 */
export function TrajectoryViewer({
  planId,
  trajectoryData,
  waypoints = [],
  isLoading = false,
  showPlayback = false,
  totalDuration = 60,
  className = '',
}: TrajectoryViewerProps) {
  const hasTrajectory = waypoints.length > 0 || trajectoryData !== undefined
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const animationRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number | null>(null)

  // Calculate current waypoint index based on time
  const currentWaypointIndex = waypoints.length > 0 
    ? Math.min(
        Math.floor((currentTime / totalDuration) * waypoints.length),
        waypoints.length - 1
      )
    : 0

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp
    }
    
    const deltaTime = (timestamp - lastTimestampRef.current) / 1000 // Convert to seconds
    lastTimestampRef.current = timestamp
    
    setCurrentTime(prev => {
      const newTime = prev + deltaTime * playbackSpeed
      if (newTime >= totalDuration) {
        setIsPlaying(false)
        return totalDuration
      }
      return newTime
    })
    
    animationRef.current = requestAnimationFrame(animate)
  }, [playbackSpeed, totalDuration])

  // Start/stop animation based on isPlaying
  useEffect(() => {
    if (isPlaying) {
      lastTimestampRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, animate])

  // Reset playback when plan changes
  useEffect(() => {
    setCurrentTime(0)
    setIsPlaying(false)
  }, [planId])

  const togglePlayPause = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0) // Reset if at end
    }
    setIsPlaying(!isPlaying)
  }

  const handleRewind = () => {
    setCurrentTime(0)
    setIsPlaying(false)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickPosition = (e.clientX - rect.left) / rect.width
    setCurrentTime(clickPosition * totalDuration)
  }

  const cycleSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex])
  }

  const progressPercentage = (currentTime / totalDuration) * 100

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

      {/* Main content area */}
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

        {/* Waypoint count with current position */}
        {waypoints.length > 0 && (
          <div className="mt-4 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <span className="text-sm text-blue-700 dark:text-blue-400">
              Waypoint {currentWaypointIndex + 1} of {waypoints.length}
            </span>
          </div>
        )}

        {/* Playback controls - Enhanced with play/pause, speed, and time display */}
        {showPlayback && hasTrajectory && (
          <div className="mt-6 w-full max-w-sm">
            {/* Time display and progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span className="font-mono">{formatTime(currentTime)}</span>
                <span className="font-mono">{formatTime(totalDuration)}</span>
              </div>
              {/* Clickable progress bar */}
              <div 
                className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer overflow-hidden"
                onClick={handleProgressClick}
                role="slider"
                aria-label="Playback progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercentage}
                tabIndex={0}
              >
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-100"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-center gap-3">
              {/* Rewind button */}
              <button
                onClick={handleRewind}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                aria-label="Rewind to start"
                title="Rewind"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.445 14.832A1 1 0 0010 14V6a1 1 0 00-1.555-.832l-5 3.333a1 1 0 000 1.664l5 3.333z" />
                  <path d="M15.445 14.832A1 1 0 0017 14V6a1 1 0 00-1.555-.832l-5 3.333a1 1 0 000 1.664l5 3.333z" />
                </svg>
              </button>

              {/* Play/Pause button */}
              <button
                onClick={togglePlayPause}
                className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-md"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  // Pause icon
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  // Play icon
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Speed control button */}
              <button
                onClick={cycleSpeed}
                className="px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium min-w-[60px]"
                aria-label={`Playback speed: ${playbackSpeed}x. Click to change.`}
                title="Change speed"
              >
                {playbackSpeed}x
              </button>
            </div>

            {/* Speed options display */}
            <div className="mt-3 flex justify-center gap-1">
              {PLAYBACK_SPEEDS.map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  aria-label={`Set speed to ${speed}x`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {hasTrajectory && (
          <div className="mt-6 grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <div className="text-gray-400 dark:text-gray-500">Distance</div>
              <div className="font-medium text-gray-700 dark:text-gray-300">--</div>
            </div>
            <div>
              <div className="text-gray-400 dark:text-gray-500">Duration</div>
              <div className="font-medium text-gray-700 dark:text-gray-300">
                {formatTime(totalDuration)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 dark:text-gray-500">Max Alt</div>
              <div className="font-medium text-gray-700 dark:text-gray-300">
                {waypoints.length > 0 
                  ? `${Math.max(...waypoints.map(w => w.alt))}m`
                  : '--'
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Future: Actual map component will be rendered here */}
      {/* <MapComponent trajectory={trajectoryData} waypoints={waypoints} currentTime={currentTime} /> */}
    </div>
  )
}

export default TrajectoryViewer
