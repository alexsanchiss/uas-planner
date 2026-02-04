'use client'

import React from 'react'

interface LoadingSkeletonProps {
  /** Shape variant */
  variant?: 'text' | 'rectangular' | 'circular' | 'card'
  /** Width - can be a number (px) or string (e.g., '100%', '12rem') */
  width?: number | string
  /** Height - can be a number (px) or string */
  height?: number | string
  /** Number of lines for text variant */
  lines?: number
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none'
  /** Additional CSS classes */
  className?: string
}

/**
 * LoadingSkeleton - Placeholder component for loading states
 * 
 * TASK-167: Content placeholder skeletons for better loading UX
 * 
 * Variants:
 * - text: Single or multiple lines of text placeholder
 * - rectangular: Generic rectangular placeholder
 * - circular: Avatar or icon placeholder
 * - card: Full card placeholder with header, content, and actions
 */
export function LoadingSkeleton({
  variant = 'rectangular',
  width,
  height,
  lines = 1,
  animation = 'pulse',
  className = '',
}: LoadingSkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700 rounded'
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  }
  
  const getStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {}
    if (width) style.width = typeof width === 'number' ? `${width}px` : width
    if (height) style.height = typeof height === 'number' ? `${height}px` : height
    return style
  }
  
  const skeletonClasses = `${baseClasses} ${animationClasses[animation]} ${className}`
  
  // Text variant - multiple lines
  if (variant === 'text') {
    return (
      <div className="space-y-2" style={getStyle()}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={skeletonClasses}
            style={{
              height: '1rem',
              width: i === lines - 1 && lines > 1 ? '75%' : '100%',
            }}
          />
        ))}
      </div>
    )
  }
  
  // Circular variant - avatars, icons
  if (variant === 'circular') {
    const size = width || height || 40
    return (
      <div
        className={`${skeletonClasses} rounded-full`}
        style={{
          width: typeof size === 'number' ? `${size}px` : size,
          height: typeof size === 'number' ? `${size}px` : size,
        }}
      />
    )
  }
  
  // Card variant - full card placeholder
  if (variant === 'card') {
    return (
      <div 
        className={`${baseClasses} ${animationClasses[animation]} p-4 space-y-4 ${className}`}
        style={getStyle()}
      >
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4" />
          </div>
        </div>
        {/* Content */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6" />
        </div>
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20" />
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20" />
        </div>
      </div>
    )
  }
  
  // Default: rectangular
  return (
    <div
      className={skeletonClasses}
      style={{
        width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
        height: height ? (typeof height === 'number' ? `${height}px` : height) : '1rem',
      }}
    />
  )
}

/**
 * FlightPlanCardSkeleton - Skeleton for flight plan cards
 * TASK-169: Loading skeleton for flight plans list
 */
export function FlightPlanCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse ${className}`}>
      {/* Header with name and status badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
        </div>
      </div>
      
      {/* Scheduled date row */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
      </div>
      
      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8" />
        <div className="ml-auto h-8 bg-gray-200 dark:bg-gray-700 rounded w-8" />
      </div>
    </div>
  )
}

/**
 * FolderCardSkeleton - Skeleton for folder cards
 * TASK-169: Loading skeleton for folders
 */
export function FolderCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse ${className}`}>
      {/* Folder header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-36" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      
      {/* Folder content preview */}
      <div className="p-4 space-y-3">
        <FlightPlanCardSkeleton />
        <FlightPlanCardSkeleton />
      </div>
    </div>
  )
}

/**
 * FlightPlansListSkeleton - Full skeleton for flight plans list
 * TASK-169: Loading skeleton for entire list
 */
export function FlightPlansListSkeleton({ 
  folderCount = 2, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  plansPerFolder = 2,
  className = '' 
}: { 
  folderCount?: number
  plansPerFolder?: number 
  className?: string
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Workflow skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mt-2" />
              </div>
              {i < 5 && <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Folders skeleton */}
      <div className="space-y-4">
        {Array.from({ length: folderCount }).map((_, i) => (
          <FolderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default LoadingSkeleton
