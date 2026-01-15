'use client'

/**
 * FlightPlansUploader - Production Version
 * 
 * TASK-075: Create new FlightPlansUploader.tsx using modular components
 * TASK-076: Implement individual plan operations only (no bulk)
 * TASK-077: Remove folder status counters display
 * TASK-078: Remove global status summary box
 * TASK-079: Integrate all modular components into cohesive UI
 * TASK-084: Define workflow state machine (unprocessed → processing → processed → authorizing → authorized/denied)
 * TASK-085: Create workflow progress indicator
 * TASK-086: Implement step highlighting: Process → Geoawareness → Authorize
 * TASK-087: Lock scheduledAt editing after processing starts
 * TASK-088: Add processing confirmation dialog
 * 
 * A clean, guided workflow UI for managing flight plans.
 * Uses modular components from flight-plans/ directory.
 */

import React, { useState, useCallback, useMemo, DragEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFlightPlans, type FlightPlan as FlightPlanData } from '../hooks/useFlightPlans'
import { useFolders } from '../hooks/useFolders'
import {
  FolderList,
  FlightPlanCard,
  ProcessingWorkflow,
  DateTimePicker,
  TrajectoryMapViewer,
  FLIGHT_PLAN_DRAG_TYPE,
  getWorkflowState,
  hasProcessingStarted,
  type Folder,
  type FlightPlan,
  type WorkflowStep,
  type FlightPlanDragData,
} from './flight-plans'
import { ConfirmDialog } from './ui/confirm-dialog'
import { FlightPlansListSkeleton } from './ui/loading-skeleton'
import { LoadingSpinner } from './ui/loading-spinner'
import { useToast } from '../hooks/useToast'

/**
 * Transform API flight plan data to component flight plan format
 * TASK-220: Include fileContent for waypoint preview extraction
 */
function transformFlightPlan(plan: FlightPlanData): FlightPlan {
  return {
    id: String(plan.id),
    name: plan.customName,
    status: plan.status === 'en cola' || plan.status === 'procesando' ? 'en proceso' : 
            plan.status === 'procesado' ? 'procesado' :
            plan.status === 'error' ? 'error' : 'sin procesar',
    authorizationStatus: plan.authorizationStatus === 'pendiente' ? 'pendiente' :
                         plan.authorizationStatus === 'aprobado' ? 'aprobado' :
                         plan.authorizationStatus === 'denegado' ? 'denegado' : 'sin autorización',
    scheduledAt: plan.scheduledAt,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    csvResult: plan.csvResult ? { id: String(plan.csvResult) } : null,
    // TASK-220: Pass fileContent for waypoint preview visualization
    fileContent: plan.fileContent,
  }
}

/**
 * Determine current workflow step based on selected plan state
 * Updated for 5-step workflow: Select → DateTime → Process → Geoawareness → Authorize
 */
function getCurrentStep(plan: FlightPlan | null): WorkflowStep {
  if (!plan) return 'select'
  if (!plan.scheduledAt) return 'datetime'
  if (plan.status === 'sin procesar') return 'process'
  if (plan.status === 'en proceso') return 'process' // Still in process step while processing
  if (plan.status === 'procesado' && plan.authorizationStatus === 'sin autorización') return 'geoawareness'
  if (plan.authorizationStatus === 'pendiente') return 'authorize'
  return 'select' // Workflow complete (authorized/denied)
}

/**
 * Get completed workflow steps based on plan state
 * Updated for 5-step workflow
 */
function getCompletedSteps(plan: FlightPlan | null): WorkflowStep[] {
  if (!plan) return []
  
  const completed: WorkflowStep[] = ['select']
  
  if (plan.scheduledAt) {
    completed.push('datetime')
  }
  
  if (plan.status === 'procesado' || plan.status === 'en proceso') {
    completed.push('process')
  }
  
  // Geoawareness is considered complete when we've moved to authorization
  if (plan.status === 'procesado' && plan.authorizationStatus !== 'sin autorización') {
    completed.push('geoawareness')
  }
  
  if (plan.authorizationStatus === 'aprobado' || plan.authorizationStatus === 'denegado') {
    completed.push('authorize')
  }
  
  return completed
}

export function FlightPlansUploader() {
  const { user } = useAuth()
  const toast = useToast()
  const {
    flightPlans,
    loading: plansLoading,
    error: plansError,
    updateFlightPlan,
    deleteFlightPlan,
    refresh: refreshPlans,
    isRefreshing,
    errorCount: pollingErrorCount,
    resetErrors: resetPollingErrors,
  } = useFlightPlans({ pollingEnabled: true, pollingInterval: 5000 })
  
  const {
    folders,
    loading: foldersLoading,
    error: foldersError,
    createFolder,
    updateFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders()

  // UI State
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  // TASK-088: Processing confirmation dialog state
  const [processingConfirmDialog, setProcessingConfirmDialog] = useState<{
    open: boolean
    planId: string | null
    planName: string
  }>({ open: false, planId: null, planName: '' })
  // TASK-109: Reset confirmation dialog state
  const [resetConfirmDialog, setResetConfirmDialog] = useState<{
    open: boolean
    planId: string | null
    planName: string
  }>({ open: false, planId: null, planName: '' })
  // TASK-219: Trajectory map viewer state (replaces CSV download)
  const [trajectoryViewer, setTrajectoryViewer] = useState<{
    open: boolean
    planId: string | null
    planName: string
  }>({ open: false, planId: null, planName: '' })
  const [loadingPlanIds, setLoadingPlanIds] = useState<{
    processing: Set<string>
    downloading: Set<string>
    authorizing: Set<string>
    resetting: Set<string>
    deleting: Set<string>
    renaming: Set<string>
    moving: Set<string>
  }>({
    processing: new Set(),
    downloading: new Set(),
    authorizing: new Set(),
    resetting: new Set(),
    deleting: new Set(),
    renaming: new Set(),
    moving: new Set(),
  })
  const [loadingFolderIds, setLoadingFolderIds] = useState<{
    renaming: Set<string>
    deleting: Set<string>
  }>({
    renaming: new Set(),
    deleting: new Set(),
  })
  
  // TASK-222: Drag state for orphan plans drop zone
  const [isDraggingOverOrphans, setIsDraggingOverOrphans] = useState(false)

  // Transform folders with their flight plans
  const transformedFolders = useMemo(() => {
    return folders.map((folder): Folder => {
      const folderPlans = flightPlans.filter(p => p.folderId === folder.id)
      return {
        id: String(folder.id),
        name: folder.name,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        flightPlans: folderPlans.map(transformFlightPlan),
      }
    })
  }, [folders, flightPlans])

  // Get selected plan
  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null
    const plan = flightPlans.find(p => String(p.id) === selectedPlanId)
    return plan ? transformFlightPlan(plan) : null
  }, [selectedPlanId, flightPlans])

  // TASK-087: Check if scheduledAt editing should be locked
  const isScheduledAtLocked = useMemo(() => {
    if (!selectedPlan) return false
    return hasProcessingStarted(
      getWorkflowState(selectedPlan.status, selectedPlan.authorizationStatus)
    )
  }, [selectedPlan])

  // Workflow state
  const currentStep = getCurrentStep(selectedPlan)
  const completedSteps = getCompletedSteps(selectedPlan)

  // Loading state helpers
  const addLoadingPlan = useCallback((type: keyof typeof loadingPlanIds, planId: string) => {
    setLoadingPlanIds(prev => ({
      ...prev,
      [type]: new Set(prev[type]).add(planId),
    }))
  }, [])

  const removeLoadingPlan = useCallback((type: keyof typeof loadingPlanIds, planId: string) => {
    setLoadingPlanIds(prev => {
      const next = new Set(prev[type])
      next.delete(planId)
      return { ...prev, [type]: next }
    })
  }, [])

  const addLoadingFolder = useCallback((type: keyof typeof loadingFolderIds, folderId: string) => {
    setLoadingFolderIds(prev => ({
      ...prev,
      [type]: new Set(prev[type]).add(folderId),
    }))
  }, [])

  const removeLoadingFolder = useCallback((type: keyof typeof loadingFolderIds, folderId: string) => {
    setLoadingFolderIds(prev => {
      const next = new Set(prev[type])
      next.delete(folderId)
      return { ...prev, [type]: next }
    })
  }, [])

  // Folder operations
  const handleCreateFolder = useCallback(async (name: string) => {
    setIsCreatingFolder(true)
    try {
      await createFolder({ name })
    } finally {
      setIsCreatingFolder(false)
    }
  }, [createFolder])

  const handleRenameFolder = useCallback(async (folderId: string, newName: string) => {
    addLoadingFolder('renaming', folderId)
    try {
      await updateFolder(Number(folderId), { name: newName })
    } finally {
      removeLoadingFolder('renaming', folderId)
    }
  }, [updateFolder, addLoadingFolder, removeLoadingFolder])

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its flight plans?')) {
      return
    }
    addLoadingFolder('deleting', folderId)
    try {
      await deleteFolder(Number(folderId))
    } finally {
      removeLoadingFolder('deleting', folderId)
    }
  }, [deleteFolder, addLoadingFolder, removeLoadingFolder])

  // Plan operations (individual only - no bulk)
  // TASK-088: Show confirmation dialog before processing
  const handleProcessPlan = useCallback((planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan || !plan.scheduledAt) {
      toast.warning('Please select a date and time before processing.')
      return
    }

    // Show confirmation dialog
    setProcessingConfirmDialog({
      open: true,
      planId,
      planName: plan.customName,
    })
  }, [flightPlans, toast])

  // Actual processing after confirmation
  const confirmProcessPlan = useCallback(async () => {
    const planId = processingConfirmDialog.planId
    if (!planId) return

    setProcessingConfirmDialog(prev => ({ ...prev, open: false }))
    
    addLoadingPlan('processing', planId)
    try {
      await updateFlightPlan(Number(planId), { status: 'en cola' })
    } finally {
      removeLoadingPlan('processing', planId)
    }
  }, [processingConfirmDialog.planId, updateFlightPlan, addLoadingPlan, removeLoadingPlan])

  // TASK-219: Open trajectory map viewer instead of downloading CSV
  const handleDownloadPlan = useCallback((planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan?.csvResult) {
      toast.warning('No trajectory available to view.')
      return
    }

    // Open trajectory map viewer
    setTrajectoryViewer({
      open: true,
      planId,
      planName: plan.customName,
    })
  }, [flightPlans, toast])

  const handleAuthorizePlan = useCallback(async (planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan || plan.status !== 'procesado') {
      toast.warning('The plan must be processed before requesting authorization.')
      return
    }

    addLoadingPlan('authorizing', planId)
    try {
      // Submit U-Plan to FAS
      const response = await fetch(`/api/flightPlans/${planId}/uplan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error submitting to FAS')
      }

      await refreshPlans()
      toast.success('Authorization request sent successfully.')
    } catch (error) {
      console.error('Authorization error:', error)
      toast.error('Error requesting authorization.', {
        onRetry: () => handleAuthorizePlan(planId),
      })
    } finally {
      removeLoadingPlan('authorizing', planId)
    }
  }, [flightPlans, refreshPlans, addLoadingPlan, removeLoadingPlan, toast])

  // TASK-109: Show reset confirmation dialog
  const handleResetPlan = useCallback((planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan) return

    // Show confirmation dialog with warning
    setResetConfirmDialog({
      open: true,
      planId,
      planName: plan.customName,
    })
  }, [flightPlans])

  // Actual reset after confirmation
  const confirmResetPlan = useCallback(async () => {
    const planId = resetConfirmDialog.planId
    if (!planId) return

    setResetConfirmDialog(prev => ({ ...prev, open: false }))

    addLoadingPlan('resetting', planId)
    try {
      const response = await fetch(`/api/flightPlans/${planId}/reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Error resetting plan')
      }

      await refreshPlans()
      toast.success('Plan reset successfully.')
    } catch (error) {
      console.error('Reset error:', error)
      toast.error('Error resetting plan.', {
        onRetry: confirmResetPlan,
      })
    } finally {
      removeLoadingPlan('resetting', planId)
    }
  }, [resetConfirmDialog.planId, refreshPlans, addLoadingPlan, removeLoadingPlan, toast])

  const handleDeletePlan = useCallback(async (planId: string) => {
    if (!confirm('Are you sure you want to delete this flight plan?')) {
      return
    }

    addLoadingPlan('deleting', planId)
    try {
      await deleteFlightPlan(Number(planId))
      if (selectedPlanId === planId) {
        setSelectedPlanId(null)
      }
    } finally {
      removeLoadingPlan('deleting', planId)
    }
  }, [deleteFlightPlan, selectedPlanId, addLoadingPlan, removeLoadingPlan])

  // TASK-221: Rename plan handler
  const handleRenamePlan = useCallback(async (planId: string, newName: string) => {
    addLoadingPlan('renaming', planId)
    try {
      await updateFlightPlan(Number(planId), { customName: newName })
      toast.success('Plan name updated.')
    } catch (error) {
      console.error('Rename error:', error)
      toast.error('Error renaming plan.')
    } finally {
      removeLoadingPlan('renaming', planId)
    }
  }, [updateFlightPlan, addLoadingPlan, removeLoadingPlan, toast])

  // TASK-222: Move plan to a different folder (drag-and-drop)
  const handleMovePlan = useCallback(async (planId: string, targetFolderId: string | null) => {
    addLoadingPlan('moving', planId)
    try {
      await updateFlightPlan(Number(planId), {
        folderId: targetFolderId ? Number(targetFolderId) : null,
      })
      toast.success('Plan moved successfully.')
    } catch (error) {
      console.error('Move error:', error)
      toast.error('Error moving plan.')
    } finally {
      removeLoadingPlan('moving', planId)
    }
  }, [updateFlightPlan, addLoadingPlan, removeLoadingPlan, toast])
  
  // TASK-222: Handle drag start
  const handleDragStart = useCallback((_e: DragEvent<HTMLDivElement>, _data: FlightPlanDragData) => {
    // Optional: Could add visual feedback during drag
  }, [])
  
  // TASK-222: Handle drag end
  const handleDragEnd = useCallback((_e: DragEvent<HTMLDivElement>) => {
    setIsDraggingOverOrphans(false)
  }, [])
  
  // TASK-222: Handle drag over orphan section
  const handleOrphanDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    if (!e.dataTransfer.types.includes(FLIGHT_PLAN_DRAG_TYPE)) {
      return
    }
    
    e.dataTransfer.dropEffect = 'move'
    setIsDraggingOverOrphans(true)
  }, [])
  
  // TASK-222: Handle drag leave orphan section
  const handleOrphanDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    // Only set false if we're leaving the container entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDraggingOverOrphans(false)
    }
  }, [])
  
  // TASK-222: Handle drop on orphan section (remove from folder)
  const handleOrphanDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOverOrphans(false)
    
    const dragDataStr = e.dataTransfer.getData(FLIGHT_PLAN_DRAG_TYPE)
    if (!dragDataStr) return
    
    try {
      const dragData: FlightPlanDragData = JSON.parse(dragDataStr)
      
      // Don't do anything if already not in a folder
      if (dragData.sourceFolderId === null) {
        return
      }
      
      // Move to no folder (orphan)
      handleMovePlan(dragData.planId, null)
    } catch (err) {
      console.error('Error parsing drag data:', err)
    }
  }, [handleMovePlan])

  // DateTime change handler for selected plan
  // The DateTimePicker component returns UTC ISO string ready for storage
  const handleDateTimeChange = useCallback(async (utcIsoString: string) => {
    if (!selectedPlanId) return

    try {
      await updateFlightPlan(Number(selectedPlanId), {
        scheduledAt: utcIsoString || null,
      })
      toast.success('Date and time updated.')
    } catch (error) {
      console.error('DateTime update error:', error)
      toast.error('Error updating date.', {
        onRetry: () => handleDateTimeChange(utcIsoString),
      })
    }
  }, [selectedPlanId, updateFlightPlan, toast])

  // Handle plan click/selection
  const handlePlanClick = useCallback((planId: string) => {
    setSelectedPlanId(prev => prev === planId ? null : planId)
  }, [])

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px] fade-in">
        <p className="text-[var(--text-secondary)]">Please log in to view your flight plans.</p>
      </div>
    )
  }

  // TASK-169: Show loading skeleton while fetching
  if (plansLoading && foldersLoading) {
    return (
      <div className="p-6 fade-in">
        <FlightPlansListSkeleton folderCount={2} plansPerFolder={2} />
      </div>
    )
  }

  // Error state
  if (plansError || foldersError) {
    return (
      <div className="flex items-center justify-center min-h-[400px] fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <svg className="w-12 h-12 text-red-500 error-shake" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 dark:text-red-400">Error loading data</p>
          <button
            onClick={() => {
              refreshPlans()
              refreshFolders()
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 btn-interactive"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {/* Polling error banner - TASK-100 */}
      {pollingErrorCount >= 3 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800">
              Automatic sync has been paused due to connection errors.
            </p>
          </div>
          <button
            onClick={resetPollingErrors}
            className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 transition-colors btn-interactive"
          >
            Retry
          </button>
        </div>
      )}

      {/* Workflow guide - shows current step in the flight plan lifecycle */}
      <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-primary)] p-6 shadow-sm fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Workflow</h2>
          {/* TASK-097: Refresh indicator */}
          {isRefreshing && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm fade-in">
              <LoadingSpinner size="xs" variant="gray" />
              <span>Syncing...</span>
            </div>
          )}
        </div>
        <ProcessingWorkflow
          currentStep={currentStep}
          completedSteps={completedSteps}
          planStatus={selectedPlan?.status}
          authorizationStatus={selectedPlan?.authorizationStatus}
        />
        {!selectedPlan && (
          <p className="mt-4 text-sm text-[var(--text-secondary)] text-center">
            Select a flight plan from the list to begin
          </p>
        )}
      </div>

      {/* Selected plan panel - shows actions for the selected plan */}
      {selectedPlan && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6 fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Selected plan: {selectedPlan.name}
            </h3>
            <button
              onClick={() => setSelectedPlanId(null)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 btn-interactive-subtle"
            >
              Deselect
            </button>
          </div>

          {/* Selected plan card */}
          <FlightPlanCard
            plan={selectedPlan}
            onProcess={handleProcessPlan}
            onDownload={handleDownloadPlan}
            onAuthorize={handleAuthorizePlan}
            onReset={handleResetPlan}
            onDelete={handleDeletePlan}
            onRename={handleRenamePlan}
            loadingStates={{
              processing: loadingPlanIds.processing.has(selectedPlan.id),
              downloading: loadingPlanIds.downloading.has(selectedPlan.id),
              authorizing: loadingPlanIds.authorizing.has(selectedPlan.id),
              resetting: loadingPlanIds.resetting.has(selectedPlan.id),
              deleting: loadingPlanIds.deleting.has(selectedPlan.id),
              renaming: loadingPlanIds.renaming.has(selectedPlan.id),
            }}
            className="mb-4"
          />

          {/* DateTime picker for selected plan - shown when at datetime step or to show current value */}
          {(currentStep === 'datetime' || selectedPlan.scheduledAt) && (
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-blue-100 dark:border-blue-900 fade-in">
              <DateTimePicker
                value={selectedPlan.scheduledAt || ''}
                onChange={handleDateTimeChange}
                label="Scheduled date and time"
                disabled={isScheduledAtLocked}
                className="max-w-xs"
              />
              {isScheduledAtLocked ? (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  The date cannot be modified after processing starts.
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Select the date and time to process the plan.
                </p>
              )}
            </div>
          )}

          {/* Process action prompt */}
          {currentStep === 'process' && (
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-blue-100 dark:border-blue-900 fade-in">
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                The plan is ready to be processed. This will generate the trajectory and U-Plan.
              </p>
              <button
                onClick={() => handleProcessPlan(selectedPlan.id)}
                disabled={loadingPlanIds.processing.has(selectedPlan.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors btn-interactive disabled-transition"
              >
                {loadingPlanIds.processing.has(selectedPlan.id) ? 'Processing...' : 'Process plan'}
              </button>
            </div>
          )}

          {/* Geoawareness step prompt */}
          {currentStep === 'geoawareness' && selectedPlan.status === 'procesado' && (
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-purple-100 dark:border-purple-900 fade-in">
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                The plan has been processed. Review the geoawareness information before requesting authorization.
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                The geoawareness viewer will show the geographic zones that affect the flight.
              </p>
              <button
                onClick={() => handleAuthorizePlan(selectedPlan.id)}
                disabled={loadingPlanIds.authorizing.has(selectedPlan.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-400 transition-colors btn-interactive disabled-transition"
              >
                {loadingPlanIds.authorizing.has(selectedPlan.id) ? 'Requesting...' : 'Continue to authorization'}
              </button>
            </div>
          )}

          {/* Authorize action prompt - when authorization is pending */}
          {currentStep === 'authorize' && selectedPlan.authorizationStatus === 'pendiente' && (
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-amber-100 dark:border-amber-900 fade-in">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
                <LoadingSpinner size="sm" variant="primary" />
                <span className="font-medium">Waiting for FAS response...</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                The authorization request has been sent. You will receive a notification when processed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main content: Folder list with flight plans */}
      <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-primary)] p-6 shadow-sm fade-in-up">
        <FolderList
          folders={transformedFolders}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onProcessPlan={handleProcessPlan}
          onDownloadPlan={handleDownloadPlan}
          onAuthorizePlan={handleAuthorizePlan}
          onResetPlan={handleResetPlan}
          onDeletePlan={handleDeletePlan}
          onSelectPlan={handlePlanClick}
          selectedPlanId={selectedPlanId}
          onRenamePlan={handleRenamePlan}
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDropPlan={handleMovePlan}
          loadingPlanIds={loadingPlanIds}
          loadingFolderIds={loadingFolderIds}
          isCreating={isCreatingFolder}
        />
      </div>

      {/* Orphan plans section - plans without a folder */}
      {(() => {
        const orphanPlans = flightPlans.filter(p => !p.folderId)
        
        // Show drop zone even if no orphan plans, when dragging
        const showDropZone = orphanPlans.length > 0 || isDraggingOverOrphans

        if (!showDropZone) return null

        return (
          <div 
            className={`bg-[var(--surface-primary)] rounded-lg border p-6 shadow-sm fade-in-up transition-all ${
              isDraggingOverOrphans
                ? 'border-blue-500 dark:border-blue-400 border-2 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30'
                : 'border-[var(--border-primary)]'
            }`}
            onDragOver={handleOrphanDragOver}
            onDragEnter={(e) => {
              e.preventDefault()
              if (e.dataTransfer.types.includes(FLIGHT_PLAN_DRAG_TYPE)) {
                setIsDraggingOverOrphans(true)
              }
            }}
            onDragLeave={handleOrphanDragLeave}
            onDrop={handleOrphanDrop}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Plans without folder ({orphanPlans.length})
              </h2>
              {isDraggingOverOrphans && (
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 animate-pulse">
                  Drop here to remove from folder
                </span>
              )}
            </div>
            {orphanPlans.length > 0 ? (
              <div className="flex flex-col gap-3 stagger-children">
                {orphanPlans.map(plan => {
                  const transformed = transformFlightPlan(plan)
                  
                  return (
                    <FlightPlanCard
                      key={plan.id}
                      plan={transformed}
                      folderId={null}
                      onProcess={handleProcessPlan}
                      onDownload={handleDownloadPlan}
                      onAuthorize={handleAuthorizePlan}
                      onReset={handleResetPlan}
                      onDelete={handleDeletePlan}
                      onSelect={handlePlanClick}
                      isSelected={selectedPlanId === transformed.id}
                      onRename={handleRenamePlan}
                      draggable={true}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      loadingStates={{
                        processing: loadingPlanIds.processing.has(transformed.id),
                        downloading: loadingPlanIds.downloading.has(transformed.id),
                        authorizing: loadingPlanIds.authorizing.has(transformed.id),
                        resetting: loadingPlanIds.resetting.has(transformed.id),
                        deleting: loadingPlanIds.deleting.has(transformed.id),
                        renaming: loadingPlanIds.renaming.has(transformed.id),
                      }}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-[var(--text-secondary)] text-sm">
                Drop a plan here to remove it from its folder
              </div>
            )}
          </div>
        )
      })()}

      {/* TASK-088: Processing confirmation dialog */}
      <ConfirmDialog
        open={processingConfirmDialog.open}
        onClose={() => setProcessingConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmProcessPlan}
        title="Confirm processing"
        message={`Are you sure you want to process the plan "${processingConfirmDialog.planName}"? Once processing starts, you will not be able to modify the scheduled date and time, or the plan information without resetting the entire process.`}
        confirmLabel="Process"
        cancelLabel="Cancel"
        variant="warning"
      />

      {/* TASK-109: Reset confirmation dialog */}
      <ConfirmDialog
        open={resetConfirmDialog.open}
        onClose={() => setResetConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmResetPlan}
        title="Reset flight plan"
        message={`Are you sure you want to reset the plan "${resetConfirmDialog.planName}"? This action will delete the processed trajectory, authorization status, and all associated data. The plan will return to "unprocessed" status.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        variant="warning"
      />

      {/* TASK-219: Trajectory map viewer - replaces CSV download */}
      {trajectoryViewer.open && trajectoryViewer.planId && (
        <TrajectoryMapViewer
          planId={trajectoryViewer.planId}
          planName={trajectoryViewer.planName}
          onClose={() => setTrajectoryViewer({ open: false, planId: null, planName: '' })}
        />
      )}
    </div>
  )
}

export default FlightPlansUploader
