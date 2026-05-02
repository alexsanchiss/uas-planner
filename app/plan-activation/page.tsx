'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/app/components/auth/protected-route'
import { FlightPlanActivationCard } from '@/app/components/plan-activation/FlightPlanActivationCard'
import { HistoricalFlightPlanList } from '@/app/components/plan-activation/HistoricalFlightPlanList'
import { useActivationPlans } from '@/app/hooks/useActivationPlans'
import { useI18n } from '@/app/i18n'

function PlanActivationContent() {
  const { t } = useI18n()
  const { plans, loading, error, now, refresh } = useActivationPlans()
  const [historyOpen, setHistoryOpen] = useState(false)

  const activablePlans = plans.filter((p) => {
    if (!p.scheduledAt) return false
    return Math.abs(now.getTime() - new Date(p.scheduledAt).getTime()) <= 60_000
  })

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Page title */}
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t.planActivation.title}
        </h1>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-lg border border-red-400 bg-red-50 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Activable flights section */}
        {!loading && !error && (
          <section>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border-primary)]">
              {t.planActivation.activableSection}
            </h2>

            {activablePlans.length === 0 ? (
              <p className="text-[var(--text-secondary)] text-sm py-6 text-center">
                {t.planActivation.noActivablePlans}
              </p>
            ) : (
              <div className="space-y-4">
                {activablePlans.map((plan) => (
                  <FlightPlanActivationCard
                    key={plan.id}
                    plan={plan}
                    now={now}
                    onActivated={refresh}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* History section — collapsible */}
        <section>
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex items-center gap-2 text-lg font-medium text-[var(--text-primary)] w-full pb-2 border-b border-[var(--border-primary)] hover:opacity-75 transition-opacity"
          >
            <span className="flex-1 text-left">{t.planActivation.historicalSection}</span>
            <svg
              className={`w-5 h-5 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {historyOpen && (
            <div className="mt-4">
              <HistoricalFlightPlanList />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function PlanActivationPage() {
  return (
    <ProtectedRoute>
      <PlanActivationContent />
    </ProtectedRoute>
  )
}
