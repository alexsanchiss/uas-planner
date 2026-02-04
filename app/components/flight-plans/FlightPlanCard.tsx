import React, { useMemo, useState, useRef, useEffect, DragEvent } from 'react'
import { PlanStatusBadge, AuthorizationStatusBadge, type PlanStatus, type AuthorizationStatus } from './StatusBadge'
import {
  ProcessIconButton,
  DownloadIconButton,
  AuthorizeIconButton,
  AuthorizationResultIconButton,
  ResetIconButton,
  DeleteIconButton,
} from './ActionButtons'
import { WaypointPreview, type Waypoint } from './WaypointPreview'

// Re-export Waypoint type for convenience
export type { Waypoint }

/**
 * TASK-222: Drag data structure for flight plan drag-and-drop
 */
export interface FlightPlanDragData {
  planId: string
  planName: string
  sourceFolderId: string | null
}

/**
 * MIME type for flight plan drag-and-drop
 */
export const FLIGHT_PLAN_DRAG_TYPE = 'application/x-flight-plan'

export interface FlightPlan {
  id: string
  name: string
  status: PlanStatus
  authorizationStatus: AuthorizationStatus
  /** Authorization response message (JSON) - stored when authorization completes */
  authorizationMessage?: unknown
  /** Generated U-Plan JSON - available after processing */
  uplan?: unknown
  /** Geoawareness service response (GeoJSON) - available after calling service */
  geoawarenessData?: unknown
  scheduledAt?: string | Date | null
  createdAt?: string | Date
  updatedAt?: string | Date
  csvResult?: { id: string } | null
  /** Raw QGC plan JSON for waypoint extraction */
  fileContent?: string
  /** Pre-parsed waypoints (optional, will parse from fileContent if not provided) */
  waypoints?: Waypoint[]
}

// TASK-221: Pencil icon for inline editing
function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

export interface FlightPlanCardProps {
  plan: FlightPlan
  /** TASK-222: Folder ID this plan belongs to (for drag-and-drop) */
  folderId?: string | null
  onProcess?: (planId: string) => void
  onDownload?: (planId: string) => void
  onAuthorize?: (planId: string) => void
  onReset?: (planId: string) => void
  onDelete?: (planId: string) => void
  /** TASK-217: Click handler for plan selection */
  onSelect?: (planId: string) => void
  /** TASK-217: Whether this plan is currently selected */
  isSelected?: boolean
  /** TASK-221: Callback for renaming the plan */
  onRename?: (planId: string, newName: string) => void
  /** TASK-222: Enable drag-and-drop */
  draggable?: boolean
  /** TASK-222: Called when drag starts */
  onDragStart?: (e: DragEvent<HTMLDivElement>, data: FlightPlanDragData) => void
  /** TASK-222: Called when drag ends */
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void
  /** Callback when user clicks to view authorization message */
  onViewAuthorizationMessage?: (planId: string, message: unknown) => void
  /** Callback when user clicks on waypoint preview to open map */
  onWaypointPreviewClick?: (planId: string, waypoints: Waypoint[]) => void
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

/**
 * Parse waypoints from QGC plan JSON fileContent
 * TASK-220: Extract waypoints for visual preview
 */
function parseWaypointsFromPlan(fileContent?: string): Waypoint[] {
  if (!fileContent) return []
  
  try {
    const plan = JSON.parse(fileContent)
    const items = plan?.mission?.items || []
    
    return items
      .filter((item: { params?: number[] }) => item.params && item.params.length >= 7)
      .map((item: { params: number[]; Altitude?: number }, idx: number, arr: unknown[]) => ({
        lat: item.params[4],
        lng: item.params[5],
        alt: item.params[6] || item.Altitude || 0,
        type: idx === 0 ? 'takeoff' as const : idx === arr.length - 1 ? 'landing' as const : 'cruise' as const,
      }))
      .filter((wp: Waypoint) => wp.lat && wp.lng && !isNaN(wp.lat) && !isNaN(wp.lng))
  } catch {
    return []
  }
}

// Helper to get the appropriate disabled tooltip for each button
function getProcessDisabledTooltip(plan: FlightPlan): string | undefined {
  // TASK-090: No scheduledAt
  if (!plan.scheduledAt) return 'Select date/time first'
  // TASK-091: Already processing (en proceso means in progress)
  if (plan.status === 'en proceso') return 'Processing in progress'
  // Already processed
  if (plan.status !== 'sin procesar') return 'Already processed'
  return undefined
}

function getAuthorizeDisabledTooltip(plan: FlightPlan): string | undefined {
  // TASK-092: Not processed yet
  if (plan.status !== 'procesado') return 'Process trajectory first'
  // TASK-093: Already authorized
  if (plan.authorizationStatus === 'aprobado' || plan.authorizationStatus === 'denegado') {
    return 'Already authorized'
  }
  // TASK-033: Detect FAS processing state
  if (plan.authorizationStatus === 'pendiente') {
    const messageStr = typeof plan.authorizationMessage === 'string' ? plan.authorizationMessage : ''
    if (messageStr === 'FAS procesando...') {
      return 'FAS is processing the request'
    }
    return 'Authorization pending'
  }
  return undefined
}

/**
 * TASK-033: Check if FAS is currently processing the authorization request
 */
function isFasProcessingPlan(plan: FlightPlan): boolean {
  const messageStr = typeof plan.authorizationMessage === 'string' ? plan.authorizationMessage : ''
  return messageStr === 'FAS procesando...' || plan.authorizationStatus === 'pendiente'
}

function getDownloadDisabledTooltip(plan: FlightPlan): string | undefined {
  // TASK-001: Must be processed first
  if (plan.status !== 'procesado') return 'Plan must be processed first'
  // TASK-094: No CSV result
  if (!plan.csvResult) return 'Trajectory data not available'
  return undefined
}

function getResetDisabledTooltip(plan: FlightPlan): string | undefined {
  // TASK-095: Unprocessed (nothing to reset)
  if (plan.status === 'sin procesar') return 'Nothing to reset'
  return undefined
}

export function FlightPlanCard({
  plan,
  folderId,
  onProcess,
  onDownload,
  onAuthorize,
  onReset,
  onDelete,
  onSelect,
  isSelected = false,
  onRename,
  draggable = false,
  onDragStart,
  onDragEnd,
  onViewAuthorizationMessage,
  onWaypointPreviewClick,
  loadingStates = {},
  className = '',
}: FlightPlanCardProps) {
  // TASK-221: Inline editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(plan.name)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // TASK-222: Drag state
  const [isDragging, setIsDragging] = useState(false)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit name when plan name changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditName(plan.name)
    }
  }, [plan.name, isEditing])

  // TASK-089-095: Button state management with tooltips
  // Fixed: Also disable process when status is 'en proceso' (currently processing)
  const canProcess = !!plan.scheduledAt && plan.status === 'sin procesar'
  // TASK-001: Can only view trajectory when processed AND csvResult exists
  const canDownload = plan.status === 'procesado' && !!plan.csvResult
  const canAuthorize = plan.status === 'procesado' && plan.authorizationStatus === 'sin autorización'
  const canReset = plan.status !== 'sin procesar'

  // TASK-220: Parse waypoints for preview
  const waypoints = useMemo(() => {
    // Use pre-parsed waypoints if available, otherwise parse from fileContent
    return plan.waypoints || parseWaypointsFromPlan(plan.fileContent)
  }, [plan.waypoints, plan.fileContent])

  // TASK-222: Handle drag start
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!draggable || isEditing) {
      e.preventDefault()
      return
    }
    
    setIsDragging(true)
    
    const dragData: FlightPlanDragData = {
      planId: plan.id,
      planName: plan.name,
      sourceFolderId: folderId ?? null,
    }
    
    // Set drag data
    e.dataTransfer.setData(FLIGHT_PLAN_DRAG_TYPE, JSON.stringify(dragData))
    e.dataTransfer.setData('text/plain', plan.name)
    e.dataTransfer.effectAllowed = 'move'
    
    onDragStart?.(e, dragData)
  }
  
  // TASK-222: Handle drag end
  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    setIsDragging(false)
    onDragEnd?.(e)
  }

  // TASK-217: Handle card click for selection
  const handleCardClick = () => {
    if (!isEditing) {
      onSelect?.(plan.id)
    }
  }

  // TASK-221: Validate plan name
  const validateName = (name: string): string | null => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return 'Name cannot be empty'
    }
    if (trimmedName.length > 100) {
      return 'Name cannot exceed 100 characters'
    }
    return null
  }

  // TASK-221: Handle name input change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setEditName(newValue)
    if (validationError) {
      setValidationError(null)
    }
  }

  // TASK-221: Handle rename submit
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const trimmedName = editName.trim()
    const error = validateName(trimmedName)
    
    if (error) {
      setValidationError(error)
      return
    }
    
    if (trimmedName !== plan.name) {
      onRename?.(plan.id, trimmedName)
    }
    
    setIsEditing(false)
    setValidationError(null)
  }

  // TASK-221: Handle rename cancel
  const handleRenameCancel = () => {
    setEditName(plan.name)
    setIsEditing(false)
    setValidationError(null)
  }

  // TASK-221: Start editing mode
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRename) {
      setIsEditing(true)
    }
  }

  return (
    <div
      className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-lg border !pl-8 p-3 sm:p-4 shadow-sm  transition-all ${isEditing ? '' : 'cursor-pointer'} ${className} ${
        isDragging
          ? 'opacity-50 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 scale-95'
          : isSelected
            ? 'border-blue-500 dark:border-blue-400 bg-[var(--surface-secondary)] ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--bg-primary)]'
            : 'border-gray-200 dark:border-gray-700 bg-[var(--surface-primary)] hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600'
      } ${draggable && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={isEditing ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
          e.preventDefault()
          handleCardClick()
        }
      }}
      aria-pressed={isSelected}
      aria-label={`Select plan ${plan.name}`}
      draggable={draggable && !isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      {/* TASK-222: Drag handle indicator */}
      {draggable && !isEditing && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-50 hidden sm:block" title="Drag to move">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>
      )}
      {/* Plan info */}
      <div className="flex flex-1 flex-col gap-2 min-w-0">
        {/* TASK-221: Larger plan name with inline editing */}
        {isEditing ? (
          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={handleNameChange}
                className={`flex-1 px-3 py-2 text-base font-semibold border rounded-md focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                  validationError
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleRenameCancel()
                  }
                }}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'plan-name-error' : undefined}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loadingStates.renaming || !editName.trim()}
                  className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingStates.renaming ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleRenameCancel}
                  className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
            {validationError && (
              <p id="plan-name-error" className="text-xs text-red-600 ml-1">
                {validationError}
              </p>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {/* TASK-221: Larger plan name (increased from text-sm to text-lg) with edit button */}
            <h3 
              className={`text-lg font-semibold text-[var(--text-primary)] truncate ${
                onRename ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 group' : ''
              }`}
              title={plan.name}
              onClick={handleEditClick}
            >
              {plan.name}
              {onRename && (
                <span className="inline-flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500">
                  <PencilIcon />
                </span>
              )}
            </h3>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <PlanStatusBadge status={plan.status} />
          <AuthorizationStatusBadge status={plan.authorizationStatus} />
        </div>

        {plan.scheduledAt && (
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="font-medium">Scheduled:</span> {formatDate(plan.scheduledAt)}
          </p>
        )}
      </div>

      {/* TASK-220: Waypoint preview mini visualization - clickable to open map */}
      {waypoints.length > 0 && (
        <div 
          className="hidden sm:block flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={(e) => {
            e.stopPropagation()
            onWaypointPreviewClick?.(plan.id, waypoints)
          }}
          title="Click to view waypoints on map"
        >
          <WaypointPreview waypoints={waypoints} mini className="border border-gray-200 dark:border-gray-600" />
        </div>
      )}

      {/* Actions - full width on mobile, auto on larger screens */}
      {/* Stop propagation on action buttons to prevent card selection */}
      <div className="flex items-center justify-end sm:justify-start gap-1 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <ProcessIconButton
          onClick={() => onProcess?.(plan.id)}
          disabled={!canProcess || loadingStates.processing}
          disabledTooltip={loadingStates.processing ? 'Processing in progress' : getProcessDisabledTooltip(plan)}
          loading={loadingStates.processing}
          aria-label="Process plan"
        />
        <DownloadIconButton
          onClick={() => onDownload?.(plan.id)}
          disabled={!canDownload}
          disabledTooltip={getDownloadDisabledTooltip(plan)}
          loading={loadingStates.downloading}
          aria-label="View trajectory"
        />
        {/* Show color-coded authorization status button (green=approved, red=denied) or regular authorize button */}
        <AuthorizationResultIconButton
          authorizationStatus={plan.authorizationStatus}
          onClick={() => onAuthorize?.(plan.id)}
          onViewMessage={
            plan.authorizationMessage && (plan.authorizationStatus === 'aprobado' || plan.authorizationStatus === 'denegado')
              ? () => onViewAuthorizationMessage?.(plan.id, plan.authorizationMessage)
              : undefined
          }
          disabled={!canAuthorize && plan.authorizationStatus === 'sin autorización'}
          disabledTooltip={getAuthorizeDisabledTooltip(plan)}
          loading={loadingStates.authorizing}
          aria-label={
            plan.authorizationStatus === 'aprobado' 
              ? 'Authorization approved' 
              : plan.authorizationStatus === 'denegado'
                ? 'Authorization denied'
                : plan.authorizationStatus === 'pendiente'
                  ? 'Authorization pending'
                  : 'Request authorization'
          }
        />
        <ResetIconButton
          onClick={() => onReset?.(plan.id)}
          disabled={!canReset}
          disabledTooltip={getResetDisabledTooltip(plan)}
          loading={loadingStates.resetting}
          aria-label="Reset plan"
        />
        <DeleteIconButton
          onClick={() => onDelete?.(plan.id)}
          loading={loadingStates.deleting}
          aria-label="Delete plan"
        />
      </div>
    </div>
  )
}
