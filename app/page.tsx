'use client'

import { useState } from 'react'
import { PremiumAuth } from './components/auth/premium-auth'
import { MainPage } from './components/main-page'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleLogin = () => {
    setIsLoggedIn(true)
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <div className={`transition-all duration-500 ${isLoggedIn ? 'opacity-0 pointer-events-none h-0' : 'opacity-100'}`}>
        <PremiumAuth onLogin={handleLogin} />
      </div>
      <div className={`transition-all duration-500 ${isLoggedIn ? 'opacity-100' : 'opacity-0 pointer-events-none h-0'}`}>
        <MainPage />
      </div>
    </main>
  )
}

