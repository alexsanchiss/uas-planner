import React from 'react'
import { FlightPlanCard, type FlightPlan, type FlightPlanCardProps } from './FlightPlanCard'
import { FlightPlanCardSkeleton } from '../ui/loading-skeleton'

export interface FlightPlanListProps {
  plans: FlightPlan[]
  onProcess?: (planId: string) => void
  onDownload?: (planId: string) => void
  onAuthorize?: (planId: string) => void
  onReset?: (planId: string) => void
  onDelete?: (planId: string) => void
  loadingPlanIds?: {
    processing?: Set<string>
    downloading?: Set<string>
    authorizing?: Set<string>
    resetting?: Set<string>
    deleting?: Set<string>
  }
  emptyMessage?: string
  className?: string
  /** TASK-169: Show loading skeleton while fetching */
  isLoading?: boolean
  /** Number of skeleton items to show while loading */
  skeletonCount?: number
}

export function FlightPlanList({
  plans,
  onProcess,
  onDownload,
  onAuthorize,
  onReset,
  onDelete,
  loadingPlanIds = {},
  emptyMessage = 'No hay planes de vuelo',
  className = '',
  isLoading = false,
  skeletonCount = 3,
}: FlightPlanListProps) {
  // TASK-169: Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <FlightPlanCardSkeleton key={i} className="fade-in" />
        ))}
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 sm:p-8 fade-in ${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 gap-3 stagger-children ${className}`}>
      {plans.map((plan) => {
        const loadingStates: FlightPlanCardProps['loadingStates'] = {
          processing: loadingPlanIds.processing?.has(plan.id),
          downloading: loadingPlanIds.downloading?.has(plan.id),
          authorizing: loadingPlanIds.authorizing?.has(plan.id),
          resetting: loadingPlanIds.resetting?.has(plan.id),
          deleting: loadingPlanIds.deleting?.has(plan.id),
        }

        return (
          <FlightPlanCard
            key={plan.id}
            plan={plan}
            onProcess={onProcess}
            onDownload={onDownload}
            onAuthorize={onAuthorize}
            onReset={onReset}
            onDelete={onDelete}
            loadingStates={loadingStates}
          />
        )
      })}
    </div>
  )
}
