import React, { DragEvent } from 'react'
import { FlightPlanCard, type FlightPlan, type FlightPlanCardProps, type FlightPlanDragData, type Waypoint } from './FlightPlanCard'
import { FlightPlanCardSkeleton } from '../ui/loading-skeleton'

export interface FlightPlanListProps {
  plans: FlightPlan[]
  /** TASK-222: Folder ID this list belongs to (for drag-and-drop) */
  folderId?: string | null
  onProcess?: (planId: string) => void
  onDownload?: (planId: string) => void
  onAuthorize?: (planId: string) => void
  onReset?: (planId: string) => void
  onDelete?: (planId: string) => void
  /** TASK-217: Click handler for plan selection */
  onSelectPlan?: (planId: string) => void
  /** TASK-217: Currently selected plan ID */
  selectedPlanId?: string | null
  /** TASK-221: Callback for renaming a plan */
  onRenamePlan?: (planId: string, newName: string) => void
  /** TASK-222: Enable drag-and-drop for plans */
  draggable?: boolean
  /** TASK-222: Called when drag starts on a plan */
  onDragStart?: (e: DragEvent<HTMLDivElement>, data: FlightPlanDragData) => void
  /** TASK-222: Called when drag ends on a plan */
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void
  /** Callback when clicking on waypoint preview to open map */
  onWaypointPreviewClick?: (planId: string, waypoints: Waypoint[]) => void
  /** Callback to view authorization message */
  onViewAuthorizationMessage?: (planId: string, message: unknown) => void
  loadingPlanIds?: {
    processing?: Set<string>
    downloading?: Set<string>
    authorizing?: Set<string>
    resetting?: Set<string>
    deleting?: Set<string>
    renaming?: Set<string>
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
  folderId,
  onProcess,
  onDownload,
  onAuthorize,
  onReset,
  onDelete,
  onSelectPlan,
  selectedPlanId,
  onRenamePlan,
  draggable = false,
  onDragStart,
  onDragEnd,
  onWaypointPreviewClick,
  onViewAuthorizationMessage,
  loadingPlanIds = {},
  emptyMessage = 'No flight plans',
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
          renaming: loadingPlanIds.renaming?.has(plan.id),
        }

        return (
          <FlightPlanCard
            key={plan.id}
            plan={plan}
            folderId={folderId}
            onProcess={onProcess}
            onDownload={onDownload}
            onAuthorize={onAuthorize}
            onReset={onReset}
            onDelete={onDelete}
            onSelect={onSelectPlan}
            isSelected={selectedPlanId === plan.id}
            onRename={onRenamePlan}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onWaypointPreviewClick={onWaypointPreviewClick}
            onViewAuthorizationMessage={onViewAuthorizationMessage}
            loadingStates={loadingStates}
          />
        )
      })}
    </div>
  )
}
