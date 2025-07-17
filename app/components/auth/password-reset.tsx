'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function PasswordReset() {
  const [isResetting, setIsResetting] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      // Implement password reset logic here
      // For now, we'll just show a message
      setMessage('If an account exists for this email, a password reset link has been sent.')
      setIsResetting(false)
    } catch {
      setMessage('An error occurred while requesting a password reset.')
    }
  }

  if (!isResetting) {
    return (
      <p className="text-sm text-gray-400 text-center">
        <span
          className="cursor-pointer hover:text-white transition-colors"
          onClick={() => setIsResetting(true)}
        >
          ¿Olvidaste la contraseña?
        </span>
      </p>
    )
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      {message && <p className="text-sm text-blue-500">{message}</p>}
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button type="submit" className="w-full">
        Restablecer contraseña
      </Button>
      <p className="text-sm text-gray-400 text-center">
        <span
          className="cursor-pointer hover:text-white transition-colors"
          onClick={() => setIsResetting(false)}
        >
          Volver al inicio de sesión
        </span>
      </p>
    </form>
  )
}

