'use client'

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { HelpTooltip } from '../ui/tooltip'

export interface DateTimePickerProps {
  /**
   * The datetime value. Can be:
   * - An ISO 8601 UTC string from the database (e.g., "2026-01-13T14:30:00.000Z")
   * - A Date object
   * - A local datetime string (e.g., "2026-01-13T14:30")
   * - Empty string, null, or undefined
   * 
   * The component automatically converts UTC to local for display.
   */
  value?: string | Date | null
  /**
   * Called when the user selects a new datetime.
   * Returns an ISO 8601 UTC string suitable for database storage.
   */
  onChange: (utcIsoString: string) => void
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
 * Convert a UTC ISO string, Date, or any date value to local datetime-local format
 * The datetime-local input expects "YYYY-MM-DDTHH:mm" in LOCAL time
 */
function utcToLocalDatetimeString(utcValue: string | Date | undefined | null): string {
  if (!utcValue) return ''
  
  try {
    const date = typeof utcValue === 'string' ? new Date(utcValue) : utcValue
    if (isNaN(date.getTime())) return ''
    
    // Format as local datetime-local string (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

/**
 * Convert a local datetime-local string to UTC ISO string for storage
 * The datetime-local input returns "YYYY-MM-DDTHH:mm" in LOCAL time
 */
function localDatetimeStringToUtc(localValue: string): string {
  if (!localValue) return ''
  
  try {
    // Parse as local time (Date constructor interprets "YYYY-MM-DDTHH:mm" as local)
    const date = new Date(localValue)
    if (isNaN(date.getTime())) return ''
    
    // Convert to UTC ISO string
    return date.toISOString()
  } catch {
    return ''
  }
}

/**
 * DateTimePicker - Timezone-aware datetime picker component
 * 
 * Features:
 * - Uses native datetime-local input for cross-browser compatibility
 * - Automatically converts between UTC (API/storage) and local time (display)
 * - Displays current timezone indicator with UTC offset
 * - Supports min/max date constraints
 * - Error state styling
 * 
 * IMPORTANT: Timezone handling
 * - Values from API (UTC) are converted to local time for display
 * - Values from input are converted back to UTC for storage
 * - The timezone indicator shows the user's current timezone
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
  // Convert UTC value from API to local datetime-local format
  const apiValue = useMemo(() => utcToLocalDatetimeString(value), [value])
  
  // Local state for input value (to allow typing without immediate API calls)
  const [localValue, setLocalValue] = useState(apiValue)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Sync local state with API value when it changes externally
  useEffect(() => {
    setLocalValue(apiValue)
  }, [apiValue])
  
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

  // Handle change: convert local datetime to UTC for storage with debouncing
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const localInput = e.target.value
    setLocalValue(localInput)
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Debounce the API call (800ms)
    debounceTimerRef.current = setTimeout(() => {
      if (!localInput) {
        onChange('')
        return
      }
      const utcIso = localDatetimeStringToUtc(localInput)
      onChange(utcIso)
    }, 800)
  }, [onChange])
  
  // Handle blur: immediately save on blur (in case user clicks away before debounce)
  const handleBlur = useCallback(() => {
    // Clear debounce timer and save immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (!localValue) {
      onChange('')
      return
    }
    const utcIso = localDatetimeStringToUtc(localValue)
    // Only call onChange if value actually changed
    if (utcIso !== (value ? new Date(value as string).toISOString() : '')) {
      onChange(utcIso)
    }
  }, [localValue, value, onChange])
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const inputId = `datetime-picker-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className={`w-full ${className}`}>
      {/* Label with help tooltip (TASK-203) */}
      {label && (
        <div className="flex items-center gap-1 mb-1">
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <HelpTooltip
            content="Select the scheduled date and time for the flight. It will be used to generate the U-Plan and request authorization. Time is shown in your local timezone but stored in UTC."
            position="right"
            size="sm"
          />
        </div>
      )}

      {/* Input container */}
      <div className="relative">
        <input
          type="datetime-local"
          id={inputId}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
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

      {/* Timezone indicator - Enhanced visual display */}
      {showTimezone && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Timezone:</span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {timezoneInfo.offset}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            ({timezoneInfo.name})
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
