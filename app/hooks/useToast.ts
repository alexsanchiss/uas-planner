/**
 * useToast Hook
 * 
 * TASK-195: Create useToast.ts hook for easy toast triggering
 * TASK-199: Add success toast for completed operations
 * TASK-200: Add error toast for failed operations with retry option
 * 
 * Provides a simple interface to show toast notifications from any component.
 */

import { useToastContext, type ToastOptions } from '../components/ui/toast-provider'

/**
 * Hook for displaying toast notifications
 * 
 * @example
 * ```tsx
 * const toast = useToast()
 * 
 * // Show success toast
 * toast.success('Operation completed successfully')
 * 
 * // Show error toast with retry
 * toast.error('Failed to save', { 
 *   onRetry: () => saveData() 
 * })
 * 
 * // Show custom toast
 * toast.toast({
 *   message: 'Custom notification',
 *   variant: 'info',
 *   duration: 10000
 * })
 * ```
 */
export function useToast() {
  return useToastContext()
}

// Re-export types for convenience
export type { ToastOptions }

export default useToast
