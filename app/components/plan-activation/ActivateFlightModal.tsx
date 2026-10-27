'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
  const at = t.activation

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

      if (res.ok) {
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
    <Modal open={open} onClose={onClose} title={`${pt.modalTitle} - ${planName}`} maxWidth="2xl">
      {/* Terms section (scrollable: focusable so keyboard users can scroll it) */}
      <div
        role="region"
        aria-label={at.termsRegion}
        tabIndex={0}
        className="mb-5 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface-2 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        {termsLoading && (
          <div role="status" className="flex items-center gap-3 text-sm text-fg-2">
            <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>{pt.loadingTerms}</span>
          </div>
        )}

        {!termsLoading && termsError && (
          <p role="alert" className="text-sm text-danger-text">
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
          className="mb-4 rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-text"
          role="alert"
        >
          <span className="font-semibold">{pt.activationDenied}: </span>
          {activationError}
        </div>
      )}

      {/* Accept terms checkbox */}
      <label className="mb-5 flex cursor-pointer items-start gap-3 text-sm text-fg">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
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
          className="rounded-md bg-subtle px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          {pt.cancel}
        </button>

        <button
          type="button"
          onClick={handleActivate}
          disabled={!canActivate}
          aria-busy={activating || undefined}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-surface-2 disabled:text-muted"
        >
          {activating && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
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
