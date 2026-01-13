'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

/**
 * TASK-201: Tooltip Component
 * 
 * A versatile tooltip component with positioning options.
 * Features:
 * - Position options: top, bottom, left, right
 * - Trigger on hover
 * - Dark background with light text
 * - Arrow pointer
 * - Accessible (aria-describedby)
 * - Auto-repositioning when near viewport edge (optional)
 * - Support for both controlled and uncontrolled modes
 */

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  /** The content to show in the tooltip */
  content: React.ReactNode
  /** The element that triggers the tooltip */
  children: React.ReactNode
  /** Position of the tooltip relative to the trigger element */
  position?: TooltipPosition
  /** Delay before showing tooltip (ms) */
  showDelay?: number
  /** Delay before hiding tooltip (ms) */
  hideDelay?: number
  /** Whether the tooltip is disabled */
  disabled?: boolean
  /** Additional class name for the tooltip */
  className?: string
  /** Additional class name for the wrapper */
  wrapperClassName?: string
  /** Whether to show an arrow pointer */
  showArrow?: boolean
  /** Maximum width of the tooltip */
  maxWidth?: number | string
  /** ID for accessibility (auto-generated if not provided) */
  id?: string
}

/**
 * Get position classes for the tooltip and arrow
 */
function getPositionClasses(position: TooltipPosition): {
  tooltip: string
  arrow: string
} {
  switch (position) {
    case 'top':
      return {
        tooltip: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        arrow: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent',
      }
    case 'bottom':
      return {
        tooltip: 'top-full left-1/2 -translate-x-1/2 mt-2',
        arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent',
      }
    case 'left':
      return {
        tooltip: 'right-full top-1/2 -translate-y-1/2 mr-2',
        arrow: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
      }
    case 'right':
      return {
        tooltip: 'left-full top-1/2 -translate-y-1/2 ml-2',
        arrow: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
      }
  }
}

/**
 * Main Tooltip Component
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  showDelay = 200,
  hideDelay = 0,
  disabled = false,
  className = '',
  wrapperClassName = '',
  showArrow = true,
  maxWidth = 250,
  id,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipId] = useState(() => id || `tooltip-${Math.random().toString(36).substr(2, 9)}`)
  const showTimeoutRef = useRef<NodeJS.Timeout>()
  const hideTimeoutRef = useRef<NodeJS.Timeout>()

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (disabled) return
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    showTimeoutRef.current = setTimeout(() => setIsVisible(true), showDelay)
  }, [disabled, showDelay])

  const handleMouseLeave = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), hideDelay)
  }, [hideDelay])

  const handleFocus = useCallback(() => {
    if (disabled) return
    setIsVisible(true)
  }, [disabled])

  const handleBlur = useCallback(() => {
    setIsVisible(false)
  }, [])

  // Don't render tooltip if disabled or no content
  if (disabled || !content) {
    return <>{children}</>
  }

  const positionClasses = getPositionClasses(position)

  return (
    <div 
      className={`relative inline-flex ${wrapperClassName}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Trigger element with aria attributes */}
      <div aria-describedby={isVisible ? tooltipId : undefined}>
        {children}
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`
            absolute z-50 px-2.5 py-1.5 text-sm font-medium text-white
            bg-gray-900 dark:bg-gray-800 rounded-md shadow-lg
            whitespace-normal break-words
            animate-fade-in
            ${positionClasses.tooltip}
            ${className}
          `}
          style={{ maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }}
        >
          {content}
          {/* Arrow */}
          {showArrow && (
            <div 
              className={`absolute border-4 ${positionClasses.arrow}`}
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * TASK-203: Help Tooltip for Form Fields
 * 
 * A help icon with tooltip, designed to sit next to form labels
 * and provide additional context or instructions.
 */
export interface HelpTooltipProps {
  /** The help text to display */
  content: React.ReactNode
  /** Position of the tooltip */
  position?: TooltipPosition
  /** Size of the help icon */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class name */
  className?: string
}

export function HelpTooltip({
  content,
  position = 'top',
  size = 'sm',
  className = '',
}: HelpTooltipProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <Tooltip content={content} position={position} maxWidth={300}>
      <button
        type="button"
        className={`
          inline-flex items-center justify-center
          text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full
          transition-colors duration-200
          ${className}
        `}
        aria-label="Help"
      >
        <svg 
          className={sizeClasses[size]} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      </button>
    </Tooltip>
  )
}

/**
 * TASK-204: Contextual Help Icon for Workflow Steps
 * 
 * A more prominent help icon with expanded information,
 * designed for workflow steps and complex UI elements.
 */
export interface ContextualHelpProps {
  /** Title shown in the tooltip header */
  title: string
  /** Description/help content */
  description: React.ReactNode
  /** Optional list of tips/steps */
  tips?: string[]
  /** Position of the tooltip */
  position?: TooltipPosition
  /** Additional class name */
  className?: string
}

export function ContextualHelp({
  title,
  description,
  tips,
  position = 'right',
  className = '',
}: ContextualHelpProps) {
  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-semibold text-blue-200">{title}</div>
      <div className="text-gray-200">{description}</div>
      {tips && tips.length > 0 && (
        <ul className="text-gray-300 text-xs space-y-1 mt-2">
          {tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <Tooltip content={tooltipContent} position={position} maxWidth={320}>
      <button
        type="button"
        className={`
          inline-flex items-center justify-center p-1
          text-blue-400 hover:text-blue-300 dark:text-blue-500 dark:hover:text-blue-400
          bg-blue-500/10 hover:bg-blue-500/20 rounded-full
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          transition-all duration-200
          ${className}
        `}
        aria-label={`Help: ${title}`}
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      </button>
    </Tooltip>
  )
}

/**
 * TASK-202: Icon Button Tooltip Wrapper
 * 
 * A wrapper specifically designed for icon-only buttons,
 * always showing the tooltip on hover (not just when disabled).
 */
export interface IconButtonTooltipProps {
  /** The tooltip content */
  content: string
  /** The button element to wrap */
  children: React.ReactNode
  /** Position of the tooltip */
  position?: TooltipPosition
  /** Additional class name */
  className?: string
}

export function IconButtonTooltip({
  content,
  children,
  position = 'top',
  className = '',
}: IconButtonTooltipProps) {
  return (
    <Tooltip 
      content={content} 
      position={position} 
      showDelay={100}
      className={className}
    >
      {children}
    </Tooltip>
  )
}

export default Tooltip
