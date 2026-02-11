import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

interface User {
  id: number
  username: string
}

// LocalStorage keys for sensitive data
const AUTH_TOKEN_KEY = 'authToken'
const SENSITIVE_STORAGE_KEYS = [AUTH_TOKEN_KEY] // Add other keys if needed

// Decode JWT payload without verification (client-side)
function decodeTokenPayload(token: string): { exp?: number; userId?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

// Check if token is about to expire (within 2 minutes)
function isTokenExpiringSoon(token: string): boolean {
  const payload = decodeTokenPayload(token)
  if (!payload?.exp) return true
  const expiresAt = payload.exp * 1000 // Convert to milliseconds
  const twoMinutesFromNow = Date.now() + 2 * 60 * 1000
  return expiresAt < twoMinutesFromNow
}

// Check if token is expired
function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 < Date.now()
}

/**
 * Clear all sensitive data from localStorage
 */
function clearSensitiveData(): void {
  SENSITIVE_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key)
  })
  // Also clear any cached user-related data that might exist
  // Add more keys here if you cache other sensitive data
}

/**
 * Show session expired notification to user
 * Uses custom event for toast system integration (TASK-198)
 */
function notifySessionExpired(): void {
  // Use a non-blocking notification via custom event
  // The toast system listens to this event
  if (typeof window !== 'undefined') {
    // Dispatch a custom event that UI components can listen to
    window.dispatchEvent(new CustomEvent('auth:session-expired', {
      detail: { message: 'Your session has expired. Please log in again.' }
    }))
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshingRef = useRef(false)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionExpiredNotifiedRef = useRef(false)

  /**
   * Refresh the access token using the httpOnly refresh token cookie
   * Returns the new token or null if refresh failed
   */
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Prevent concurrent refresh requests
    if (refreshingRef.current) {
      return null
    }
    
    refreshingRef.current = true
    try {
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true, // Include cookies
      })
      const { token } = response.data
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token)
        sessionExpiredNotifiedRef.current = false // Reset notification flag on successful refresh
        return token
      }
      return null
    } catch (error) {
      console.error('Token refresh failed:', error)
      // If refresh fails, session is expired - notify user and clear auth state
      clearSensitiveData()
      setUser(null)
      
      // Only notify once per session expiration
      if (!sessionExpiredNotifiedRef.current) {
        sessionExpiredNotifiedRef.current = true
        notifySessionExpired()
        // Redirect to login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
      return null
    } finally {
      refreshingRef.current = false
    }
  }, [])

  /**
   * Schedule automatic token refresh before expiration
   */
  const scheduleTokenRefresh = useCallback((token: string) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const payload = decodeTokenPayload(token)
    if (!payload?.exp) return

    // Calculate when to refresh (2 minutes before expiration)
    const expiresAt = payload.exp * 1000
    const refreshAt = expiresAt - 120 * 1000 // 2 minutes before expiry
    const delay = refreshAt - Date.now()

    if (delay > 0) {
      refreshTimerRef.current = setTimeout(async () => {
        const newToken = await refreshAccessToken()
        if (newToken) {
          scheduleTokenRefresh(newToken)
        }
      }, delay)
    } else {
      // Token is expiring very soon or already expired, refresh now
      refreshAccessToken().then((newToken) => {
        if (newToken) {
          scheduleTokenRefresh(newToken)
        }
      })
    }
  }, [refreshAccessToken])

  const fetchUser = useCallback(async () => {
    let token = localStorage.getItem(AUTH_TOKEN_KEY)
    
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    // Check if token is expired or about to expire
    if (isTokenExpired(token) || isTokenExpiringSoon(token)) {
      // Try to refresh the token
      token = await refreshAccessToken()
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }
    }

    // Schedule automatic refresh for the valid token
    scheduleTokenRefresh(token)

    try {
      const response = await axios.get('/api/user', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(response.data)
    } catch (error) {
      console.error('Error fetching user:', error)
      // Handle edge case: token valid but user deleted (404) or unauthorized (401)
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        
        // User was deleted from database - clear auth and logout
        if (status === 404) {
          console.warn('User not found - account may have been deleted')
          clearSensitiveData()
          setUser(null)
          setLoading(false)
          return
        }
        
        // If unauthorized, try to refresh token
        if (status === 401) {
          const newToken = await refreshAccessToken()
          if (newToken) {
            try {
              const retryResponse = await axios.get('/api/user', {
                headers: { Authorization: `Bearer ${newToken}` }
              })
              setUser(retryResponse.data)
              scheduleTokenRefresh(newToken)
              return
            } catch (retryError) {
              // Handle edge case in retry: user deleted after token refresh
              if (axios.isAxiosError(retryError) && retryError.response?.status === 404) {
                console.warn('User not found after token refresh - account may have been deleted')
                clearSensitiveData()
                setUser(null)
                setLoading(false)
                return
              }
            }
          }
        }
      }
      clearSensitiveData()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [refreshAccessToken, scheduleTokenRefresh])

  useEffect(() => {
    // Initial load
    fetchUser()

    // Listen for auth changes from other tabs (cross-tab synchronization)
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY) {
        // If token was removed (logout in another tab)
        if (e.newValue === null && e.oldValue !== null) {
          // Another tab logged out - sync this tab
          setUser(null)
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current)
            refreshTimerRef.current = null
          }
          // Redirect to login if not already there
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        } else if (e.newValue !== null) {
          // Token was added or changed (login in another tab) - refresh user
          setLoading(true)
          fetchUser()
        }
      }
    }
    window.addEventListener('storage', onStorage)

    // Custom event within same tab to react immediately after login/logout
    const onAuthChanged = () => {
      setLoading(true)
      fetchUser()
    }
    window.addEventListener('auth:changed', onAuthChanged as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('auth:changed', onAuthChanged as EventListener)
      // Clear refresh timer on unmount
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [fetchUser])

  const login = async (email: string, password: string): Promise<boolean | { requiresVerification: true; email: string }> => {
    try {
      const response = await axios.post('/api/auth/login', { email, password }, {
        withCredentials: true, // Include cookies for refresh token
      })

      // Handle unverified email response
      if (response.data.requiresVerification) {
        return { requiresVerification: true, email: response.data.email }
      }

      const { token } = response.data
      localStorage.setItem(AUTH_TOKEN_KEY, token)
      
      // Reset session expired flag on successful login
      sessionExpiredNotifiedRef.current = false
      
      // Schedule automatic refresh
      scheduleTokenRefresh(token)
      
      // Notify listeners and refresh user info from API
      window.dispatchEvent(new Event('auth:changed'))
      
      // Optimistically fetch user immediately
      try {
        const me = await axios.get('/api/user', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setUser(me.data)
      } catch {
        // ignore, fetch will retry via effect
      }
      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    
    // Clear all sensitive data from localStorage (TASK-043)
    clearSensitiveData()
    
    // Clear user state
    setUser(null)
    
    // Clear the refresh token cookie by calling logout endpoint
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true })
    } catch {
      // Logout endpoint may fail, that's ok - local state is already cleared
    }
    
    // Notify other tabs and components
    window.dispatchEvent(new Event('auth:changed'))
  }

  return { user, loading, login, logout, refreshAccessToken }
}

