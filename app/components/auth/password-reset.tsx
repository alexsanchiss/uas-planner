'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function PasswordReset() {
  const [isResetting, setIsResetting] = useState(false)
  const [email, setEmail] = useState('')

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle password reset logic here
    console.log('Reset password for:', email)
    setIsResetting(false)
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

