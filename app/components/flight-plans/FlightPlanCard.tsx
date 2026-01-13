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
  const canProcess = !!plan.scheduledAt && plan.status === 'sin procesar'
  const canDownload = !!plan.csvResult
  const canAuthorize = plan.status === 'procesado' && plan.authorizationStatus === 'sin autorización'
  const canReset = plan.status !== 'sin procesar'

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {/* Plan info */}
      <div className="flex flex-1 flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 truncate" title={plan.name}>
            {plan.name}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PlanStatusBadge status={plan.status} />
          <AuthorizationStatusBadge status={plan.authorizationStatus} />
        </div>

        {plan.scheduledAt && (
          <p className="text-xs text-gray-500">
            <span className="font-medium">Programado:</span> {formatDate(plan.scheduledAt)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <ProcessIconButton
          onClick={() => onProcess?.(plan.id)}
          disabled={!canProcess}
          disabledTooltip={!plan.scheduledAt ? 'Seleccione fecha primero' : 'Ya procesado'}
          loading={loadingStates.processing}
          aria-label="Procesar plan"
        />
        <DownloadIconButton
          onClick={() => onDownload?.(plan.id)}
          disabled={!canDownload}
          disabledTooltip="No hay CSV disponible"
          loading={loadingStates.downloading}
          aria-label="Descargar CSV"
        />
        <AuthorizeIconButton
          onClick={() => onAuthorize?.(plan.id)}
          disabled={!canAuthorize}
          disabledTooltip={
            plan.status !== 'procesado'
              ? 'Procese el plan primero'
              : 'Ya tiene autorización'
          }
          loading={loadingStates.authorizing}
          aria-label="Solicitar autorización"
        />
        <ResetIconButton
          onClick={() => onReset?.(plan.id)}
          disabled={!canReset}
          disabledTooltip="El plan no ha sido procesado"
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
