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

const variantStyles: Record<ToastVariant, { container: string; icon: string; title: string }> = {
  success: {
    container: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: 'text-green-500 dark:text-green-400',
    title: 'text-green-800 dark:text-green-200',
  },
  error: {
    container: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: 'text-red-500 dark:text-red-400',
    title: 'text-red-800 dark:text-red-200',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-200',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-200',
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
        relative w-80 max-w-full overflow-hidden rounded-lg border shadow-lg
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
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {message}
          </p>

          {/* Retry button for error toasts (TASK-200) */}
          {variant === 'error' && onRetry && (
            <button
              onClick={handleRetry}
              className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
            >
              Reintentar
            </button>
          )}
        </div>

        {/* Close button */}
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="inline-flex rounded-md p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
            aria-label="Dismiss"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Progress bar (TASK-196) */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              variant === 'success' ? 'bg-green-500' :
              variant === 'error' ? 'bg-red-500' :
              variant === 'warning' ? 'bg-amber-500' :
              'bg-blue-500'
            }`}
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
