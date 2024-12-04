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
      if (token) {
        try {
          const response = await axios.get('/api/user', {
            headers: { Authorization: `Bearer ${token}` }
          })
          setUser(response.data)
        } catch (error) {
          console.error('Error fetching user:', error)
          localStorage.removeItem('authToken')
        }
      }
      setLoading(false)
    }

    fetchUser()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password })
      const { token, user } = response.data
      localStorage.setItem('authToken', token)
      setUser(user)
      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    setUser(null)
  }

  return { user, loading, login, logout }
}

