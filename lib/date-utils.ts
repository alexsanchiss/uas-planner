/**
 * Date and Timezone Utilities
 * 
 * This module provides utility functions for handling dates and timezones
 * consistently across the application. All database storage uses UTC,
 * while display uses the user's local timezone.
 * 
 * TASK-209: Date/timezone utilities
 */

/**
 * Convert a UTC ISO string, Date, or any date value to local datetime-local format
 * The datetime-local input expects "YYYY-MM-DDTHH:mm" in LOCAL time
 * 
 * @param utcValue - A UTC ISO string, Date object, or null/undefined
 * @returns A local datetime string in "YYYY-MM-DDTHH:mm" format, or empty string
 */
export function utcToLocalDatetimeString(utcValue: string | Date | undefined | null): string {
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
 * 
 * @param localValue - A local datetime string in "YYYY-MM-DDTHH:mm" format
 * @returns A UTC ISO string, or empty string if invalid
 */
export function localDatetimeStringToUtc(localValue: string): string {
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
 * Get timezone information for the current environment
 * 
 * @returns Object containing UTC offset string, timezone name, and abbreviation
 */
export function getTimezoneInfo(): {
  offset: string
  name: string
  abbreviation: string
  offsetMinutes: number
} {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() // In minutes, positive for west of UTC
  const offsetHours = Math.abs(Math.floor(timezoneOffset / 60))
  const offsetMinutes = Math.abs(timezoneOffset % 60)
  const offsetSign = timezoneOffset <= 0 ? '+' : '-'
  const offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`
  
  // Get timezone name (e.g., "Europe/Madrid", "America/New_York")
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone
  
  // Get abbreviation (e.g., "CET", "EST")
  const abbreviation = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || ''
  
  return {
    offset: offsetString,
    name: timezoneName,
    abbreviation,
    offsetMinutes: -timezoneOffset, // Return positive for east of UTC
  }
}

/**
 * Format a date for display with timezone consideration
 * 
 * @param date - Date string, Date object, or null/undefined
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string or placeholder for invalid/empty dates
 */
export function formatDateForDisplay(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  if (!date) return 'No programado'
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return 'Fecha inválida'
    
    return dateObj.toLocaleString(undefined, options)
  } catch {
    return 'Fecha inválida'
  }
}

/**
 * Check if a date is in the past
 * 
 * @param date - Date string or Date object
 * @returns true if the date is before now
 */
export function isDateInPast(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj < new Date()
}

/**
 * Check if a date is in the future
 * 
 * @param date - Date string or Date object
 * @returns true if the date is after now
 */
export function isDateInFuture(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj > new Date()
}

/**
 * Parse an ISO date string safely
 * 
 * @param dateString - An ISO date string
 * @returns Date object or null if invalid
 */
export function parseIsoDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  
  try {
    const date = new Date(dateString)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Get the start of a day in local timezone
 * 
 * @param date - Date object or string
 * @returns Date object set to 00:00:00.000 in local timezone
 */
export function startOfDay(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the end of a day in local timezone
 * 
 * @param date - Date object or string
 * @returns Date object set to 23:59:59.999 in local timezone
 */
export function endOfDay(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Add a duration to a date
 * 
 * @param date - Base date
 * @param duration - Object with days, hours, minutes, seconds to add
 * @returns New Date object with duration added
 */
export function addDuration(
  date: string | Date,
  duration: { days?: number; hours?: number; minutes?: number; seconds?: number }
): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  
  if (duration.days) d.setDate(d.getDate() + duration.days)
  if (duration.hours) d.setHours(d.getHours() + duration.hours)
  if (duration.minutes) d.setMinutes(d.getMinutes() + duration.minutes)
  if (duration.seconds) d.setSeconds(d.getSeconds() + duration.seconds)
  
  return d
}

/**
 * Format duration in human-readable format
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1h 30m" or "45s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.round(seconds % 60)
  
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${hours}h`
  }
  
  if (remainingSeconds > 0 && minutes < 10) {
    return `${minutes}m ${remainingSeconds}s`
  }
  
  return `${minutes}m`
}

/**
 * Check if two dates are on the same day (in local timezone)
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates are on the same calendar day
 */
export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2
  
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * 
 * @param date - Date to compare with now
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)
  
  // Past
  if (diffMs < 0) {
    if (-diffSec < 60) return 'hace un momento'
    if (-diffMin < 60) return `hace ${-diffMin} minuto${-diffMin === 1 ? '' : 's'}`
    if (-diffHour < 24) return `hace ${-diffHour} hora${-diffHour === 1 ? '' : 's'}`
    if (-diffDay < 30) return `hace ${-diffDay} día${-diffDay === 1 ? '' : 's'}`
    return formatDateForDisplay(d, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  
  // Future
  if (diffSec < 60) return 'ahora'
  if (diffMin < 60) return `en ${diffMin} minuto${diffMin === 1 ? '' : 's'}`
  if (diffHour < 24) return `en ${diffHour} hora${diffHour === 1 ? '' : 's'}`
  if (diffDay < 30) return `en ${diffDay} día${diffDay === 1 ? '' : 's'}`
  return formatDateForDisplay(d, { year: 'numeric', month: 'short', day: 'numeric' })
}
