'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/modal'
import JsonViewerSections from './JsonViewerSections'
import { useI18n, interpolate } from '@/app/i18n'

export interface ActivateFlightModalProps {
  open: boolean
  onClose: () => void
  onActivated: () => void
  planId: number
  planName: string
}

// ── Spinner ─────────────────────────────────────────────────────────────────

const Spinner: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    className="animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
)

// ── Component ────────────────────────────────────────────────────────────────

export function ActivateFlightModal({
  open,
  onClose,
  onActivated,
  planId,
  planName,
}: ActivateFlightModalProps) {
  const { t } = useI18n()
  const pt = t.planActivation

  // Terms fetch state
  const [termsData, setTermsData] = useState<unknown>(null)
  const [termsLoading, setTermsLoading] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)

  // Form state
  const [accepted, setAccepted] = useState(false)

  // Activation state
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState<string | null>(null)

  // Retry countdown state
  const [retryCountdown, setRetryCountdown] = useState<number>(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch terms on open ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    // Reset state on each open
    setTermsData(null)
    setTermsError(null)
    setAccepted(false)
    setActivationError(null)
    setRetryCountdown(0)

    let cancelled = false
    setTermsLoading(true)

    const token =
      typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

    fetch(`/api/flightPlans/${planId}/terms`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? pt.termsError)
        }
        const data = await res.json()
        if (!cancelled) setTermsData(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setTermsError(err.message ?? pt.termsError)
      })
      .finally(() => {
        if (!cancelled) setTermsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, planId, pt.termsError])

  // ── Countdown cleanup on close ───────────────────────────────────────────

  useEffect(() => {
    if (!open && countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
      setRetryCountdown(0)
    }
  }, [open])

  // ── Activation handler ───────────────────────────────────────────────────

  async function handleActivate() {
    if (!accepted) return

    setActivating(true)
    setActivationError(null)

    const token =
      typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

    try {
      const res = await fetch(`/api/flightPlans/${planId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ termsAccepted: true }),
      })

      const body = await res.json().catch(() => ({}))

      if (res.ok && body?.message === 'Activación autorizada') {
        onActivated()
        onClose()
        return
      }

      // Denial response
      const errorMsg: string =
        body?.message ?? body?.error ?? pt.activationDenied
      setActivationError(errorMsg)

      // Start cooldown if retryAt is provided
      const retryAt: unknown = body?.retryAt
      if (retryAt) {
        const targetMs =
          typeof retryAt === 'string' || typeof retryAt === 'number'
            ? new Date(retryAt).getTime()
            : NaN

        if (!isNaN(targetMs)) {
          const startSeconds = Math.max(
            0,
            Math.ceil((targetMs - Date.now()) / 1000)
          )

          if (startSeconds > 0) {
            setRetryCountdown(startSeconds)

            countdownRef.current = setInterval(() => {
              setRetryCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(countdownRef.current!)
                  countdownRef.current = null
                  return 0
                }
                return prev - 1
              })
            }, 1000)
          }
        }
      }
    } catch {
      setActivationError(pt.activationDenied)
    } finally {
      setActivating(false)
    }
  }

  // ── Derived booleans ─────────────────────────────────────────────────────

  const isCoolingDown = retryCountdown > 0
  const canActivate = accepted && !activating && !isCoolingDown

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} title={`${pt.modalTitle} — ${planName}`} maxWidth="2xl">
      {/* Terms section */}
      <div
        className="mb-5 rounded-lg border p-4 max-h-72 overflow-y-auto"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {termsLoading && (
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Spinner size={18} />
            <span>{pt.loadingTerms}</span>
          </div>
        )}

        {!termsLoading && termsError && (
          <p className="text-sm" style={{ color: 'var(--color-error, #ef4444)' }}>
            {termsError}
          </p>
        )}

        {!termsLoading && !termsError && termsData !== null && (
          <JsonViewerSections data={termsData} maxDepth={6} />
        )}
      </div>

      {/* Denial error banner */}
      {activationError && (
        <div
          className="mb-4 rounded-md border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-error, #f87171)',
            backgroundColor: 'var(--color-error-bg, #fef2f2)',
            color: 'var(--color-error, #b91c1c)',
          }}
          role="alert"
        >
          <span className="font-semibold">{pt.activationDenied}: </span>
          {activationError}
        </div>
      )}

      {/* Accept terms checkbox */}
      <label className="mb-5 flex cursor-pointer items-start gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand-primary)]"
          checked={accepted}
          disabled={activating}
          onChange={(e) => {
            setAccepted(e.target.checked)
          }}
        />
        <span>{pt.acceptTerms}</span>
      </label>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        >
          {pt.cancel}
        </button>

        <button
          type="button"
          onClick={handleActivate}
          disabled={!canActivate}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: canActivate ? 'var(--brand-primary, #2563eb)' : undefined,
            color: canActivate ? '#fff' : undefined,
          }}
        >
          {activating && <Spinner size={16} />}
          {activating
            ? pt.activating
            : isCoolingDown
            ? interpolate(pt.retryIn, { s: retryCountdown })
            : pt.activate}
        </button>
      </div>
    </Modal>
  )
}

export default ActivateFlightModal
