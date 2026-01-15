'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PlanStatusBadge, AuthorizationStatusBadge, type PlanStatus, type AuthorizationStatus } from './StatusBadge'
import { WaypointPreview, type Waypoint } from './WaypointPreview'

export interface FlightPlanEnhanced {
  id: string
  name: string
  status: PlanStatus
  authorizationStatus: AuthorizationStatus
  scheduledAt?: string | Date | null
  createdAt?: string | Date
  updatedAt?: string | Date
  csvResult?: { id: string } | null
  folderId?: number | null
  waypoints?: Waypoint[]
  fileContent?: string // Raw QGC plan JSON
}

export interface FlightPlanCardEnhancedProps {
  plan: FlightPlanEnhanced
  isSelected?: boolean
  isDragging?: boolean
  onSelect?: (planId: string) => void
  onProcess?: (planId: string) => void
  onViewTrajectory?: (planId: string) => void
  onAuthorize?: (planId: string) => void
  onReset?: (planId: string) => void
  onDelete?: (planId: string) => void
  onRename?: (planId: string, newName: string) => void
  loadingStates?: {
    processing?: boolean
    downloading?: boolean
    authorizing?: boolean
    resetting?: boolean
    deleting?: boolean
    renaming?: boolean
  }
  className?: string
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Parse waypoints from fileContent (QGC plan JSON)
function parseWaypointsFromPlan(fileContent?: string): Waypoint[] {
  if (!fileContent) return []
  
  try {
    const plan = JSON.parse(fileContent)
    const items = plan?.mission?.items || []
    
    return items
      .filter((item: any) => item.params && item.params.length >= 7)
      .map((item: any, idx: number) => ({
        lat: item.params[4],
        lng: item.params[5],
        alt: item.params[6] || item.Altitude || 0,
        type: idx === 0 ? 'takeoff' : idx === items.length - 1 ? 'landing' : 'cruise',
      }))
      .filter((wp: any) => wp.lat && wp.lng && !isNaN(wp.lat) && !isNaN(wp.lng))
  } catch {
    return []
  }
}

// Icons with larger sizes
function ProcessIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function MapIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function AuthorizeIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function ResetIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function DeleteIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <svg className={sizeClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

export function FlightPlanCardEnhanced({
  plan,
  isSelected = false,
  isDragging = false,
  onSelect,
  onProcess,
  onViewTrajectory,
  onAuthorize,
  onReset,
  onDelete,
  onRename,
  loadingStates = {},
  className = '',
}: FlightPlanCardEnhancedProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(plan.name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse waypoints from plan
  const waypoints = plan.waypoints || parseWaypointsFromPlan(plan.fileContent)

  // Button states
  const canProcess = !!plan.scheduledAt && plan.status === 'sin procesar'
  const canViewTrajectory = !!plan.csvResult
  const canAuthorize = plan.status === 'procesado' && plan.authorizationStatus === 'sin autorización'
  const canReset = plan.status !== 'sin procesar'

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      setEditName(plan.name)
    }
  }, [plan.name, isEditing])

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmedName = editName.trim()
    if (trimmedName && trimmedName !== plan.name) {
      onRename?.(plan.id, trimmedName)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditName(plan.name)
      setIsEditing(false)
    }
  }

  return (
    <div
      className={`
        relative rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/20' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
        }
        ${isDragging ? 'opacity-50 scale-105 rotate-2' : ''}
        ${className}
      `}
      onClick={() => onSelect?.(plan.id)}
    >
      {/* Drag handle */}
      <div 
        className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1 opacity-40 hover:opacity-100 transition-opacity"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </div>

      <div className="pl-10 pr-4 py-4">
        {/* Header: Name + Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()}>
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleKeyDown}
                  className="w-full text-lg font-bold bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </form>
            ) : (
              <div className="flex items-center gap-2 group">
                <h3 
                  className="text-lg font-bold text-gray-900 dark:text-white truncate"
                  title={plan.name}
                >
                  {plan.name}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  title="Edit name"
                >
                  <EditIcon />
                </button>
              </div>
            )}
            
            {/* Status badges */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <PlanStatusBadge status={plan.status} />
              <AuthorizationStatusBadge status={plan.authorizationStatus} />
            </div>
          </div>

          {/* Waypoint preview */}
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <WaypointPreview waypoints={waypoints} mini />
          </div>
        </div>

        {/* Scheduled date */}
        {plan.scheduledAt && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            <span className="font-medium">Scheduled:</span> {formatDate(plan.scheduledAt)}
          </p>
        )}

        {/* Action buttons - LARGER */}
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Process button */}
          <button
            onClick={() => onProcess?.(plan.id)}
            disabled={!canProcess || loadingStates.processing}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
              ${canProcess && !loadingStates.processing
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
            title={!plan.scheduledAt ? 'Select date/time first' : !canProcess ? 'Already processed' : 'Process trajectory'}
          >
            {loadingStates.processing ? <LoadingSpinner /> : <ProcessIcon />}
            <span>Process</span>
          </button>

          {/* View trajectory button (replaces download) */}
          <button
            onClick={() => onViewTrajectory?.(plan.id)}
            disabled={!canViewTrajectory}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
              ${canViewTrajectory
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
            title={canViewTrajectory ? 'View trajectory on map' : 'No trajectory available'}
          >
            {loadingStates.downloading ? <LoadingSpinner /> : <MapIcon />}
            <span>View map</span>
          </button>

          {/* Authorize button */}
          <button
            onClick={() => onAuthorize?.(plan.id)}
            disabled={!canAuthorize || loadingStates.authorizing}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
              ${canAuthorize && !loadingStates.authorizing
                ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
            title={plan.status !== 'procesado' ? 'Process first' : plan.authorizationStatus !== 'sin autorización' ? 'Already authorized' : 'Request FAS authorization'}
          >
            {loadingStates.authorizing ? <LoadingSpinner /> : <AuthorizeIcon />}
            <span>Authorize</span>
          </button>

          {/* Reset button */}
          <button
            onClick={() => onReset?.(plan.id)}
            disabled={!canReset || loadingStates.resetting}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition-all
              ${canReset && !loadingStates.resetting
                ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
            title={canReset ? 'Reset plan' : 'Nothing to reset'}
          >
            {loadingStates.resetting ? <LoadingSpinner /> : <ResetIcon size="sm" />}
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete?.(plan.id)}
            disabled={loadingStates.deleting}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition-all
              bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 active:scale-95
              ${loadingStates.deleting ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title="Delete plan"
          >
            {loadingStates.deleting ? <LoadingSpinner /> : <DeleteIcon size="sm" />}
          </button>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

export default FlightPlanCardEnhanced
