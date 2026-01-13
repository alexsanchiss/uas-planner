import React from 'react'

export type PlanStatus = 'sin procesar' | 'en proceso' | 'procesado' | 'error'
export type AuthorizationStatus = 'sin autorización' | 'pendiente' | 'aprobado' | 'denegado'

interface StatusBadgeProps {
  type: 'plan' | 'authorization'
  status: PlanStatus | AuthorizationStatus
  className?: string
}

const planStatusStyles: Record<PlanStatus, string> = {
  'sin procesar': 'bg-gray-100 text-gray-700 border-gray-300',
  'en proceso': 'bg-blue-100 text-blue-700 border-blue-300',
  'procesado': 'bg-green-100 text-green-700 border-green-300',
  'error': 'bg-red-100 text-red-700 border-red-300',
}

const authorizationStatusStyles: Record<AuthorizationStatus, string> = {
  'sin autorización': 'bg-gray-100 text-gray-700 border-gray-300',
  'pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'aprobado': 'bg-green-100 text-green-700 border-green-300',
  'denegado': 'bg-red-100 text-red-700 border-red-300',
}

const planStatusLabels: Record<PlanStatus, string> = {
  'sin procesar': 'Sin procesar',
  'en proceso': 'En proceso',
  'procesado': 'Procesado',
  'error': 'Error',
}

const authorizationStatusLabels: Record<AuthorizationStatus, string> = {
  'sin autorización': 'Sin autorización',
  'pendiente': 'Pendiente',
  'aprobado': 'Aprobado',
  'denegado': 'Denegado',
}

export function StatusBadge({ type, status, className = '' }: StatusBadgeProps) {
  const styles = type === 'plan' 
    ? planStatusStyles[status as PlanStatus] 
    : authorizationStatusStyles[status as AuthorizationStatus]
  
  const label = type === 'plan'
    ? planStatusLabels[status as PlanStatus]
    : authorizationStatusLabels[status as AuthorizationStatus]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles} ${className}`}
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
