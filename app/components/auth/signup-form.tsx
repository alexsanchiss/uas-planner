'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { LoadingSpinner } from '../ui/loading-spinner'

interface SignupFormProps {
  onSignupSuccess: () => void
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  general?: string
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Password strength checks
const hasMinLength = (pwd: string) => pwd.length >= 8
const hasUppercase = (pwd: string) => /[A-Z]/.test(pwd)
const hasLowercase = (pwd: string) => /[a-z]/.test(pwd)
const hasNumber = (pwd: string) => /\d/.test(pwd)

export function SignupForm({ onSignupSuccess }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    // Password strength validation
    if (!password) {
      newErrors.password = 'La contraseña es requerida'
    } else {
      const strengthErrors: string[] = []
      if (!hasMinLength(password)) strengthErrors.push('al menos 8 caracteres')
      if (!hasUppercase(password)) strengthErrors.push('una mayúscula')
      if (!hasLowercase(password)) strengthErrors.push('una minúscula')
      if (!hasNumber(password)) strengthErrors.push('un número')
      
      if (strengthErrors.length > 0) {
        newErrors.password = `La contraseña debe contener: ${strengthErrors.join(', ')}`
      }
    }

    // Password confirmation validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Por favor, confirma tu contraseña'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Get password strength indicator
  const getPasswordStrength = () => {
    if (!password) return null
    let strength = 0
    if (hasMinLength(password)) strength++
    if (hasUppercase(password)) strength++
    if (hasLowercase(password)) strength++
    if (hasNumber(password)) strength++

    if (strength <= 1) return { level: 'weak', label: 'Débil', color: 'bg-red-500' }
    if (strength <= 2) return { level: 'fair', label: 'Regular', color: 'bg-yellow-500' }
    if (strength <= 3) return { level: 'good', label: 'Buena', color: 'bg-blue-500' }
    return { level: 'strong', label: 'Fuerte', color: 'bg-green-500' }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        onSignupSuccess()
      } else {
        const data = await response.json()
        // Handle specific error messages
        if (response.status === 409) {
          setErrors({ general: 'Este email ya está registrado. ¿Quizás quieres iniciar sesión?' })
        } else if (response.status === 400) {
          setErrors({ general: data.error || 'Datos de registro inválidos' })
        } else {
          setErrors({ general: data.error || 'Ocurrió un error durante el registro' })
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
  const passwordStrength = getPasswordStrength()

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
        {/* Password strength indicator */}
        {password && passwordStrength && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-600 rounded overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                style={{ 
                  width: passwordStrength.level === 'weak' ? '25%' : 
                         passwordStrength.level === 'fair' ? '50%' : 
                         passwordStrength.level === 'good' ? '75%' : '100%' 
                }}
              />
            </div>
            <span className="text-xs text-gray-400">{passwordStrength.label}</span>
          </div>
        )}
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
      </div>

      <div className="space-y-1">
        <Input
          type="password"
          placeholder="Confirmar contraseña"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
          }}
          className={errors.confirmPassword ? inputErrorClass : ''}
          disabled={isLoading}
          required
        />
        {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
      </div>

      <Button 
        type="submit" 
        className="w-full flex items-center justify-center gap-2" 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Registrando...</span>
          </>
        ) : (
          'Registrarse'
        )}
      </Button>
    </form>
  )
}

