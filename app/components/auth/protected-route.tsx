'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../i18n'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/** Full-area status shown while auth is checked or the redirect to /login happens. Theme tokens only (UI-13). */
function AuthStatus({ message }: { message: string }) {
  return (
    <div role="status" className="flex min-h-[50vh] flex-1 items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand motion-reduce:animate-none"
        />
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  )
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
  const { user, loading } = useAuth()
  const { t } = useI18n()
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
  if (loading) return <AuthStatus message={t.shell.verifyingAuth} />

  // Don't render anything while redirecting
  if (!user) return <AuthStatus message={t.shell.redirectingToLogin} />

  // User is authenticated, render the protected content
  return <>{children}</>
}
