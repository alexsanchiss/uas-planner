import { useState, useEffect } from 'react'
import axios from 'axios'

interface User {
  id: number
  username: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('authToken')
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const response = await axios.get('/api/user', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setUser(response.data)
      } catch (error) {
        console.error('Error fetching user:', error)
        localStorage.removeItem('authToken')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    // Initial load
    fetchUser()

    // Listen for auth changes from other tabs/components
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'authToken') {
        setLoading(true)
        fetchUser()
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
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password })
      const { token } = response.data
      localStorage.setItem('authToken', token)
      // Notify listeners and refresh user info from API to keep a single source of truth
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

  const logout = () => {
    localStorage.removeItem('authToken')
    setUser(null)
    window.dispatchEvent(new Event('auth:changed'))
  }

  return { user, loading, login, logout }
}

