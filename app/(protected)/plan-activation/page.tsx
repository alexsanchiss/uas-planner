'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, ChevronDown, CircleAlert, ShieldCheck } from 'lucide-react'
import { FlightPlanActivationCard, UpcomingPlanCard } from '@/app/components/plan-activation/FlightPlanActivationCard'
import { HistoricalFlightPlanList } from '@/app/components/plan-activation/HistoricalFlightPlanList'
import { useActivationPlans } from '@/app/hooks/useActivationPlans'
import { useI18n } from '@/app/i18n'

const sectionHeading = 'mb-1 border-b border-line pb-2 text-lg font-medium text-fg'

/** Same card/row geometry as the final layout, so nothing jumps when data arrives. */
function ActivationSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="h-5 w-1/3 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
          <div className="ml-auto h-9 w-32 animate-pulse rounded-md bg-subtle motion-reduce:animate-none" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

function PlanActivationContent() {
  const { t } = useI18n()
  const { plans, loading, error, now, refresh } = useActivationPlans()
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyId = useId()

  const nowMs = now.getTime()

  // Activation window logic is unchanged: +-60 s around the scheduled time.
  const activablePlans = plans.filter((p) => {
    if (!p.scheduledAt) return false
    return Math.abs(nowMs - new Date(p.scheduledAt).getTime()) <= 60_000
  })

  // Approved and scheduled, window not open yet.
  const upcomingPlans = plans.filter((p) => {
    if (!p.scheduledAt) return false
    return new Date(p.scheduledAt).getTime() - nowMs > 60_000
  })

  const nothingToShow = activablePlans.length === 0 && upcomingPlans.length === 0

  return (
    <div className="w-full bg-canvas">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <h1 className="text-2xl font-semibold text-fg">{t.planActivation.title}</h1>

        {/* Loading */}
        {loading && <ActivationSkeleton label={t.activation.loadingPlans} />}

        {/* Error */}
        {!loading && error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-line bg-danger-soft p-4 text-sm text-danger-text"
          >
            <p className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold">{t.activation.loadErrorTitle}</span>
                <span className="block text-xs">{error}</span>
              </span>
            </p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-md border border-danger-line bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              {t.common.retry}
            </button>
          </div>
        )}

        {/* Empty: nothing ready and nothing scheduled */}
        {!loading && !error && nothingToShow && (
          <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
            <CalendarClock className="h-8 w-8 text-muted" aria-hidden="true" />
            <h2 className="text-lg font-medium text-fg">{t.activation.emptyTitle}</h2>
            <p className="max-w-md text-sm text-fg-2">{t.activation.emptyBody}</p>
            <Link
              href="/plan-authorization"
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {t.activation.emptyCta}
            </Link>
          </section>
        )}

        {/* Ready now */}
        {!loading && !error && !nothingToShow && (
          <section aria-labelledby="ready-now-heading">
            <h2 id="ready-now-heading" className={sectionHeading}>
              {t.activation.readyNow}
            </h2>
            <p className="mb-4 text-sm text-muted">{t.activation.readyNowHint}</p>
            {activablePlans.length === 0 ? (
              <p className="py-4 text-center text-sm text-fg-2">{t.planActivation.noActivablePlans}</p>
            ) : (
              <div className="space-y-4">
                {activablePlans.map((plan) => (
                  <FlightPlanActivationCard key={plan.id} plan={plan} now={now} onActivated={refresh} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Upcoming */}
        {!loading && !error && !nothingToShow && (
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className={sectionHeading}>
              {t.activation.upcoming}
            </h2>
            <p className="mb-4 text-sm text-muted">{t.activation.upcomingHint}</p>
            {upcomingPlans.length === 0 ? (
              <p className="py-4 text-center text-sm text-fg-2">{t.activation.upcomingEmpty}</p>
            ) : (
              <div className="space-y-3">
                {upcomingPlans.map((plan) => (
                  <UpcomingPlanCard key={plan.id} plan={plan} now={now} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* History: collapsible */}
        <section>
          <h2 className="m-0">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              aria-expanded={historyOpen}
              aria-controls={historyId}
              className="flex w-full items-center gap-2 rounded-sm border-b border-line pb-2 text-left text-lg font-medium text-fg transition-colors hover:text-fg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <span className="flex-1">{t.planActivation.historicalSection}</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform motion-reduce:transition-none ${historyOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </h2>

          <div id={historyId} hidden={!historyOpen} className="mt-4">
            {historyOpen && <HistoricalFlightPlanList />}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function PlanActivationPage() {
  return <PlanActivationContent />
}
