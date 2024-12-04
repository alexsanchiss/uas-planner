'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from './ui/button'
import { useAuth } from '../hooks/useAuth'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors">
            Home
          </Link>
          <Link href="/trajectory-generator" className="text-gray-300 hover:text-white transition-colors">
            Trajectory Generator
          </Link>
        </div>
        <div className="flex-shrink-0">
          <Image src="/images/logo.jpg" alt="UAS PLANNER Logo" width={150} height={50} />
        </div>
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                <Image src="/images/pfp.jpg" alt="User Profile" width={32} height={32} className="rounded-full" />
                <span className="text-gray-300">{user.username}</span>
              </div>
              <Button onClick={logout} variant="outline" size="sm">
                Cerrar sesión
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm">
                Iniciar sesión
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
