/**
 * Toast Provider
 * 
 * TASK-194: Create ToastProvider.tsx context for global toast management
 * TASK-196: Implement toast auto-dismiss with configurable duration
 * TASK-198: Listen for auth events and show appropriate toasts
 * 
 * Provides a global context for managing toast notifications throughout the app.
 */

'use client'

import React, { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'
import { ToastContainer, type ToastVariant, type ToastProps } from './toast'

// Toast options when creating a new toast
export interface ToastOptions {
  /** The message to display */
  message: string
  /** Toast variant: success, error, warning, info */
  variant?: ToastVariant
  /** Optional title (defaults to variant name) */
  title?: string
  /** Duration in ms before auto-dismiss. Default: 5000. Set to 0 for persistent. */
  duration?: number
  /** Retry callback for error toasts (TASK-200) */
  onRetry?: () => void
}

// Context type
interface ToastContextType {
  /** Show a toast notification */
  toast: (options: ToastOptions) => string
  /** Show a success toast (TASK-199) */
  success: (message: string, options?: Partial<ToastOptions>) => string
  /** Show an error toast with optional retry (TASK-200) */
  error: (message: string, options?: Partial<ToastOptions>) => string
  /** Show a warning toast */
  warning: (message: string, options?: Partial<ToastOptions>) => string
  /** Show an info toast */
  info: (message: string, options?: Partial<ToastOptions>) => string
  /** Dismiss a specific toast by ID */
  dismiss: (id: string) => void
  /** Dismiss all toasts */
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// Internal toast state with all properties
interface ToastState extends Omit<ToastProps, 'onDismiss'> {
  id: string
}

// Generate unique IDs for toasts
let toastIdCounter = 0
function generateToastId(): string {
  toastIdCounter += 1
  return `toast-${Date.now()}-${toastIdCounter}`
}

export interface ToastProviderProps {
  children: ReactNode
  /** Maximum number of toasts to show at once. Default: 5 */
  maxToasts?: number
  /** Default duration for toasts in ms. Default: 5000 */
  defaultDuration?: number
}

export function ToastProvider({
  children,
  maxToasts = 5,
  defaultDuration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastState[]>([])

  // Remove a toast by ID
  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Remove all toasts
  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  // Add a new toast
  const toast = useCallback((options: ToastOptions): string => {
    const id = generateToastId()
    const newToast: ToastState = {
      id,
      message: options.message,
      variant: options.variant || 'info',
      title: options.title,
      duration: options.duration ?? defaultDuration,
      onRetry: options.onRetry,
    }

    setToasts(prev => {
      // Limit number of toasts
      const updated = [...prev, newToast]
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts)
      }
      return updated
    })

    return id
  }, [defaultDuration, maxToasts])

  // Convenience methods for each variant (TASK-199, TASK-200)
  const success = useCallback((message: string, options?: Partial<ToastOptions>): string => {
    return toast({ message, variant: 'success', ...options })
  }, [toast])

  const error = useCallback((message: string, options?: Partial<ToastOptions>): string => {
    // Error toasts stay longer by default
    return toast({ message, variant: 'error', duration: 8000, ...options })
  }, [toast])

  const warning = useCallback((message: string, options?: Partial<ToastOptions>): string => {
    return toast({ message, variant: 'warning', ...options })
  }, [toast])

  const info = useCallback((message: string, options?: Partial<ToastOptions>): string => {
    return toast({ message, variant: 'info', ...options })
  }, [toast])

  const contextValue: ToastContextType = {
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
  }

  // TASK-198: Listen for auth events and show toast notifications
  useEffect(() => {
    const handleSessionExpired = (event: CustomEvent<{ message: string }>) => {
      error(event.detail?.message || 'Your session has expired. Please log in again.', {
        title: 'Session Expired',
        duration: 0, // Persistent until dismissed
      })
    }

    window.addEventListener('auth:session-expired', handleSessionExpired as EventListener)
    
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired as EventListener)
    }
  }, [error])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toasts.map(t => ({ ...t, onDismiss: dismiss }))}
        onDismiss={dismiss}
      />
    </ToastContext.Provider>
  )
}

/**
 * Hook to access toast context
 * Must be used within a ToastProvider
 */
export function useToastContext(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider')
  }
  return context
}

export default ToastProvider
