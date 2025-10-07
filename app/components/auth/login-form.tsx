'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { PasswordReset } from './password-reset'

interface LoginFormProps {
  onLoginSuccess: () => void
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const { token } = await response.json()
        localStorage.setItem('authToken', token)
        // Notify the app so hooks can refresh the current user immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:changed'))
        }
        onLoginSuccess()
      } else {
        const data = await response.json()
        // setError(data.error || 'An error occurred during login') // This line was removed
      }
    } catch (error) {
      // setError('An error occurred during login') // This line was removed
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* {error && <p className="text-red-500 text-sm">{error}</p>} */}
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" className="w-full">
        Iniciar sesión
      </Button>
      <PasswordReset />
    </form>
  )
}

