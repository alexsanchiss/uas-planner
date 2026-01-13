import React from 'react'
import { PlanStatusBadge, AuthorizationStatusBadge, type PlanStatus, type AuthorizationStatus } from './StatusBadge'
import {
  ProcessIconButton,
  DownloadIconButton,
  AuthorizeIconButton,
  ResetIconButton,
  DeleteIconButton,
} from './ActionButtons'

export interface FlightPlan {
  id: string
  name: string
  status: PlanStatus
  authorizationStatus: AuthorizationStatus
  scheduledAt?: string | Date | null
  createdAt?: string | Date
  updatedAt?: string | Date
  csvResult?: { id: string } | null
}

export interface FlightPlanCardProps {
  plan: FlightPlan
  onProcess?: (planId: string) => void
  onDownload?: (planId: string) => void
  onAuthorize?: (planId: string) => void
  onReset?: (planId: string) => void
  onDelete?: (planId: string) => void
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
  loadingStates = {},
  className = '',
}: FlightPlanCardProps) {
  // TASK-089-095: Button state management with tooltips
  const canProcess = !!plan.scheduledAt && plan.status === 'sin procesar'
  const canDownload = !!plan.csvResult
  const canAuthorize = plan.status === 'procesado' && plan.authorizationStatus === 'sin autorización'
  const canReset = plan.status !== 'sin procesar'

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
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

      {/* Actions - full width on mobile, auto on larger screens */}
      <div className="flex items-center justify-end sm:justify-start gap-1 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700">
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
          aria-label="Descargar CSV"
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
