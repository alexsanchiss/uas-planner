'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { PasswordReset } from './password-reset'
import { LoadingSpinner } from '../ui/loading-spinner'

interface LoginFormProps {
  onLoginSuccess: () => void
}

interface FormErrors {
  email?: string
  password?: string
  general?: string
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!email) {
      newErrors.email = 'El email es requerido'
    } else if (!EMAIL_REGEX.test(email)) {
      newErrors.email = 'Por favor, introduce un email válido'
    }

    // Password validation
    if (!password) {
      newErrors.password = 'La contraseña es requerida'
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

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
        // Handle specific error messages
        if (response.status === 401) {
          setErrors({ general: 'Credenciales incorrectas. Por favor, verifica tu email y contraseña.' })
        } else if (response.status === 404) {
          setErrors({ general: 'Usuario no encontrado. ¿Quizás necesitas registrarte?' })
        } else if (response.status === 429) {
          setErrors({ general: 'Demasiados intentos. Por favor, espera unos minutos.' })
        } else {
          setErrors({ general: data.error || 'Ocurrió un error durante el inicio de sesión' })
        }
      }
    } catch (error) {
      // Network error or server unavailable
      setErrors({ general: 'Error de conexión. Por favor, verifica tu conexión a internet.' })
    } finally {
      setIsLoading(false)
    }
  }

  const inputErrorClass = 'border-red-500 focus:ring-red-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* General error message */}
      {errors.general && (
        <div className="p-3 bg-red-500/10 border border-red-500 rounded-md">
          <p className="text-red-400 text-sm">{errors.general}</p>
        </div>
      )}

      <div className="space-y-1">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          className={errors.email ? inputErrorClass : ''}
          disabled={isLoading}
          required
        />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
      </div>

      <div className="space-y-1">
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          className={errors.password ? inputErrorClass : ''}
          disabled={isLoading}
          required
        />
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
      </div>

      <Button 
        type="submit" 
        className="w-full flex items-center justify-center gap-2" 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Iniciando sesión...</span>
          </>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
      <PasswordReset />
    </form>
  )
}

