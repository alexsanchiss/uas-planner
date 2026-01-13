'use client'

import React from 'react'

export type WorkflowStep = 'select' | 'datetime' | 'process' | 'authorize'

export interface ProcessingWorkflowProps {
  currentStep: WorkflowStep
  onStepClick?: (step: WorkflowStep) => void
  completedSteps?: WorkflowStep[]
  className?: string
}

const steps: { id: WorkflowStep; number: number; label: string; description: string }[] = [
  { id: 'select', number: 1, label: 'Select Plan', description: 'Choose a flight plan to process' },
  { id: 'datetime', number: 2, label: 'Set DateTime', description: 'Configure scheduled date and time' },
  { id: 'process', number: 3, label: 'Process', description: 'Generate trajectory and U-Plan' },
  { id: 'authorize', number: 4, label: 'Authorize', description: 'Submit for FAS authorization' },
]

export function ProcessingWorkflow({
  currentStep,
  onStepClick,
  completedSteps = [],
  className = '',
}: ProcessingWorkflowProps) {
  const getStepStatus = (stepId: WorkflowStep): 'completed' | 'current' | 'upcoming' => {
    if (completedSteps.includes(stepId)) return 'completed'
    if (stepId === currentStep) return 'current'
    return 'upcoming'
  }

  const getStepStyles = (status: 'completed' | 'current' | 'upcoming') => {
    switch (status) {
      case 'completed':
        return {
          circle: 'bg-green-500 text-white border-green-500',
          label: 'text-green-700 dark:text-green-400 font-medium',
          description: 'text-green-600 dark:text-green-500',
          connector: 'bg-green-500',
        }
      case 'current':
        return {
          circle: 'bg-blue-500 text-white border-blue-500 ring-2 ring-blue-300 ring-offset-2',
          label: 'text-blue-700 dark:text-blue-400 font-semibold',
          description: 'text-blue-600 dark:text-blue-500',
          connector: 'bg-gray-300 dark:bg-gray-600',
        }
      case 'upcoming':
        return {
          circle: 'bg-white dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600',
          label: 'text-gray-500 dark:text-gray-400',
          description: 'text-gray-400 dark:text-gray-500',
          connector: 'bg-gray-300 dark:bg-gray-600',
        }
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id)
          const styles = getStepStyles(status)
          const isClickable = onStepClick && (status === 'completed' || status === 'current')

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <div
                className={`flex flex-col items-center flex-1 ${isClickable ? 'cursor-pointer' : ''}`}
                onClick={() => isClickable && onStepClick?.(step.id)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onStepClick?.(step.id)
                  }
                }}
              >
                {/* Circle with number or checkmark */}
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${styles.circle}`}
                >
                  {status === 'completed' ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{step.number}</span>
                  )}
                </div>

                {/* Label */}
                <span className={`mt-2 text-sm text-center ${styles.label}`}>
                  {step.label}
                </span>

                {/* Description - hidden on small screens */}
                <span className={`mt-1 text-xs text-center hidden sm:block ${styles.description}`}>
                  {step.description}
                </span>
              </div>

              {/* Connector line (except after last step) */}
              {index < steps.length - 1 && (
                <div className="flex-1 flex items-center pt-5">
                  <div className={`h-0.5 w-full ${styles.connector}`} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default ProcessingWorkflow
