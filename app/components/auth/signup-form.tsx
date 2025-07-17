'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface SignupFormProps {
  onSignupSuccess: () => void
}

export function SignupForm({ onSignupSuccess }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      // setError('Passwords do not match') // This line was removed
      return
    }

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
        // setError(data.error || 'An error occurred during signup') // This line was removed
      }
    } catch (error) {
      // setError('An error occurred during signup') // This line was removed
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
      <Input
        type="password"
        placeholder="Confirmar contraseña"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <Button type="submit" className="w-full">
        Registrarse
      </Button>
    </form>
  )
}

