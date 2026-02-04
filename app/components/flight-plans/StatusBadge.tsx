import React from 'react'

export type PlanStatus = 'sin procesar' | 'en proceso' | 'procesado' | 'error'
export type AuthorizationStatus = 'sin autorización' | 'pendiente' | 'aprobado' | 'denegado'

interface StatusBadgeProps {
  type: 'plan' | 'authorization'
  status: PlanStatus | AuthorizationStatus
  className?: string
}

/**
 * TASK-190: Status badges using CSS custom properties from themes.css
 * These classes use the unified color scheme for consistent theming
 */
const planStatusStyles: Record<PlanStatus, string> = {
  'sin procesar': 'badge-idle',      // Gray - unprocessed/idle state
  'en proceso': 'badge-processing',   // Blue - currently processing
  'procesado': 'badge-completed',     // Green - successfully completed
  'error': 'badge-error',             // Red - error state
}

const authorizationStatusStyles: Record<AuthorizationStatus, string> = {
  'sin autorización': 'badge-auth-none',     // Gray - no authorization requested
  'pendiente': 'badge-auth-pending',         // Amber/Yellow - awaiting authorization
  'aprobado': 'badge-auth-approved',         // Green - authorization approved
  'denegado': 'badge-auth-denied',           // Red - authorization denied
}

const planStatusLabels: Record<PlanStatus, string> = {
  'sin procesar': 'Unprocessed',
  'en proceso': 'Processing',
  'procesado': 'Processed',
  'error': 'Error',
}

const authorizationStatusLabels: Record<AuthorizationStatus, string> = {
  'sin autorización': 'No authorization',
  'pendiente': 'Pending',
  'aprobado': 'Approved',
  'denegado': 'Denied',
}

export function StatusBadge({ type, status, className = '' }: StatusBadgeProps) {
  const badgeClass = type === 'plan' 
    ? planStatusStyles[status as PlanStatus] 
    : authorizationStatusStyles[status as AuthorizationStatus]
  
  const label = type === 'plan'
    ? planStatusLabels[status as PlanStatus]
    : authorizationStatusLabels[status as AuthorizationStatus]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 ease-in-out ${badgeClass} ${className}`}
    >
      {label}
    </span>
  )
}

// Convenience components for direct usage
export function PlanStatusBadge({ status, className }: { status: PlanStatus; className?: string }) {
  return <StatusBadge type="plan" status={status} className={className} />
}

export function AuthorizationStatusBadge({ status, className }: { status: AuthorizationStatus; className?: string }) {
  return <StatusBadge type="authorization" status={status} className={className} />
}
