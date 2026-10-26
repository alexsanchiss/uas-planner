import React from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

/**
 * Shared card for login/sign-up, verify-email, forgot-password and reset-password.
 * Theme tokens only. The shell already provides the single <main>, so the card renders none.
 */
export function AuthCard({
  title,
  description,
  hideTitle = false,
  children,
}: {
  title: string
  description?: string
  /** Keep the h1 for screen readers only (login: the tabs already name the mode). */
  hideTitle?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex w-full flex-1 items-start justify-center px-4 py-12 sm:items-center sm:py-20">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-theme-md">
        <h1 className={hideTitle ? 'sr-only' : `text-2xl font-bold text-fg ${description ? 'mb-2' : 'mb-4'}`}>
          {title}
        </h1>
        {description && <p className="mb-6 text-sm text-fg-2">{description}</p>}
        {children}
      </div>
    </div>
  )
}

/** Same card shape with grey blocks: shown by the Suspense fallbacks. */
export function AuthCardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex w-full flex-1 items-start justify-center px-4 py-12 sm:items-center sm:py-20">
      <div
        role="status"
        aria-label={label}
        className="w-full max-w-sm animate-pulse rounded-lg border border-line bg-surface p-6 shadow-theme-md motion-reduce:animate-none"
      >
        <div className="mb-6 h-8 w-32 rounded bg-subtle" />
        <div className="space-y-4">
          <div className="h-10 rounded bg-subtle" />
          <div className="h-10 rounded bg-subtle" />
          <div className="h-10 rounded bg-subtle" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}

/** Error message under the title, announced by screen readers when it appears. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mb-4 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-text">
      {children}
    </p>
  )
}

/** Positive result message (verified, password reset...). */
export function AuthSuccess({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mb-4 text-success-text">
      {children}
    </p>
  )
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

export const authLinkClass = `rounded-sm text-brand-text hover:underline ${focusRing}`

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={authLinkClass}>
      {children}
    </Link>
  )
}

type AuthButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  /** Pending state: disables the button, shows a spinner and sets aria-busy. */
  pending?: boolean
}

/** Full-width action button. Token colors keep AA contrast in both themes (primary and secondary). */
export function AuthButton({ variant = 'primary', pending = false, className = '', children, disabled, ...props }: AuthButtonProps) {
  const tone =
    variant === 'primary'
      ? 'bg-brand text-brand-fg hover:bg-brand-hover'
      : 'border border-line-2 bg-surface-2 text-fg hover:bg-hover'
  return (
    <button
      type="button"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${tone} ${focusRing} ${className}`}
      {...props}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  )
}
