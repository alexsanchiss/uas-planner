'use client'

import React, { useState } from 'react'
import { useI18n, interpolate } from '@/app/i18n'
import { AuthorizationStatusBadge } from '@/app/components/flight-plans/StatusBadge'
import { formatDateForDisplay } from '@/lib/date-utils'
import { CircleAlert, Clock, Loader2, Plane, Timer } from 'lucide-react'
import ActivateFlightModal from './ActivateFlightModal'
import { Countdown } from './Countdown'

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
  const at = t.activation

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

  // ── "Can take off" state ─────────────────────────────────────────────

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
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-base font-semibold text-fg">{plan.customName}</span>
            {plan.scheduledAt && (
              <span className="text-sm text-fg-2">
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

        {/* ── Window countdown (text + icon; coarse aria-live) ── */}
        {!canTakeoff && windowIsOpen && !alreadyActivated && windowCloseMs !== null && (
          <Countdown
            seconds={(windowCloseMs - nowMs) / 1000}
            template={at.windowClosesIn}
            icon={Timer}
            className="text-fg-2"
          />
        )}

        {/* ── Can-take-off panel ── */}
        {canTakeoff && (
          <div
            role="status"
            className="flex flex-col items-center gap-1 rounded-md border-2 border-success bg-success-soft px-4 py-3 text-center text-success-text"
          >
            <span className="flex items-center gap-2 text-xl font-extrabold tracking-wide">
              <Plane className="h-5 w-5" aria-hidden="true" />
              {pt.canTakeoff}
            </span>
            {/* aria-hidden: ticks every second, the status text above is announced once */}
            <span aria-hidden="true" className="text-sm font-medium tabular-nums">
              {interpolate(pt.canTakeoffCountdown, { s: takeoffSecondsRemaining })}
            </span>
          </div>
        )}

        {/* ── Activation state info (when not in canTakeoff) ── */}
        {!canTakeoff && (
          <>
            {plan.activationStatus === 'denegado_activacion' && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-text"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-semibold">{pt.activationDeniedStatus}</span>
                  {parsedMessage && <p className="mt-1 text-xs">{parsedMessage}</p>}
                </div>
              </div>
            )}

            {plan.activationStatus === 'ventana_pasada' && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {pt.windowClosed}
              </p>
            )}

            {isActivating && (
              <div role="status" className="flex items-center gap-2 text-sm text-fg-2">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                <span>{pt.activating}</span>
              </div>
            )}
          </>
        )}

        {/* ── "Activate flight" button ── */}
        {!canTakeoff && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={buttonDisabled}
              title={buttonTooltip}
              onClick={() => setModalOpen(true)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-surface-2 disabled:text-muted"
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

/**
 * Compact, informative row for an authorized flight whose activation window is not open yet.
 * No Activate button: the window opens 1 minute before the scheduled time.
 */
export function UpcomingPlanCard({ plan, now }: { plan: FlightPlanActivationCardPlan; now: Date }) {
  const { t } = useI18n()
  const scheduledMs = plan.scheduledAt ? new Date(plan.scheduledAt).getTime() : null
  const opensInSeconds = scheduledMs !== null ? (scheduledMs - 60_000 - now.getTime()) / 1000 : 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-base font-semibold text-fg">{plan.customName}</span>
        {plan.scheduledAt && (
          <span className="text-sm text-fg-2">
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
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <AuthorizationStatusBadge
          status={plan.authorizationStatus as Parameters<typeof AuthorizationStatusBadge>[0]['status']}
        />
        <Countdown
          seconds={opensInSeconds}
          template={t.activation.windowOpensIn}
          icon={Clock}
          className="text-fg-2"
        />
      </div>
    </div>
  )
}

export default FlightPlanActivationCard
