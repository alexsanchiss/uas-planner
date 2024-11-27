'use client'

import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface SignupFormProps {
  onSignup: () => void
}

export function SignupForm({ onSignup }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message);
        return;
      }

      console.log('Signup exitoso');
      onSignup(); // Cambia el estado de la aplicación para usuario autenticado
    } catch (error) {
      console.error('Error durante el registro:', error);
      alert('Hubo un problema al registrarse.');
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

