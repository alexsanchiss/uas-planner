import React from 'react'

interface LoadingSpinnerProps {
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Color variant - defaults to white for buttons, can use primary for standalone */
  variant?: 'white' | 'primary' | 'gray'
  /** Additional CSS classes */
  className?: string
  /** Optional label for accessibility */
  label?: string
}

/**
 * LoadingSpinner - Animated spinner for loading states
 * 
 * TASK-166: Multiple sizes (xs, sm, md, lg, xl)
 * 
 * Usage:
 * - xs/sm: Inside buttons
 * - md: Default, inline with text
 * - lg: Section loading
 * - xl: Full page loading
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  variant = 'white',
  className = '',
  label = 'Loading',
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3 border-[1.5px]',
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-[3px]',
    xl: 'w-12 h-12 border-4',
  }
  
  const variantClasses = {
    white: 'border-white border-t-transparent',
    primary: 'border-blue-500 border-t-transparent',
    gray: 'border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300',
  }

  return (
    <div
      className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full animate-spin ${className}`}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}

/**
 * LoadingOverlay - Full screen or container loading overlay
 * 
 * TASK-170, TASK-171, TASK-172: Loading indicators during operations
 */
export function LoadingOverlay({ 
  message = 'Cargando...',
  variant = 'overlay',
  className = '',
}: {
  message?: string
  variant?: 'overlay' | 'inline'
  className?: string
}) {
  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-center gap-3 p-4 ${className}`}>
        <LoadingSpinner size="md" variant="primary" />
        <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 fade-in ${className}`}>
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" variant="primary" />
        <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>
      </div>
    </div>
  )
}

/**
 * ProcessingIndicator - Shows during trajectory processing
 * TASK-170: Loading indicator during trajectory processing
 */
export function ProcessingIndicator({ 
  stage = 'processing',
  className = '',
}: {
  stage?: 'processing' | 'generating' | 'submitting'
  className?: string
}) {
  const stages = {
    processing: { label: 'Procesando trayectoria...', icon: '🔄' },
    generating: { label: 'Generando U-Plan...', icon: '📄' },
    submitting: { label: 'Enviando al FAS...', icon: '📤' },
  }
  
  const { label, icon } = stages[stage]

  return (
    <div className={`flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}>
      <span className="text-lg">{icon}</span>
      <LoadingSpinner size="sm" variant="primary" />
      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{label}</span>
    </div>
  )
}

/**
 * AuthorizationIndicator - Shows during FAS authorization request
 * TASK-171: Loading indicator during authorization requests
 */
export function AuthorizationIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg ${className}`}>
      <span className="text-lg">🔐</span>
      <LoadingSpinner size="sm" variant="primary" />
      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
        Solicitando autorización al FAS...
      </span>
    </div>
  )
}

/**
 * GeoawarenessIndicator - Shows during geoawareness check
 * TASK-172: Loading indicator during geoawareness requests
 */
export function GeoawarenessIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg ${className}`}>
      <span className="text-lg">🗺️</span>
      <LoadingSpinner size="sm" variant="primary" />
      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
        Verificando zonas geográficas...
      </span>
    </div>
  )
}

export default LoadingSpinner
