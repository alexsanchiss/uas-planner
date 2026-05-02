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

export function HistoricalFlightPlanList({ className = '' }: HistoricalFlightPlanListProps) {
  const { t } = useI18n()

  const [plans, setPlans] = useState<HistoricalFlightPlan[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
    <section className={`flex flex-col gap-4 ${className}`}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {t.planActivation.historicalSection}
      </h2>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"
            style={{ color: 'var(--brand-primary)' }}
            aria-label={t.common.loading}
          />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm" style={{ color: 'var(--text-error, #ef4444)' }}>
          {error}
        </p>
      )}

      {!loading && !error && plans.length === 0 && (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t.planActivation.noHistory}
        </p>
      )}

      {!loading && !error && plans.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <th className="px-4 py-3 text-left font-medium">{t.flightPlans.flightPlan}</th>
                  <th className="px-4 py-3 text-left font-medium">{t.flightPlans.scheduledFor}</th>
                  <th className="px-4 py-3 text-left font-medium">{t.flightPlans.authorize}</th>
                  <th className="px-4 py-3 text-left font-medium">Activation</th>
                  <th className="px-4 py-3 text-left font-medium">Activated at</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, idx) => (
                  <tr
                    key={plan.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      borderTop: '1px solid var(--border-primary)',
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{plan.customName}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateForDisplay(plan.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AuthorizationStatusBadge status={plan.authorizationStatus} />
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {plan.activationStatus ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {plan.activatedAt ? formatDateForDisplay(plan.activatedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentPage <= 1}
              className="rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {t.planActivation.previousPage}
            </button>

            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {interpolate(t.planActivation.pageOf, { current: currentPage, total: totalPages })}
            </span>

            <button
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {t.planActivation.nextPage}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
