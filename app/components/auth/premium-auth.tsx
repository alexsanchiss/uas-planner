'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'
import { Button } from '../ui/button'

interface PremiumAuthProps {
  onLoginSuccess: () => void
}

export function PremiumAuth({ onLoginSuccess }: PremiumAuthProps) {
  const [activeForm, setActiveForm] = useState<'login' | 'signup'>('login')

  return (
    <div className="w-full max-w-md">
      <div className="bg-gray-800 shadow-lg rounded-lg p-8 space-y-8">
        <div className="flex justify-center space-x-4">
          <Button
            variant={activeForm === 'login' ? 'default' : 'outline'}
            onClick={() => setActiveForm('login')}
            className="w-1/2"
          >
            Login
          </Button>
          <Button
            variant={activeForm === 'signup' ? 'default' : 'outline'}
            onClick={() => setActiveForm('signup')}
            className="w-1/2"
          >
            Signup
          </Button>
        </div>
        <div className="mt-8">
          {activeForm === 'login' ? (
            <LoginForm onLoginSuccess={onLoginSuccess} />
          ) : (
            <SignupForm onSignupSuccess={() => setActiveForm('login')} />
          )}
        </div>
      </div>
    </div>
  )
}

