'use client'

import React, { useState } from 'react'
import { useI18n, interpolate } from '@/app/i18n'
import { AuthorizationStatusBadge } from '@/app/components/flight-plans/StatusBadge'
import { formatDateForDisplay } from '@/lib/date-utils'
import ActivateFlightModal from './ActivateFlightModal'

// ── Types ────────────────────────────────────────────────────────────────────

interface FlightPlanActivationCardPlan {
  id: number
  customName: string
  scheduledAt: string | null
  activationStatus: string
  activatedAt: string | null
  activationMessage: string | null
  externalResponseNumber: string | null
  uplan: unknown
  fileContent: string | null
  authorizationStatus: string
  status: string
}

export interface FlightPlanActivationCardProps {
  plan: FlightPlanActivationCardPlan
  now: Date
  onActivated: () => void
}

// ── Spinner ──────────────────────────────────────────────────────────────────

const Spinner: React.FC<{ size?: number }> = ({ size = 16 }) => (
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Attempt to parse a string as JSON and stringify it as a human-readable
 * message. Falls back to the raw string on failure.
 */
function parseActivationMessage(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      return String((parsed as Record<string, unknown>).message)
    }
    return JSON.stringify(parsed)
  } catch {
    return raw
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function FlightPlanActivationCard({
  plan,
  now,
  onActivated,
}: FlightPlanActivationCardProps) {
  const { t } = useI18n()
  const pt = t.planActivation

  const [modalOpen, setModalOpen] = useState(false)

  // ── Activation window logic ─────────────────────────────────────────────

  const scheduledMs = plan.scheduledAt ? new Date(plan.scheduledAt).getTime() : null
  const nowMs = now.getTime()

  const windowOpenMs = scheduledMs !== null ? scheduledMs - 60_000 : null
  const windowCloseMs = scheduledMs !== null ? scheduledMs + 60_000 : null

  const windowNotYetOpen =
    windowOpenMs !== null && nowMs < windowOpenMs
  const windowAlreadyClosed =
    windowCloseMs !== null && nowMs > windowCloseMs

  const windowIsOpen =
    windowOpenMs !== null &&
    windowCloseMs !== null &&
    nowMs >= windowOpenMs &&
    nowMs <= windowCloseMs

  // ── "PUEDE DESPEGAR" state ─────────────────────────────────────────────

  const activatedAtMs = plan.activatedAt ? new Date(plan.activatedAt).getTime() : null
  const msSinceActivation = activatedAtMs !== null ? nowMs - activatedAtMs : null
  const canTakeoff =
    activatedAtMs !== null &&
    msSinceActivation !== null &&
    msSinceActivation < 60_000

  const takeoffSecondsRemaining = canTakeoff && msSinceActivation !== null
    ? 60 - Math.floor(msSinceActivation / 1000)
    : 0

  // ── Button disabled logic ─────────────────────────────────────────────

  const isActivating = plan.activationStatus === 'activando'
  const alreadyActivated = activatedAtMs !== null

  const buttonDisabled =
    !windowIsOpen ||
    isActivating ||
    alreadyActivated

  // Tooltip message for the button
  let buttonTooltip: string | undefined
  if (windowNotYetOpen) {
    buttonTooltip = pt.windowNotOpen
  } else if (windowAlreadyClosed || plan.activationStatus === 'ventana_pasada') {
    buttonTooltip = pt.windowClosed
  }

  // ── Activation message ─────────────────────────────────────────────────

  const parsedMessage = parseActivationMessage(plan.activationMessage)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            <span
              className="font-semibold text-base truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {plan.customName}
            </span>
            {plan.scheduledAt && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatDateForDisplay(plan.scheduledAt, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <AuthorizationStatusBadge
            status={plan.authorizationStatus as Parameters<typeof AuthorizationStatusBadge>[0]['status']}
          />
        </div>

        {/* ── "PUEDE DESPEGAR" panel ── */}
        {canTakeoff && (
          <div
            className="rounded-md px-4 py-3 flex flex-col items-center gap-1 text-center"
            style={{
              backgroundColor: 'var(--color-success-bg, #dcfce7)',
              border: '2px solid var(--color-success, #16a34a)',
            }}
          >
            <span
              className="text-xl font-extrabold tracking-wide"
              style={{ color: 'var(--color-success, #16a34a)' }}
            >
              {pt.canTakeoff}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--color-success, #16a34a)' }}
            >
              {interpolate(pt.canTakeoffCountdown, { s: takeoffSecondsRemaining })}
            </span>
          </div>
        )}

        {/* ── Activation state info (when not in canTakeoff) ── */}
        {!canTakeoff && (
          <>
            {plan.activationStatus === 'denegado_activacion' && (
              <div
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--color-error-bg, #fef2f2)',
                  border: '1px solid var(--color-error, #f87171)',
                  color: 'var(--color-error, #b91c1c)',
                }}
              >
                <span className="font-semibold">{pt.activationDeniedStatus}</span>
                {parsedMessage && (
                  <p className="mt-1 text-xs">{parsedMessage}</p>
                )}
              </div>
            )}

            {plan.activationStatus === 'ventana_pasada' && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {pt.windowClosed}
              </p>
            )}

            {isActivating && (
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Spinner size={14} />
                <span>{pt.activating}</span>
              </div>
            )}
          </>
        )}

        {/* ── "Activar vuelo" button ── */}
        {!canTakeoff && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={buttonDisabled}
              title={buttonTooltip}
              onClick={() => setModalOpen(true)}
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: buttonDisabled
                  ? undefined
                  : 'var(--brand-primary, #2563eb)',
                color: buttonDisabled ? undefined : '#fff',
                borderWidth: buttonDisabled ? '1px' : undefined,
                borderStyle: buttonDisabled ? 'solid' : undefined,
                borderColor: buttonDisabled ? 'var(--border-primary)' : undefined,
              }}
            >
              {pt.activateButton}
            </button>
          </div>
        )}
      </div>

      {/* ── Activate flight modal ── */}
      <ActivateFlightModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onActivated={() => {
          setModalOpen(false)
          onActivated()
        }}
        planId={plan.id}
        planName={plan.customName}
      />
    </>
  )
}

export default FlightPlanActivationCard
