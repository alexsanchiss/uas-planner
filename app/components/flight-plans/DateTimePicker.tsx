'use client'

import React, { useMemo } from 'react'

export interface DateTimePickerProps {
  value?: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
  required?: boolean
  min?: string
  max?: string
  error?: string
  showTimezone?: boolean
  className?: string
}

/**
 * DateTimePicker - Timezone-aware datetime picker component
 * 
 * Features:
 * - Uses native datetime-local input for cross-browser compatibility
 * - Displays current timezone indicator
 * - Supports min/max date constraints
 * - Error state styling
 */
export function DateTimePicker({
  value,
  onChange,
  label = 'Scheduled Date & Time',
  disabled = false,
  required = false,
  min,
  max,
  error,
  showTimezone = true,
  className = '',
}: DateTimePickerProps) {
  // Get timezone information
  const timezoneInfo = useMemo(() => {
    const now = new Date()
    const timezoneOffset = now.getTimezoneOffset()
    const offsetHours = Math.abs(Math.floor(timezoneOffset / 60))
    const offsetMinutes = Math.abs(timezoneOffset % 60)
    const offsetSign = timezoneOffset <= 0 ? '+' : '-'
    const offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`
    
    // Get timezone name (e.g., "Europe/Madrid", "America/New_York")
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    return {
      offset: offsetString,
      name: timezoneName,
      abbreviation: now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '',
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const inputId = `datetime-picker-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className={`w-full ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input container */}
      <div className="relative">
        <input
          type="datetime-local"
          id={inputId}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          min={min}
          max={max}
          className={`
            w-full px-3 py-2 border rounded-md shadow-sm
            text-gray-900 dark:text-white
            bg-white dark:bg-gray-800
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-100 disabled:dark:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60
            ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
            }
          `}
        />
      </div>

      {/* Timezone indicator */}
      {showTimezone && (
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            {timezoneInfo.abbreviation} ({timezoneInfo.offset}) - {timezoneInfo.name}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

export default DateTimePicker
