'use client'

import React from 'react'
import { type PlanStatus, type AuthorizationStatus } from './StatusBadge'
import { ContextualHelp } from '../ui/tooltip'

/**
 * TASK-084: Workflow State Machine
 * 
 * Flight Plan Workflow States:
 * - unprocessed: Initial state, plan uploaded but not yet processed
 * - processing: Plan is being processed (en cola or procesando)
 * - processed: Trajectory and U-Plan generated successfully
 * - authorizing: U-Plan submitted to FAS, waiting for response (pendiente)
 * - authorized: FAS approved the flight plan (aprobado)
 * - denied: FAS denied the flight plan (denegado)
 * - error: Processing failed
 */
export type WorkflowState = 
  | 'unprocessed'
  | 'processing'
  | 'processed'
  | 'authorizing'
  | 'authorized'
  | 'denied'
  | 'error'

/**
 * Map plan status and authorization status to workflow state
 */
export function getWorkflowState(
  planStatus: PlanStatus,
  authorizationStatus: AuthorizationStatus
): WorkflowState {
  // Error state takes precedence
  if (planStatus === 'error') return 'error'
  
  // Check authorization states first for processed plans
  if (planStatus === 'procesado') {
    if (authorizationStatus === 'aprobado') return 'authorized'
    if (authorizationStatus === 'denegado') return 'denied'
    if (authorizationStatus === 'pendiente') return 'authorizing'
    return 'processed'
  }
  
  // Processing state
  if (planStatus === 'en proceso') return 'processing'
  
  // Default: unprocessed
  return 'unprocessed'
}

/**
 * Check if processing has started (cannot edit scheduledAt)
 */
export function hasProcessingStarted(state: WorkflowState): boolean {
  return state !== 'unprocessed'
}

export type WorkflowStep = 'select' | 'datetime' | 'process' | 'geoawareness' | 'authorize'

export interface ProcessingWorkflowProps {
  currentStep: WorkflowStep
  onStepClick?: (step: WorkflowStep) => void
  completedSteps?: WorkflowStep[]
  /** Flight plan status for state-based highlighting */
  planStatus?: PlanStatus
  /** Authorization status for state-based highlighting */
  authorizationStatus?: AuthorizationStatus
  className?: string
}

/**
 * TASK-085 & TASK-086: Workflow steps with Process → Geoawareness → Authorize highlighting
 * TASK-204: Added contextual help for each workflow step
 */
interface StepDefinition {
  id: WorkflowStep
  number: number
  label: string
  description: string
  helpTitle: string
  helpDescription: string
  helpTips?: string[]
}

const steps: StepDefinition[] = [
  { 
    id: 'select', 
    number: 1, 
    label: 'Select', 
    description: 'Choose a flight plan',
    helpTitle: 'Select Plan',
    helpDescription: 'Choose the flight plan you want to process from the list of available plans.',
    helpTips: [
      'Plans are organized by folders',
      'You can expand a folder to see its plans',
      'Click on a plan to select it',
    ],
  },
  { 
    id: 'datetime', 
    number: 2, 
    label: 'Date/Time', 
    description: 'Set date and time',
    helpTitle: 'Set Date and Time',
    helpDescription: 'Set the scheduled date and time for the flight. This information will be used to generate the U-Plan.',
    helpTips: [
      'Select a future date and time',
      'Timezone is detected automatically',
      'Once processed, you cannot change the date',
    ],
  },
  { 
    id: 'process', 
    number: 3, 
    label: 'Process', 
    description: 'Generate trajectory and U-Plan',
    helpTitle: 'Process Plan',
    helpDescription: 'Generate the flight trajectory and the U-Plan document required for authorization.',
    helpTips: [
      'Make sure you have set the date/time',
      'The process may take a few seconds',
      'You will receive a CSV file with the trajectory',
    ],
  },
  { 
    id: 'geoawareness', 
    number: 4, 
    label: 'GeoAwareness', 
    description: 'Verify geographic zones',
    helpTitle: 'GeoAwareness Verification',
    helpDescription: 'Verify that the trajectory does not cross restricted areas or controlled airspace.',
    helpTips: [
      'Prohibited zones are shown in red',
      'Warning zones in yellow',
      'You can view the map with the trajectory overlay',
    ],
  },
  { 
    id: 'authorize', 
    number: 5, 
    label: 'Authorize', 
    description: 'Request FAS authorization',
    helpTitle: 'Request Authorization',
    helpDescription: 'Submit the U-Plan to the FAS system to obtain flight authorization.',
    helpTips: [
      'FAS will evaluate your flight plan',
      'You will receive a response: approved or denied',
      'If denied, review the error message',
    ],
  },
]

export function ProcessingWorkflow({
  currentStep,
  onStepClick,
  completedSteps = [],
  planStatus,
  authorizationStatus,
  className = '',
}: ProcessingWorkflowProps) {
  // Calculate workflow state from plan/auth status
  const workflowState = planStatus && authorizationStatus
    ? getWorkflowState(planStatus, authorizationStatus)
    : undefined

  const getStepStatus = (stepId: WorkflowStep): 'completed' | 'current' | 'upcoming' | 'processing' | 'error' => {
    // Handle error state
    if (workflowState === 'error' && stepId === 'process') return 'error'
    
    // Handle processing state (shows spinner)
    if (workflowState === 'processing' && stepId === 'process') return 'processing'
    
    // Handle authorizing state (shows spinner on authorize step)
    if (workflowState === 'authorizing' && stepId === 'authorize') return 'processing'
    
    if (completedSteps.includes(stepId)) return 'completed'
    if (stepId === currentStep) return 'current'
    return 'upcoming'
  }

  const getStepStyles = (status: 'completed' | 'current' | 'upcoming' | 'processing' | 'error') => {
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
      case 'processing':
        return {
          circle: 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300 ring-offset-2 animate-pulse',
          label: 'text-amber-700 dark:text-amber-400 font-semibold',
          description: 'text-amber-600 dark:text-amber-500',
          connector: 'bg-gray-300 dark:bg-gray-600',
        }
      case 'error':
        return {
          circle: 'bg-red-500 text-white border-red-500 ring-2 ring-red-300 ring-offset-2',
          label: 'text-red-700 dark:text-red-400 font-semibold',
          description: 'text-red-600 dark:text-red-500',
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

  // Render the appropriate icon based on status
  const renderStepIcon = (status: 'completed' | 'current' | 'upcoming' | 'processing' | 'error', stepNumber: number) => {
    if (status === 'completed') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    }
    
    if (status === 'processing') {
      return (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )
    }
    
    if (status === 'error') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    }
    
    return <span className="text-sm font-medium">{stepNumber}</span>
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Workflow state indicator */}
      {workflowState && (
        <div className="mb-4 flex items-center justify-center">
          <WorkflowStateIndicator state={workflowState} />
        </div>
      )}
      
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
                {/* Circle with number, checkmark, spinner, or X */}
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${styles.circle}`}
                >
                  {renderStepIcon(status, step.number)}
                </div>

                {/* Label with help icon */}
                <div className="flex items-center gap-1 mt-2">
                  <span className={`text-sm text-center ${styles.label}`}>
                    {step.label}
                  </span>
                  {/* TASK-204: Contextual help icon - positioned below to avoid header overlap */}
                  <ContextualHelp
                    title={step.helpTitle}
                    description={step.helpDescription}
                    tips={step.helpTips}
                    position="bottom"
                  />
                </div>

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

/**
 * TASK-085: Workflow State Indicator - shows current overall state
 */
function WorkflowStateIndicator({ state }: { state: WorkflowState }) {
  const stateConfig: Record<WorkflowState, { label: string; color: string; icon: React.ReactNode }> = {
    unprocessed: {
      label: 'Unprocessed',
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    processing: {
      label: 'Processing...',
      color: 'bg-amber-100 text-amber-700 border-amber-300',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
    },
    processed: {
      label: 'Processed',
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    authorizing: {
      label: 'Authorizing...',
      color: 'bg-purple-100 text-purple-700 border-purple-300',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ),
    },
    authorized: {
      label: 'Authorized',
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    denied: {
      label: 'Denied',
      color: 'bg-red-100 text-red-700 border-red-300',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    error: {
      label: 'Error',
      color: 'bg-red-100 text-red-700 border-red-300',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  }

  const config = stateConfig[state]

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${config.color}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  )
}

export default ProcessingWorkflow
