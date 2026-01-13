'use client'

import React, { useEffect, useState } from 'react'

interface SuccessAnimationProps {
  /** Size of the animation */
  size?: 'sm' | 'md' | 'lg'
  /** Optional message to display */
  message?: string
  /** Auto-hide after duration (ms), 0 to disable */
  autoHide?: number
  /** Callback when animation completes/hides */
  onComplete?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * SuccessAnimation - Visual feedback when operations complete successfully
 * 
 * TASK-176: Add success animation when operations complete
 * 
 * Features:
 * - Animated checkmark circle
 * - Optional success message
 * - Auto-hide with configurable duration
 * - Multiple sizes
 */
export function SuccessAnimation({
  size = 'md',
  message,
  autoHide = 2000,
  onComplete,
  className = '',
}: SuccessAnimationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHide > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onComplete?.()
      }, autoHide)
      return () => clearTimeout(timer)
    }
  }, [autoHide, onComplete])

  if (!isVisible) return null

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={`flex flex-col items-center gap-2 success-complete ${className}`}>
      {/* Animated checkmark circle */}
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          className="w-full h-full"
          viewBox="0 0 52 52"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle */}
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="#22c55e"
            className="success-circle"
          />
          {/* Checkmark */}
          <path
            d="M14 27l8 8 16-16"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="success-checkmark"
          />
        </svg>
      </div>
      
      {/* Optional message */}
      {message && (
        <span className={`${textSizes[size]} font-medium text-green-600 dark:text-green-400 fade-in`}>
          {message}
        </span>
      )}
    </div>
  )
}

/**
 * SuccessToast - Toast-style success notification
 * TASK-176: Success feedback that appears temporarily
 */
export function SuccessToast({
  message,
  autoHide = 3000,
  onClose,
  className = '',
}: {
  message: string
  autoHide?: number
  onClose?: () => void
  className?: string
}) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (autoHide > 0) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true)
      }, autoHide - 300)
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, autoHide)
      
      return () => {
        clearTimeout(exitTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [autoHide, onClose])

  if (!isVisible) return null

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3
        bg-green-600 text-white rounded-lg shadow-lg
        ${isExiting ? 'fade-out' : 'slide-in-right'}
        ${className}
      `}
    >
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsExiting(true)
          setTimeout(() => {
            setIsVisible(false)
            onClose?.()
          }, 300)
        }}
        className="ml-2 p-1 hover:bg-green-700 rounded transition-colors"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

/**
 * SuccessInline - Inline success indicator for cards/rows
 * TASK-176: Success feedback within existing UI elements
 */
export function SuccessInline({
  message = '¡Completado!',
  className = '',
}: {
  message?: string
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 success-bounce ${className}`}>
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span className="text-sm font-medium">{message}</span>
    </span>
  )
}

export default SuccessAnimation
