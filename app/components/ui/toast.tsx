/**
 * Toast Component
 * 
 * TASK-193: Create Toast.tsx component with variants (success, error, warning, info)
 * TASK-196: Implement toast auto-dismiss with configurable duration
 * TASK-197: Add toast animations (slide in from top-right, fade out)
 * TASK-200: Add error toast for failed operations with retry option
 */

import React, { useEffect, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  message: string
  variant?: ToastVariant
  /** Duration in milliseconds before auto-dismiss. Set to 0 for persistent toast. */
  duration?: number
  /** Optional title for the toast */
  title?: string
  /** Optional callback for retry action (shown only for error toasts) */
  onRetry?: () => void
  /** Callback when toast is dismissed */
  onDismiss: (id: string) => void
}

// Icons for each variant
const SuccessIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const ErrorIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const WarningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const variantIcons: Record<ToastVariant, React.FC> = {
  success: SuccessIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
}

const variantStyles: Record<ToastVariant, { container: string; icon: string; title: string; message: string }> = {
  success: {
    container: 'bg-green-600 border-green-700',
    icon: 'text-white',
    title: 'text-white',
    message: 'text-green-50',
  },
  error: {
    container: 'bg-red-600 border-red-700',
    icon: 'text-white',
    title: 'text-white',
    message: 'text-red-50',
  },
  warning: {
    container: 'bg-amber-500 border-amber-600',
    icon: 'text-white',
    title: 'text-white',
    message: 'text-amber-50',
  },
  info: {
    container: 'bg-blue-600 border-blue-700',
    icon: 'text-white',
    title: 'text-white',
    message: 'text-blue-50',
  },
}

const defaultTitles: Record<ToastVariant, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

export function Toast({
  id,
  message,
  variant = 'info',
  duration = 5000,
  title,
  onRetry,
  onDismiss,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)

  const Icon = variantIcons[variant]
  const styles = variantStyles[variant]
  const displayTitle = title || defaultTitles[variant]

  // Auto-dismiss timer
  useEffect(() => {
    if (duration === 0) return

    // Progress bar animation
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
    }, 50)

    // Dismiss timer
    const dismissTimer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(id), 300) // Wait for exit animation
    }, duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(dismissTimer)
    }
  }, [duration, id, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(id), 300)
  }

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
      handleDismiss()
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        relative w-80 max-w-full overflow-hidden rounded-lg border shadow-[0_4px_12px_rgba(0,0,0,0.3)]
        ${styles.container}
        ${isExiting ? 'toast-exit' : 'toast-enter'}
        transition-all duration-300 ease-out
      `}
    >
      <div className="flex p-4">
        {/* Icon */}
        <div className={`flex-shrink-0 ${styles.icon}`}>
          <Icon />
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          {/* Title */}
          <p className={`text-sm font-semibold ${styles.title}`}>
            {displayTitle}
          </p>
          
          {/* Message */}
          <p className={`mt-1 text-sm ${styles.message}`}>
            {message}
          </p>

          {/* Retry button for error toasts (TASK-200) */}
          {variant === 'error' && onRetry && (
            <button
              onClick={handleRetry}
              className="mt-2 text-sm font-medium text-white underline hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded"
            >
              Reintentar
            </button>
          )}
        </div>

        {/* Close button */}
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="inline-flex rounded-md p-1.5 text-white/80 hover:text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 transition-colors"
            aria-label="Dismiss"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Progress bar (TASK-196) */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className="h-full transition-all duration-100 ease-linear bg-white/70"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Toast Container - renders all active toasts
 * Positioned fixed at top-right with proper stacking
 */
export interface ToastContainerProps {
  toasts: Array<ToastProps & { id: string }>
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}

export default Toast
