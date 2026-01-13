import React from 'react'
import { FlightPlanCard, type FlightPlan, type FlightPlanCardProps } from './FlightPlanCard'

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
}: FlightPlanListProps) {
  if (plans.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 ${className}`}>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
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
