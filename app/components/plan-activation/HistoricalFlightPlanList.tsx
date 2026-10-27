'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useI18n, interpolate } from '@/app/i18n'
import { AuthorizationStatusBadge, AuthorizationStatus } from '@/app/components/flight-plans/StatusBadge'
import { formatDateForDisplay } from '@/lib/date-utils'

interface HistoricalFlightPlan {
  id: number
  customName: string
  status: string
  authorizationStatus: AuthorizationStatus
  activationStatus: string | null
  activatedAt: string | null
  activationMessage: string | null
  scheduledAt: string | null
  externalResponseNumber: string | null
}

interface HistoryResponse {
  plans: HistoricalFlightPlan[]
  total: number
  limit: number
  offset: number
}

interface HistoricalFlightPlanListProps {
  className?: string
}

const PAGE_SIZE = 10

const pagerButton =
  'rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-40'

/** The section heading is the collapsible's toggle on the page, so this list renders no heading of its own. */
export function HistoricalFlightPlanList({ className = '' }: HistoricalFlightPlanListProps) {
  const { t } = useI18n()

  const [plans, setPlans] = useState<HistoricalFlightPlan[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const activationLabels: Record<string, string> = {
    activable: t.activation.statusActivable,
    activando: t.activation.statusActivating,
    autorizado_despegue: t.activation.statusTakeoffCleared,
    denegado_activacion: t.activation.statusDenied,
    ventana_pasada: t.activation.statusWindowPassed,
    'no activable': t.activation.statusNotActivable,
  }

  const fetchHistory = useCallback(async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * PAGE_SIZE
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const res = await fetch(
        `/api/flightPlans/history?limit=${PAGE_SIZE}&offset=${offset}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data: HistoryResponse = await res.json()
      setPlans(data.plans)
      setTotal(data.total)
    } catch {
      setError(t.errors.loadingFailed)
    } finally {
      setLoading(false)
    }
  }, [t.errors.loadingFailed])

  useEffect(() => {
    fetchHistory(currentPage)
  }, [currentPage, fetchHistory])

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1)
  }

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1)
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {loading && (
        <div role="status" className="space-y-2 py-2" aria-label={t.common.loading}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-subtle motion-reduce:animate-none" />
          ))}
          <span className="sr-only">{t.common.loading}</span>
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger-text">
          <span>{error}</span>
          <button type="button" onClick={() => fetchHistory(currentPage)} className={pagerButton}>
            {t.common.retry}
          </button>
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <p className="py-6 text-center text-sm text-fg-2">{t.planActivation.noHistory}</p>
      )}

      {!loading && !error && plans.length > 0 && (
        <>
          <div
            role="region"
            aria-label={t.activation.historyRegion}
            tabIndex={0}
            className="overflow-x-auto rounded-lg border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">{t.planActivation.historicalSection}</caption>
              <thead>
                <tr className="bg-surface-2 text-fg-2">
                  <th scope="col" className="px-4 py-3 text-left font-medium">{t.flightPlans.flightPlan}</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">{t.flightPlans.scheduledFor}</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">{t.flightPlans.authorize}</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">{t.activation.colActivation}</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">{t.activation.colActivatedAt}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-t border-line bg-canvas text-fg odd:bg-surface-2">
                    <th scope="row" className="px-4 py-3 text-left font-medium">{plan.customName}</th>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-2">
                      {formatDateForDisplay(plan.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AuthorizationStatusBadge status={plan.authorizationStatus} />
                    </td>
                    <td className="px-4 py-3 text-fg-2">
                      {plan.activationStatus
                        ? (activationLabels[plan.activationStatus] ?? plan.activationStatus)
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-2">
                      {plan.activatedAt ? formatDateForDisplay(plan.activatedAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={handlePrevious} disabled={currentPage <= 1} className={pagerButton}>
              {t.planActivation.previousPage}
            </button>

            <span className="text-sm text-fg-2" aria-live="polite">
              {interpolate(t.planActivation.pageOf, { current: currentPage, total: totalPages })}
            </span>

            <button type="button" onClick={handleNext} disabled={currentPage >= totalPages} className={pagerButton}>
              {t.planActivation.nextPage}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
