'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthContext } from './auth-provider'
import { LoadingSpinner } from '../ui/loading-spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute wrapper component that guards routes requiring authentication.
 * 
 * Behavior:
 * - Shows loading spinner while checking auth state
 * - Redirects to /login with return URL if not authenticated
 * - Renders children if authenticated
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect after loading is complete and we know user is not authenticated
    if (!loading && !user) {
      // Encode the current path for the redirect parameter
      const redirectUrl = encodeURIComponent(pathname || '/')
      router.replace(`/login?redirect=${redirectUrl}`)
    }
  }, [loading, user, router, pathname])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 text-sm">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  // Don't render anything while redirecting
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 text-sm">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    )
  }

  // User is authenticated, render the protected content
  return <>{children}</>
}
