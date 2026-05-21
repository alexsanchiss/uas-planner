import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

interface User {
  id: number
  username: string
  email?: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

const AUTH_TOKEN_KEY = 'authToken'
const SENSITIVE_STORAGE_KEYS = [AUTH_TOKEN_KEY]

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

function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 < Date.now()
}

function clearSensitiveData(): void {
  SENSITIVE_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key)
  })
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshingRef = useRef(false)

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshingRef.current) {
      return null
    }

    refreshingRef.current = true
    try {
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true,
      })
      const { token } = response.data
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token)
        return token
      }
      return null
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    } finally {
      refreshingRef.current = false
    }
  }, [])

  const fetchUser = useCallback(async () => {
    let token = localStorage.getItem(AUTH_TOKEN_KEY)

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    if (isTokenExpired(token)) {
      token = await refreshAccessToken()
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }
    }

    try {
      const response = await axios.get('/api/user', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(response.data)
    } catch (error) {
      console.error('Error fetching user:', error)
      if (axios.isAxiosError(error)) {
        const status = error.response?.status

        if (status === 404) {
          console.warn('User not found - account may have been deleted')
          clearSensitiveData()
          setUser(null)
          setLoading(false)
          return
        }

        if (status === 401) {
          const newToken = await refreshAccessToken()
          if (newToken) {
            try {
              const retryResponse = await axios.get('/api/user', {
                headers: { Authorization: `Bearer ${newToken}` }
              })
              setUser(retryResponse.data)
              return
            } catch (retryError) {
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
  }, [refreshAccessToken])

  useEffect(() => {
    fetchUser()

    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY) {
        if (e.newValue === null && e.oldValue !== null) {
          setUser(null)
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        } else if (e.newValue !== null) {
          setLoading(true)
          fetchUser()
        }
      }
    }
    window.addEventListener('storage', onStorage)

    const onAuthChanged = () => {
      setLoading(true)
      fetchUser()
    }
    window.addEventListener('auth:changed', onAuthChanged as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('auth:changed', onAuthChanged as EventListener)
    }
  }, [fetchUser])

  const login = async (email: string, password: string): Promise<boolean | { requiresVerification: true; email: string }> => {
    try {
      const response = await axios.post('/api/auth/login', { email, password }, {
        withCredentials: true,
      })

      if (response.data.requiresVerification) {
        return { requiresVerification: true, email: response.data.email }
      }

      const { token } = response.data
      localStorage.setItem(AUTH_TOKEN_KEY, token)

      window.dispatchEvent(new Event('auth:changed'))

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
    clearSensitiveData()
    setUser(null)

    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true })
    } catch {
      // Logout endpoint may fail, that's ok - local state is already cleared
    }

    window.dispatchEvent(new Event('auth:changed'))
  }

  return { user, loading, login, logout, refreshAccessToken }
}
