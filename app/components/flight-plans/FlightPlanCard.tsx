import React, { useMemo } from 'react'
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
  loadingStates?: {
    processing?: boolean
    downloading?: boolean
    authorizing?: boolean
    resetting?: boolean
    deleting?: boolean
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
  loadingStates = {},
  className = '',
}: FlightPlanCardProps) {
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
    onSelect?.(plan.id)
  }

  return (
    <div
      className={`relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-lg border p-3 sm:p-4 shadow-sm transition-all cursor-pointer ${className} ${
        isSelected
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600'
      }`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
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
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={plan.name}>
            {plan.name}
          </h3>
        </div>

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
