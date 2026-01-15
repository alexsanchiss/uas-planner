import React, { useMemo, useState, useRef, useEffect } from 'react'
import { PlanStatusBadge, AuthorizationStatusBadge, type PlanStatus, type AuthorizationStatus } from './StatusBadge'
import {
  ProcessIconButton,
  DownloadIconButton,
  AuthorizeIconButton,
  ResetIconButton,
  DeleteIconButton,
} from './ActionButtons'
import { WaypointPreview, type Waypoint } from './WaypointPreview'

export interface FlightPlan {
  id: string
  name: string
  status: PlanStatus
  authorizationStatus: AuthorizationStatus
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
  return d.toLocaleString('es-ES', {
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
  // Authorization pending
  if (plan.authorizationStatus === 'pendiente') return 'Authorization pending'
  return undefined
}

function getDownloadDisabledTooltip(plan: FlightPlan): string | undefined {
  // TASK-094: No CSV result
  if (!plan.csvResult) return 'No trajectory available'
  return undefined
}

function getResetDisabledTooltip(plan: FlightPlan): string | undefined {
  // TASK-095: Unprocessed (nothing to reset)
  if (plan.status === 'sin procesar') return 'Nothing to reset'
  return undefined
}

export function FlightPlanCard({
  plan,
  onProcess,
  onDownload,
  onAuthorize,
  onReset,
  onDelete,
  onSelect,
  isSelected = false,
  onRename,
  loadingStates = {},
  className = '',
}: FlightPlanCardProps) {
  // TASK-221: Inline editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(plan.name)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
  const canProcess = !!plan.scheduledAt && plan.status === 'sin procesar'
  const canDownload = !!plan.csvResult
  const canAuthorize = plan.status === 'procesado' && plan.authorizationStatus === 'sin autorización'
  const canReset = plan.status !== 'sin procesar'

  // TASK-220: Parse waypoints for preview
  const waypoints = useMemo(() => {
    // Use pre-parsed waypoints if available, otherwise parse from fileContent
    return plan.waypoints || parseWaypointsFromPlan(plan.fileContent)
  }, [plan.waypoints, plan.fileContent])

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
      return 'El nombre no puede estar vacío'
    }
    if (trimmedName.length > 100) {
      return 'El nombre no puede exceder 100 caracteres'
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
      className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-lg border p-3 sm:p-4 shadow-sm transition-all ${isEditing ? '' : 'cursor-pointer'} ${className} ${
        isSelected
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600'
      }`}
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
      aria-label={`Seleccionar plan ${plan.name}`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
                  {loadingStates.renaming ? '...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={handleRenameCancel}
                  className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancelar
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
              className={`text-lg font-semibold text-gray-900 dark:text-gray-100 truncate ${
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
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Programado:</span> {formatDate(plan.scheduledAt)}
          </p>
        )}
      </div>

      {/* TASK-220: Waypoint preview mini visualization */}
      {waypoints.length > 0 && (
        <div className="hidden sm:block flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
          aria-label="Procesar plan"
        />
        <DownloadIconButton
          onClick={() => onDownload?.(plan.id)}
          disabled={!canDownload}
          disabledTooltip={getDownloadDisabledTooltip(plan)}
          loading={loadingStates.downloading}
          aria-label="Ver trayectoria"
        />
        <AuthorizeIconButton
          onClick={() => onAuthorize?.(plan.id)}
          disabled={!canAuthorize}
          disabledTooltip={getAuthorizeDisabledTooltip(plan)}
          loading={loadingStates.authorizing}
          aria-label="Solicitar autorización"
        />
        <ResetIconButton
          onClick={() => onReset?.(plan.id)}
          disabled={!canReset}
          disabledTooltip={getResetDisabledTooltip(plan)}
          loading={loadingStates.resetting}
          aria-label="Reiniciar plan"
        />
        <DeleteIconButton
          onClick={() => onDelete?.(plan.id)}
          loading={loadingStates.deleting}
          aria-label="Eliminar plan"
        />
      </div>
    </div>
  )
}
