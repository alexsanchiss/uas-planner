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
import dynamic from 'next/dynamic'
import axios from 'axios'
import { HelpCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useFlightPlans, type FlightPlan as FlightPlanData } from '../hooks/useFlightPlans'
import { useFolders } from '../hooks/useFolders'
import { useVolumeRegeneration } from '../hooks/useVolumeRegeneration'
import { isUplanComplete } from '@/lib/validators/uplan-validator'
import {
  FolderList,
  FlightPlanCard,
  ProcessingWorkflow,
  DateTimePicker,
  TrajectoryMapViewer,
  WaypointMapModal,
  FLIGHT_PLAN_DRAG_TYPE,
  getWorkflowState,
  hasProcessingStarted,
  type Folder,
  type FlightPlan,
  type WorkflowStep,
  type FlightPlanDragData,
  type Waypoint,
} from './flight-plans'
import { ConfirmDialog } from './ui/confirm-dialog'
import { FlightPlansListSkeleton } from './ui/loading-skeleton'
import { LoadingSpinner } from './ui/loading-spinner'
import { Modal } from './ui/modal'
import { useToast } from '../hooks/useToast'

// Dynamic import for UplanViewModal (uses Leaflet, requires SSR disabled)
const UplanViewModal = dynamic(() => import('./UplanViewModal'), { ssr: false })

// Dynamic import for UplanFormModal (TASK-023: Wire Review U-Plan to form modal)
const UplanFormModal = dynamic(() => import('./flight-plans/UplanFormModal'), { ssr: false })

// TASK-076: Dynamic import for GeoawarenessViewer modal
const GeoawarenessViewer = dynamic(() => import('./flight-plans/GeoawarenessViewer'), { ssr: false })

// Task 11: Dynamic import for DenialMapModal (uses Leaflet, requires SSR disabled)
const DenialMapModal = dynamic(() => import('./flight-plans/DenialMapModal'), { ssr: false })

// U-Space selector for external UPLANs (uses Leaflet, requires SSR disabled)
const UspaceSelector = dynamic(() => import('./plan-generator/UspaceSelector').then(mod => ({ default: mod.UspaceSelector })), { ssr: false })

// Task 11: Dynamic import for Cesium 3D U-Plan viewer (requires browser APIs)
const Cesium3DModal = dynamic(() => import('./flight-plans/Cesium3DModal'), { ssr: false })

// Task 17: Dynamic import for 3D Denial viewer (requires browser APIs)
const Denial3DModal = dynamic(() => import('./flight-plans/Denial3DModal'), { ssr: false })

// Task 18: Dynamic import for unified Authorization Result modal (uses Leaflet + Cesium)
const AuthorizationResultModal = dynamic(() => import('./flight-plans/AuthorizationResultModal'), { ssr: false })

// Task 20: Dynamic import for 3D Trajectory viewer with drone animation (requires Cesium)
const Trajectory3DViewer = dynamic(() => import('./flight-plans/Trajectory3DViewer'), { ssr: false })

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
    authorizationMessage: plan.authorizationMessage,
    // Parse uplan from string to object for U-Plan review
    uplan: plan.uplan ? (typeof plan.uplan === 'string' ? JSON.parse(plan.uplan) : plan.uplan) : null,
    // Include geoawareness response if available
    geoawarenessData: plan.geoawarenessData,
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
    importExternalUplan,
  } = useFlightPlans({ pollingEnabled: true, pollingInterval: 1000 })
  
  const {
    folders,
    loading: foldersLoading,
    error: foldersError,
    createFolder,
    updateFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders()

 // Auto-regenerate missing operation volumes every 30 seconds
  const volumeRegenStatus = useVolumeRegeneration(!!user)

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
  // Authorization confirmation dialog state
  const [authorizationConfirmDialog, setAuthorizationConfirmDialog] = useState<{
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
  // Waypoint map modal state - opens when clicking on a plan card
  const [waypointMapModal, setWaypointMapModal] = useState<{
    open: boolean
    planId: string | null
    planName: string
    waypoints: { lat: number; lng: number; alt: number; type?: 'takeoff' | 'cruise' | 'landing' }[]
  }>({ open: false, planId: null, planName: '', waypoints: [] })
  // Authorization message modal state - shows authorization response
  const [authorizationMessageModal, setAuthorizationMessageModal] = useState<{
    open: boolean
    planId: string | null
    planName: string
    message: unknown
    status: 'aprobado' | 'denegado' | null
    uplan: unknown
  }>({ open: false, planId: null, planName: '', message: null, status: null, uplan: null })
  // U-Plan review modal state - shows U-Plan before authorization
  // TASK-079: Include fileContent for waypoint visualization
  const [uplanViewModal, setUplanViewModal] = useState<{
    open: boolean
    uplan: unknown
    name: string
    fileContent: string | null
  }>({ open: false, uplan: null, name: '', fileContent: null })
  // TASK-023: UplanFormModal state for editing U-Plan before authorization
  // TASK-003: Include validation errors for highlighting missing fields
  const [uplanFormModal, setUplanFormModal] = useState<{
    open: boolean
    planId: string
    uplan: unknown
    name: string
    missingFields?: string[]
    fieldErrors?: { [fieldName: string]: string }
  }>({ open: false, planId: '', uplan: null, name: '' })
  // TASK-076: Geoawareness viewer modal state
  const [geoawarenessModal, setGeoawarenessModal] = useState<{
    open: boolean
    planId: string
    planName: string
    uspaceId: string | null
  }>({ open: false, planId: '', planName: '', uspaceId: null })
  // Task 11: Denial map modal state
  const [denialMapModal, setDenialMapModal] = useState<{
    open: boolean
    uplan: unknown
    authorizationMessage: string | null
    geoawarenessData: unknown
  }>({ open: false, uplan: null, authorizationMessage: null, geoawarenessData: null })
  // U-Space selector modal for external UPLANs without U-Space identifier
  const [uspaceSelectionModal, setUspaceSelectionModal] = useState<{
    open: boolean
    planId: string
  }>({ open: false, planId: '' })
  // TASK-003: State for on-demand volume generation
  const [generatingVolumes, setGeneratingVolumes] = useState<string | null>(null) // planId or null
  // Task 11: Cesium 3D viewer state
  const [cesium3DModal, setCesium3DModal] = useState<{
    open: boolean
    uplanData: any
  }>({ open: false, uplanData: null })
  // Task 17: 3D Denial viewer state
  const [denial3DModal, setDenial3DModal] = useState<{
    open: boolean
    uplan: unknown
    authorizationMessage: string | null
    geoawarenessData: unknown
  }>({ open: false, uplan: null, authorizationMessage: null, geoawarenessData: null })
  const [generatingVolumes3D, setGeneratingVolumes3D] = useState<string | null>(null)
  // Task 18: Unified Authorization Result modal state
  const [authResultModal, setAuthResultModal] = useState<{
    open: boolean
    uplanData: unknown
    status: string
    reason: string | null
    geoawarenessData: unknown
    planName: string
  }>({ open: false, uplanData: null, status: '', reason: null, geoawarenessData: null, planName: '' })
  // Task 20: 3D Trajectory viewer state
  const [trajectory3DViewer, setTrajectory3DViewer] = useState<{
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
    geoawareness: Set<string>
  }>({
    processing: new Set(),
    downloading: new Set(),
    authorizing: new Set(),
    resetting: new Set(),
    deleting: new Set(),
    renaming: new Set(),
    moving: new Set(),
    geoawareness: new Set(),
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

  // TASK-033: Detect FAS processing state
  // FAS is processing when authorizationMessage is 'FAS procesando...' OR status is 'pendiente'
  const isFasProcessing = useMemo(() => {
    if (!selectedPlan) return false
    const message = selectedPlan.authorizationMessage
    const messageStr = typeof message === 'string' ? message : ''
    return messageStr === 'FAS procesando...' || selectedPlan.authorizationStatus === 'pendiente'
  }, [selectedPlan])

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
    // Normalize both IDs to strings for comparison
    const plan = flightPlans.find(p => String(p.id) === String(planId))
    
    // console.log('[FlightPlansUploader] View Trajectory clicked:', {
      // requestedPlanId: planId,
      // requestedPlanIdType: typeof planId,
      // foundPlan: plan?.id,
      // foundPlanIdType: typeof plan?.id,
      // planName: plan?.customName,
      // csvResultFlag: plan?.csvResult,
      // allPlanIds: flightPlans.map(p => ({ id: p.id, type: typeof p.id }))
    // })
    
    if (!plan?.csvResult) {
      toast.warning('No trajectory available to view.')
      return
    }

    // Open trajectory map viewer with the correct planId
    const planIdToUse = String(plan.id)
    // console.log('[FlightPlansUploader] Opening trajectory viewer with planId:', planIdToUse)
    
    setTrajectoryViewer({
      open: true,
      planId: planIdToUse,
      planName: plan.customName,
    })
  }, [flightPlans, toast])

  const handleAuthorizePlan = useCallback((planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan || plan.status !== 'procesado') {
      toast.warning('The plan must be processed before requesting authorization.')
      return
    }

    // Show confirmation dialog
    setAuthorizationConfirmDialog({
      open: true,
      planId,
      planName: plan.customName,
    })
  }, [flightPlans, toast])

  // Actual authorization after confirmation
  const confirmAuthorizePlan = useCallback(async () => {
    const planId = authorizationConfirmDialog.planId
    if (!planId) return

    setAuthorizationConfirmDialog(prev => ({ ...prev, open: false }))
    
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan || plan.status !== 'procesado') {
      toast.warning('The plan must be processed before requesting authorization.')
      return
    }

    // Parse uplan
    let uplanData = plan.uplan
    if (typeof uplanData === 'string') {
      try { uplanData = JSON.parse(uplanData) } catch { uplanData = null }
    }
    
    const GENERATE_RANDOM_DATA = process.env.NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA === 'true'

    // Step 1: Check if uplanData exists and skip volume regeneration
    if (!uplanData) {
      if (plan.csvResult) {
        addLoadingPlan('authorizing', planId)
        try {
          toast.info('Generating operation volumes...')
          const token = localStorage.getItem('authToken')
          const response = await fetch(`/api/flightPlans/${planId}/generate-volumes`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            throw new Error('Failed to generate volumes')
          }
          
          // Get the updated uplan directly from the response (don't rely on flightPlans array refresh)
          const result = await response.json()
          // console.log('[confirmAuthorizePlan] Volume generation result:', {
           //  volumesGenerated: result.volumesGenerated,
           //  randomDataGenerated: result.randomDataGenerated
          // })
          
          // Use the uplan from the response which includes the newly generated volumes
          uplanData = result.uplan
          
          // Confirm volumes were saved to database
          toast.success(`Operation volumes generated (${result.volumesGenerated} volumes)`)
          
          // Also refresh plans in background for UI consistency
          refreshPlans().catch(err => console.error('[confirmAuthorizePlan] Refresh error:', err))
        } catch (error) {
          removeLoadingPlan('authorizing', planId)
          toast.error('Failed to generate volumes. Please try again.')
          console.error('[confirmAuthorizePlan] Volume generation error:', error)
          return
        }
      }
    }

    // Step 2: If NOT random data mode, validate completeness
    if (!GENERATE_RANDOM_DATA) {
      if (!uplanData) {
        removeLoadingPlan('authorizing', planId)
        toast.error('Cannot submit to FAS: U-Plan data is not available.')
        return
      }

      const validationResult = isUplanComplete(uplanData)
      
      if (!validationResult.isComplete) {
        // console.log('[confirmAuthorizePlan] Validation failed:', {
          // missingFields: validationResult.missingFields,
          // fieldErrors: validationResult.fieldErrors
        // })
        
        // Show toast with summary of missing fields
        const fieldList = validationResult.missingFields.slice(0, 3).join(', ')
        const remaining = validationResult.missingFields.length - 3
        const summary = remaining > 0 
          ? `${fieldList}, and ${remaining} more` 
          : fieldList
        
        toast.error(`Please complete the required fields: ${summary}`)
        
        // Open UplanFormModal automatically with highlighted errors
        setUplanFormModal({
          open: true,
          planId,
          uplan: uplanData,
          name: plan.customName,
          missingFields: validationResult.missingFields,
          fieldErrors: validationResult.fieldErrors,
        })
        
        removeLoadingPlan('authorizing', planId)
        return
      }
    }

    // Step 3: Proceed with FAS authorization
    // Add loading state if not already added (when volumes were generated)
    if (!loadingPlanIds.authorizing.has(planId)) {
      addLoadingPlan('authorizing', planId)
    }
    
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
        
        // Handle 503: FAS temporarily unavailable (after all retries failed)
        if (response.status === 503) {
          throw new Error('FAS is temporarily unavailable. The plan remains in "sin autorización" state. Please try again later.')
        }
        
        throw new Error(error.error || 'Error submitting to FAS')
      }

      await refreshPlans()
      toast.success('Authorization request sent successfully.')
    } catch (error) {
      console.error('Authorization error:', error)
      
      // Show different message for FAS unavailability vs other errors
      const errorMessage = error instanceof Error ? error.message : 'Error requesting authorization.'
      toast.error("Denied: Outside of the FAS service area", {
        onRetry: () => handleAuthorizePlan(planId),
      })
    } finally {
      removeLoadingPlan('authorizing', planId)
    }
  }, [flightPlans, refreshPlans, addLoadingPlan, removeLoadingPlan, toast, loadingPlanIds.authorizing])

  // Handle geoawareness service call
  const handleGeoawareness = useCallback(async (planId: string) => {
    const logPrefix = '[Geoawareness]';
    
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan) {
      console.error(`${logPrefix} Plan not found`);
      return
    }

    if (plan.status !== 'procesado') {
      toast.warning('The plan must be processed before checking geoawareness.')
      return
    }

    if (!plan.uplan) {
      toast.warning('U-Plan data not available. Process the plan first.')
      return
    }

    // console.log(`${logPrefix} Checking plan: ${plan.customName}`);

    // TASK-076: Extract uspace_identifier for WebSocket connection
    let uspaceId: string | null = null
    try {
      const geoData = plan.geoawarenessData
      if (geoData && typeof geoData === 'object' && 'uspace_identifier' in geoData) {
        uspaceId = (geoData as { uspace_identifier: string }).uspace_identifier
      }
    } catch (error) {
      console.error(`${logPrefix} Error parsing geoawarenessData:`, error);
    }

    if (!uspaceId) {
      // External UPLAN without U-Space - open selector modal
      setUspaceSelectionModal({ open: true, planId })
      return
    }

    // console.log(`${logPrefix} U-Space: ${uspaceId}, calling API...`);
    addLoadingPlan('geoawareness', planId)
    
    try {
      const response = await fetch(`/api/flightPlans/${planId}/geoawareness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error calling geoawareness service')
      }

      const data = await response.json()
      // console.log(`${logPrefix} Validated. Opening modal with WS: ${data.wsUrl}`);
      
      await refreshPlans()
      
      toast.success('Opening geoawareness viewer...')

      // Open geoawareness viewer modal - this triggers WebSocket connection
      setGeoawarenessModal({
        open: true,
        planId: planId,
        planName: plan.customName,
        uspaceId: uspaceId,
      })
    } catch (error) {
      console.error(`${logPrefix} Error:`, error)
      toast.error(error instanceof Error ? error.message : 'Error checking geoawareness.', {
        onRetry: () => handleGeoawareness(planId),
      })
    } finally {
      removeLoadingPlan('geoawareness', planId)
    }
  }, [flightPlans, refreshPlans, addLoadingPlan, removeLoadingPlan, toast])

  // Handle U-Space selection for external UPLANs
  const handleUspaceSelection = useCallback(async (uspace: { id: string; name: string }) => {
    const planId = uspaceSelectionModal.planId
    if (!planId) return

    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan) return

    addLoadingPlan('geoawareness', planId)

    try {
      // Update plan's geoawarenessData with selected U-Space
      const updateResponse = await fetch(`/api/flightPlans`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          id: parseInt(planId),
          data: {
            geoawarenessData: { uspace_identifier: uspace.id }
          }
        }),
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update U-Space')
      }

      toast.success(`U-Space "${uspace.name}" assigned to flight plan`)
      
      // Close U-Space selector modal
      setUspaceSelectionModal({ open: false, planId: '' })

      // Call geoawareness API directly (don't wait for state refresh)
      const geoResponse = await fetch(`/api/flightPlans/${planId}/geoawareness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      })

      if (!geoResponse.ok) {
        const error = await geoResponse.json()
        throw new Error(error.error || 'Error calling geoawareness service')
      }

      await geoResponse.json()
      
      // Refresh plans to get updated geoawareness data
      await refreshPlans()
      
      toast.success('Opening geoawareness viewer...')

      // Open geoawareness viewer modal directly with the selected U-Space
      setGeoawarenessModal({
        open: true,
        planId: planId,
        planName: plan.customName,
        uspaceId: uspace.id,
      })
    } catch (error) {
      console.error('Error in U-Space selection flow:', error)
      toast.error(error instanceof Error ? error.message : 'Error checking geoawareness.', {
        onRetry: () => handleGeoawareness(planId),
      })
    } finally {
      removeLoadingPlan('geoawareness', planId)
    }
  }, [uspaceSelectionModal.planId, flightPlans, refreshPlans, toast, addLoadingPlan, removeLoadingPlan])

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
  
  // Task 2 + Task 8: Handle external UPLAN file import via drag-and-drop
  const handleImportExternalUplan = useCallback(async (uplan: object, folderId: string, customName: string) => {
    try {
      await importExternalUplan(uplan, Number(folderId), customName)
      toast.success('External UPLAN imported successfully.')
    } catch (error) {
      // Task 8: Show specific server error message
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error)
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Error importing external UPLAN.')
      }
    }
  }, [importExternalUplan, toast])

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

  // Handle plan click/selection - toggles selection only, does NOT open map
  const handlePlanClick = useCallback((planId: string) => {
    // Toggle selection for workflow UI
    setSelectedPlanId(prev => prev === planId ? null : planId)
    
    // Smooth scroll to top to show the selected plan details
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    })
  }, [])

  // Handle waypoint preview click - opens waypoint map modal
  const handleWaypointPreviewClick = useCallback((planId: string, waypoints: Waypoint[]) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (plan) {
      if (waypoints.length > 0) {
        setWaypointMapModal({
          open: true,
          planId,
          planName: plan.customName,
          waypoints,
        })
      } else {
        toast.warning('No waypoints found in this flight plan.')
      }
    }
  }, [flightPlans, toast])

  // TASK-003: Handle viewing U-Plan map - generates volumes on demand if not present
  const handleViewUplanMap = useCallback(async (planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan) return
    
    // Always fetch fresh plan data from API to ensure we have latest uplan with volumes
    setGeneratingVolumes(planId)
    
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/flightPlans/${planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch plan data')
      }
      
      const freshPlan = await response.json()
      
      // Parse uplan to check if volumes exist
      let uplanData: unknown = freshPlan.uplan
      if (typeof uplanData === 'string') {
        try { uplanData = JSON.parse(uplanData) } catch { uplanData = null }
      }
      
      // Check for operation volumes
      const uplanObj = uplanData as { operationVolumes?: unknown[] } | null
      const hasVolumes = Array.isArray(uplanObj?.operationVolumes) && uplanObj.operationVolumes.length > 0
      
      if (!hasVolumes && freshPlan.csvResult) {
        // Need to generate volumes first
        
        const volumeResponse = await fetch(`/api/flightPlans/${planId}/generate-volumes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!volumeResponse.ok) {
          throw new Error('Failed to generate volumes')
        }
        
        const result = await volumeResponse.json()
        
        // Refresh flight plans in background for UI consistency
        refreshPlans().catch(err => console.error('[ViewUplanMap] Refresh error:', err))
        
        // Open modal with generated data from response
        setUplanViewModal({
          open: true,
          uplan: result.uplan,
          name: plan.customName,
          fileContent: plan.fileContent ?? null,
        })
        
        toast.success(`Generated ${result.volumesGenerated} operation volumes`)
      } else {
        // Volumes exist, open modal with fresh data
        setUplanViewModal({
          open: true,
          uplan: uplanData, // Use parsed uplan
          name: plan.customName,
          fileContent: freshPlan.fileContent ?? null,
        })
        
        if (hasVolumes) {
          const volumeCount = (uplanObj?.operationVolumes as unknown[]).length
          toast.success(`Loaded ${volumeCount} operation volumes`)
        }
      }
    } catch (error) {
      toast.error('Failed to load U-Plan data. Please try again.')
      console.error('[ViewUplanMap] Error:', error)
    } finally {
      setGeneratingVolumes(null)
    }
  }, [flightPlans, refreshPlans, toast])

  // Task 11: Handle viewing 3D U-Plan - generates volumes on demand if not present
  const handleView3DUplan = useCallback(async (planId: string) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (!plan) return

    setGeneratingVolumes3D(planId)

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/flightPlans/${planId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to fetch plan data')

      const freshPlan = await response.json()

      let uplanData: any = freshPlan.uplan
      if (typeof uplanData === 'string') {
        try { uplanData = JSON.parse(uplanData) } catch { uplanData = null }
      }

      const hasVolumes = Array.isArray(uplanData?.operationVolumes) && uplanData.operationVolumes.length > 0

      if (!hasVolumes && freshPlan.csvResult) {
        const volumeResponse = await fetch(`/api/flightPlans/${planId}/generate-volumes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!volumeResponse.ok) throw new Error('Failed to generate volumes')

        const result = await volumeResponse.json()
        refreshPlans().catch(err => console.error('[View3DUplan] Refresh error:', err))
        uplanData = result.uplan
        toast.success(`Generated ${result.volumesGenerated} operation volumes`)
      }

      if (!uplanData?.operationVolumes?.length) {
        toast.warning('No operation volumes available for 3D view.')
        return
      }

      setCesium3DModal({ open: true, uplanData })
    } catch (error) {
      toast.error('Failed to load 3D U-Plan data.')
      console.error('[View3DUplan] Error:', error)
    } finally {
      setGeneratingVolumes3D(null)
    }
  }, [flightPlans, refreshPlans, toast])

  // Handle viewing authorization message - opens unified AuthorizationResultModal for both approved and denied plans
  const handleViewAuthorizationMessage = useCallback((planId: string, message: unknown) => {
    const plan = flightPlans.find(p => String(p.id) === planId)
    if (plan) {
      const uplanData = plan.uplan ? (typeof plan.uplan === 'string' ? JSON.parse(plan.uplan) : plan.uplan) : null
      const messageStr = typeof message === 'string' ? message : (message != null ? JSON.stringify(message) : null)

      // Task 18: Open unified AuthorizationResultModal for both approved and denied
      setAuthResultModal({
        open: true,
        uplanData,
        status: plan.authorizationStatus === 'aprobado' ? 'aprobado' : 'denegado',
        reason: messageStr,
        geoawarenessData: plan.geoawarenessData ?? null,
        planName: plan.customName,
      })
    }
  }, [flightPlans])

  // Task 11: Open denial map from authorization message modal
  const handleOpenDenialMap = useCallback(() => {
    if (!authorizationMessageModal.message || !authorizationMessageModal.uplan) return
    const messageStr = typeof authorizationMessageModal.message === 'string'
      ? authorizationMessageModal.message
      : JSON.stringify(authorizationMessageModal.message)
    setDenialMapModal({
      open: true,
      uplan: authorizationMessageModal.uplan,
      authorizationMessage: messageStr,
      geoawarenessData: null,
    })
  }, [authorizationMessageModal])

  // Task 11: Open raw JSON modal from denial map (secondary access)
  const handleViewRawDenial = useCallback(() => {
    // Find the plan that matches the current denial modal's uplan
    const plan = flightPlans.find(p => {
      const uplanData = p.uplan ? (typeof p.uplan === 'string' ? JSON.parse(p.uplan) : p.uplan) : null
      return uplanData === denialMapModal.uplan || JSON.stringify(uplanData) === JSON.stringify(denialMapModal.uplan)
    })
    if (plan) {
      setAuthorizationMessageModal({
        open: true,
        planId: String(plan.id),
        planName: plan.customName,
        message: plan.authorizationMessage,
        status: 'denegado',
        uplan: denialMapModal.uplan,
      })
    }
  }, [flightPlans, denialMapModal])

  // Task 6: Download U-Plan as JSON — generates volumes first if missing
  const handleDownloadUplanJson = useCallback(async (planId: string, uplanData: unknown, planName: string) => {
    if (!uplanData || !planName) return

    const uplanObj = uplanData as { operationVolumes?: unknown[] } | null
    const hasVolumes = Array.isArray(uplanObj?.operationVolumes) && uplanObj.operationVolumes.length > 0

    let finalUplan = uplanData

    if (!hasVolumes) {
      addLoadingPlan('downloading', planId)
      try {
        const token = localStorage.getItem('authToken')
        const response = await fetch(`/api/flightPlans/${planId}/generate-volumes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error('Failed to generate volumes')
        }

        const result = await response.json()
        finalUplan = result.uplan

        refreshPlans().catch(err => console.error('[DownloadUplan] Refresh error:', err))
        toast.success(`Generated ${result.volumesGenerated} operation volumes`)
      } catch (error) {
        console.error('[DownloadUplan] Volume generation error:', error)
        toast.error('Failed to generate volumes. Cannot download U-Plan.')
        return
      } finally {
        removeLoadingPlan('downloading', planId)
      }
    }

    const jsonStr = JSON.stringify(finalUplan, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `uplan_${planName.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [addLoadingPlan, removeLoadingPlan, refreshPlans, toast])

  // Download U-Plan from authorization message modal (delegates to handleDownloadUplanJson)
  const handleDownloadUplan = useCallback(() => {
    if (!authorizationMessageModal.uplan || !authorizationMessageModal.planName || !authorizationMessageModal.planId) return
    handleDownloadUplanJson(authorizationMessageModal.planId, authorizationMessageModal.uplan, authorizationMessageModal.planName)
  }, [authorizationMessageModal.uplan, authorizationMessageModal.planName, authorizationMessageModal.planId, handleDownloadUplanJson])

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
      {/* Help Button */}
      <a
        href="/how-it-works#trajectory-generator-help"
        target="_self"
        className="fixed top-24 right-4 sm:right-8 z-[9999] bg-blue-700 hover:bg-blue-800 text-white rounded-full p-2 sm:p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
        title="Need help with Trajectory Generator?"
      >
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
      </a>
      
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
      <div className="relative z-10 bg-[var(--surface-primary)] rounded-lg border border-[var(--border-primary)] p-6 shadow-sm fade-in-up">
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
        <div className="bg-[var(--surface-secondary)] rounded-lg border border-[var(--border-primary)] p-6 fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Selected plan: {selectedPlan.name}
            </h3>
            <button
              onClick={() => setSelectedPlanId(null)}
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] btn-interactive-subtle"
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
            onViewAuthorizationMessage={handleViewAuthorizationMessage}
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
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-[var(--border-primary)] fade-in">
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
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-[var(--border-primary)] fade-in">
              {/* Animated processing indicator when plan is in process */}
              {selectedPlan.status === 'en proceso' ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <LoadingSpinner size="md" variant="primary" />
                      <div className="absolute inset-0 animate-ping opacity-30">
                        <LoadingSpinner size="md" variant="primary" />
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        Processing Plan...
                      </span>
                      <p className="text-xs text-[var(--text-muted)]">
                        Generating trajectory and U-Plan
                      </p>
                    </div>
                  </div>
                  {/* Animated progress bar */}
                  <div className="w-full h-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    The plan is currently being processed. Please wait for completion.
                  </p>
                  <button
                    disabled={true}
                    className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-400 dark:bg-blue-600 rounded-md cursor-not-allowed opacity-70 flex items-center gap-2"
                  >
                    <LoadingSpinner size="xs" variant="white" />
                    Processing...
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    The plan is ready to be processed. This will generate the trajectory and U-Plan.
                  </p>
                  <button
                    onClick={() => handleProcessPlan(selectedPlan.id)}
                    disabled={loadingPlanIds.processing.has(selectedPlan.id) || selectedPlan.status !== 'sin procesar'}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors btn-interactive disabled-transition"
                  >
                    {loadingPlanIds.processing.has(selectedPlan.id) ? 'Processing...' : 'Process plan'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Action buttons for processed plans - always shown after processing */}
          {selectedPlan.status === 'procesado' && (
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-[var(--border-primary)] fade-in">
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                {selectedPlan.authorizationStatus === 'pendiente' 
                  ? 'Authorization request sent to FAS. You can review data while waiting.'
                  : selectedPlan.authorizationStatus === 'aprobado' || selectedPlan.authorizationStatus === 'denegado'
                    ? 'View your flight plan data below.'
                    : 'The plan has been processed. Review the U-Plan information and check geoawareness data before requesting authorization.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {/* Review U-Plan button - TASK-023: Opens UplanFormModal for editing */}
                {/* Disabled when plan is already authorized (aprobado), denied (denegado), or pending (pendiente) */}
                <button
                  onClick={() => {
                    setUplanFormModal({
                      open: true,
                      planId: selectedPlan.id,
                      uplan: selectedPlan.uplan,
                      name: selectedPlan.name,
                    })
                  }}
                  disabled={selectedPlan.authorizationStatus === 'aprobado' || selectedPlan.authorizationStatus === 'denegado' || selectedPlan.authorizationStatus === 'pendiente'}
                  title={selectedPlan.authorizationStatus === 'aprobado' || selectedPlan.authorizationStatus === 'denegado' ? 'Cannot edit - plan has been authorized/denied' : selectedPlan.authorizationStatus === 'pendiente' ? 'Cannot edit while FAS is processing' : undefined}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Review U-Plan
                </button>
                {/* View U-Plan Map button - shows operation volumes on map */}
                {/* TASK-079: Show waypoints even without uplan, for planning visualization */}
                {/* TASK-003: Generate volumes on demand if not present */}
                <button
                  onClick={() => handleViewUplanMap(selectedPlan.id)}
                  disabled={(!selectedPlan.fileContent && !selectedPlan.uplan) || generatingVolumes === selectedPlan.id}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                >
                  {generatingVolumes === selectedPlan.id ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating Volumes...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      View U-Plan Map
                    </>
                  )}
                </button>
                {/* Task 11: View 3D U-Plan button - opens Cesium 3D viewer */}
                <button
                  onClick={() => handleView3DUplan(selectedPlan.id)}
                  disabled={(!selectedPlan.fileContent && !selectedPlan.uplan) || generatingVolumes3D === selectedPlan.id}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                >
                  {generatingVolumes3D === selectedPlan.id ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading 3D...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      View 3D U-Plan
                    </>
                  )}
                </button>
                {/* View trajectory button - TASK-001: Require status=procesado AND csvResult */}
                <button
                  onClick={() => handleDownloadPlan(selectedPlan.id)}
                  disabled={selectedPlan.status !== 'procesado' || !selectedPlan.csvResult}
                  title={selectedPlan.status !== 'procesado' ? 'Plan must be processed first' : !selectedPlan.csvResult ? 'Trajectory data not available' : undefined}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  View Trajectory
                </button>
                {/* Task 20: View trajectory in 3D with drone animation */}
                <button
                  onClick={() => {
                    const plan = flightPlans.find(p => String(p.id) === String(selectedPlan.id))
                    if (!plan?.csvResult) return
                    setTrajectory3DViewer({
                      open: true,
                      planId: String(plan.id),
                      planName: plan.customName,
                    })
                  }}
                  disabled={selectedPlan.status !== 'procesado' || !selectedPlan.csvResult}
                  title={selectedPlan.status !== 'procesado' ? 'Plan must be processed first' : !selectedPlan.csvResult ? 'Trajectory data not available' : undefined}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  View Trajectory 3D
                </button>
                {/* Check Geoawareness button */}
                <button
                  onClick={() => handleGeoawareness(selectedPlan.id)}
                  disabled={loadingPlanIds.geoawareness.has(selectedPlan.id)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                >
                  {loadingPlanIds.geoawareness.has(selectedPlan.id) ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Checking...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Check Geoawareness
                    </>
                  )}
                </button>
                {/* Download U-Plan JSON button - always visible after processing */}
                {/* Task 6: Auto-generates volumes before download if missing */}
                {selectedPlan.uplan ? (
                  <button
                    onClick={() => handleDownloadUplanJson(selectedPlan.id, selectedPlan.uplan, selectedPlan.name)}
                    disabled={loadingPlanIds.downloading.has(selectedPlan.id)}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-tertiary)] border border-[var(--border-primary)] rounded-md hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-interactive flex items-center gap-2"
                  >
                    {loadingPlanIds.downloading.has(selectedPlan.id) ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating Volumes...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download U-Plan
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {/* TASK: Large authorization status button for approved/denied plans */}
              {(selectedPlan.authorizationStatus === 'aprobado' || selectedPlan.authorizationStatus === 'denegado') && (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleViewAuthorizationMessage(selectedPlan.id, selectedPlan.authorizationMessage)}
                    className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg flex items-center justify-center gap-3 ${
                      selectedPlan.authorizationStatus === 'aprobado'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {selectedPlan.authorizationStatus === 'aprobado' ? (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Authorization Result (Approved)
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        View Authorization Result (Denied)
                      </>
                    )}
                  </button>
                  {/* Task 17: 3D Denial view button for denied plans */}
                  {selectedPlan.authorizationStatus === 'denegado' && !!selectedPlan.uplan && (
                    <button
                      onClick={() => {
                        const messageStr = typeof selectedPlan.authorizationMessage === 'string'
                          ? selectedPlan.authorizationMessage
                          : typeof selectedPlan.authorizationMessage === 'object' && selectedPlan.authorizationMessage !== null
                            ? JSON.stringify(selectedPlan.authorizationMessage)
                            : null
                        setDenial3DModal({
                          open: true,
                          uplan: selectedPlan.uplan,
                          authorizationMessage: messageStr,
                          geoawarenessData: selectedPlan.geoawarenessData ?? null,
                        })
                      }}
                      className="w-full px-6 py-3 text-base font-semibold rounded-lg transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg flex items-center justify-center gap-3 bg-red-700 hover:bg-red-800 text-white"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      View Denial 3D
                    </button>
                  )}
                </div>
              )}

              {/* Only show authorization prompt when not yet authorized */}
              {selectedPlan.authorizationStatus === 'sin autorización' && (
                <>
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    Review the U-Plan, check geoawareness for conflicting zones, and view the trajectory before continuing to authorization.
                  </p>
                  {/* TASK-035: Disable authorization button during FAS processing */}
                  <button
                    onClick={() => handleAuthorizePlan(selectedPlan.id)}
                    disabled={loadingPlanIds.authorizing.has(selectedPlan.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-400 transition-colors btn-interactive disabled-transition flex items-center gap-2"
                  >
                    {loadingPlanIds.authorizing.has(selectedPlan.id) ? (
                      <>
                        <LoadingSpinner size="xs" variant="white" />
                        Requesting...
                      </>
                    ) : (
                      'Continue to authorization'
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* TASK-034: Authorize action prompt with enhanced UI when FAS is processing */}
          {(currentStep === 'authorize' || isFasProcessing) && selectedPlan.authorizationStatus === 'pendiente' && (
            <div className="mt-4 p-4 bg-[var(--surface-primary)] rounded-lg border border-amber-100 dark:border-amber-900 fade-in">
              {/* TASK-034: Animated FAS processing indicator */}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <LoadingSpinner size="md" variant="primary" />
                  <div className="absolute inset-0 animate-ping opacity-30">
                    <LoadingSpinner size="md" variant="primary" />
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">FAS Processing...</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    Authorization request submitted
                  </p>
                </div>
              </div>
              {/* Animated progress bar */}
              <div className="w-full h-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-amber-500 dark:bg-amber-400 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                The authorization request has been sent to FAS. Status will update automatically.
              </p>
              {/* TASK-035: Disabled authorization button during processing */}
              <button
                disabled={true}
                className="mt-3 px-4 py-2 text-sm font-medium text-white bg-amber-400 dark:bg-amber-600 rounded-md cursor-not-allowed opacity-70 flex items-center gap-2"
              >
                <LoadingSpinner size="xs" variant="white" />
                Awaiting FAS Response
              </button>
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
          onImportExternalUplan={handleImportExternalUplan}
          onWaypointPreviewClick={handleWaypointPreviewClick}
          onViewAuthorizationMessage={handleViewAuthorizationMessage}
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
                      onViewAuthorizationMessage={handleViewAuthorizationMessage}
                      onWaypointPreviewClick={handleWaypointPreviewClick}
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

      {/* Authorization confirmation dialog */}
      <ConfirmDialog
        open={authorizationConfirmDialog.open}
        onClose={() => setAuthorizationConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmAuthorizePlan}
        title="Confirm Authorization Request"
        message={`You are about to submit the plan "${authorizationConfirmDialog.planName}" to the Flight Authorization Service (FAS) for approval.\n\nPlease confirm that:\n• All flight plan data is accurate and complete\n• Operation volumes have been reviewed\n• Geoawareness zones have been checked\n• You understand this action will send the plan for official authorization\n\nDo you want to proceed?`}
        confirmLabel="Submit to FAS"
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
          key={trajectoryViewer.planId}
          planId={trajectoryViewer.planId}
          planName={trajectoryViewer.planName}
          onClose={() => setTrajectoryViewer({ open: false, planId: null, planName: '' })}
        />
      )}

      {/* Waypoint map modal - shows flight plan waypoints on interactive map */}
      {waypointMapModal.open && (
        <WaypointMapModal
          open={waypointMapModal.open}
          onClose={() => setWaypointMapModal({ open: false, planId: null, planName: '', waypoints: [] })}
          title="Flight Plan Waypoints"
          planName={waypointMapModal.planName}
          waypoints={waypointMapModal.waypoints}
        />
      )}

      {/* Authorization message modal - shows FAS authorization response */}
      {authorizationMessageModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setAuthorizationMessageModal({ open: false, planId: null, planName: '', message: null, status: null, uplan: null })}
        >
          <div
            className="bg-[var(--surface-primary)] rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b border-[var(--border-primary)] flex items-center justify-between ${
              authorizationMessageModal.status === 'aprobado' 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : authorizationMessageModal.status === 'denegado'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : ''
            }`}>
              <div className="flex items-center gap-3">
                {authorizationMessageModal.status === 'aprobado' ? (
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016A11.955 11.955 0 0112 2.944zm3.707 7.763a1 1 0 00-1.414-1.414L11 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : authorizationMessageModal.status === 'denegado' ? (
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016A11.955 11.955 0 0112 2.944zM9.707 9.707a1 1 0 00-1.414 1.414L10.586 12l-2.293 2.879a1 1 0 101.414 1.414L12 14.414l2.293 1.879a1 1 0 001.414-1.414L13.414 12l2.293-2.879a1 1 0 00-1.414-1.414L12 9.586l-2.293-1.879z" clipRule="evenodd" />
                  </svg>
                ) : null}
                <div>
                  <h2 className={`text-lg font-semibold ${
                    authorizationMessageModal.status === 'aprobado' 
                      ? 'text-green-800 dark:text-green-200' 
                      : authorizationMessageModal.status === 'denegado'
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-[var(--text-primary)]'
                  }`}>
                    {authorizationMessageModal.status === 'aprobado' ? 'Authorization Approved' : 
                     authorizationMessageModal.status === 'denegado' ? 'Authorization Denied' : 
                     'Authorization Response'}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">{authorizationMessageModal.planName}</p>
                </div>
              </div>
              <button
                onClick={() => setAuthorizationMessageModal({ open: false, planId: null, planName: '', message: null, status: null, uplan: null })}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Content */}
            <div className="p-6 overflow-auto flex-1">
              {authorizationMessageModal.message ? (
                <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-primary)] overflow-x-auto">
                  {typeof authorizationMessageModal.message === 'string' 
                    ? authorizationMessageModal.message 
                    : JSON.stringify(authorizationMessageModal.message, null, 2)}
                </pre>
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-sm">No authorization message available.</p>
                  <p className="text-xs mt-1">The FAS response was not stored or is empty.</p>
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border-primary)] flex justify-between items-center">
              <div className="flex items-center gap-2">
                {!!authorizationMessageModal.uplan && (
                  <button
                    onClick={handleDownloadUplan}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download U-Plan (JSON)
                  </button>
                )}
                {/* Task 11: View denial on map button for denied plans */}
                {authorizationMessageModal.status === 'denegado' && !!authorizationMessageModal.uplan && (
                  <button
                    onClick={handleOpenDenialMap}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    View denial on map
                  </button>
                )}
              </div>
              <button
                onClick={() => setAuthorizationMessageModal({ open: false, planId: null, planName: '', message: null, status: null, uplan: null })}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 11: Denial map modal - shows conflicting volumes and geozones */}
      <DenialMapModal
        open={denialMapModal.open}
        onClose={() => setDenialMapModal({ open: false, uplan: null, authorizationMessage: null, geoawarenessData: null })}
        uplan={denialMapModal.uplan as { operationVolumes?: { geometry: { type: string; coordinates: number[][][] }; [key: string]: unknown }[] } | null}
        authorizationMessage={denialMapModal.authorizationMessage}
        geoawarenessData={denialMapModal.geoawarenessData}
      />

      {/* U-Plan map viewer modal - shows operation volumes on map */}
      {/* TASK-079: Now also shows waypoints from fileContent */}
      <UplanViewModal
        open={uplanViewModal.open}
        onClose={() => setUplanViewModal({ open: false, uplan: null, name: '', fileContent: null })}
        uplan={uplanViewModal.uplan}
        name={uplanViewModal.name}
        fileContent={uplanViewModal.fileContent}
      />

      {/* U-Plan form modal - TASK-023: editable form for U-Plan data */}
      {/* TASK-003: Pass validation errors for field highlighting */}
      <UplanFormModal
        open={uplanFormModal.open}
        onClose={() => setUplanFormModal({ open: false, planId: '', uplan: null, name: '' })}
        planId={uplanFormModal.planId}
        existingUplan={uplanFormModal.uplan}
        planName={uplanFormModal.name}
        authToken={typeof window !== 'undefined' ? localStorage.getItem('authToken') || '' : ''}
        hasBeenProcessed={selectedPlan?.status === 'procesado'}
        hasScheduledAt={!!selectedPlan?.scheduledAt}
        missingFields={uplanFormModal.missingFields}
        fieldErrors={uplanFormModal.fieldErrors}
        onSave={() => {
          // Refresh flight plans after saving draft
          refreshPlans()
        }}
        onRequestAuthorization={(planId) => {
          // User clicked "Save & Request Auth" - trigger authorization flow with confirmation
          handleAuthorizePlan(planId)
        }}
      />

      {/* TASK-076: Geoawareness viewer modal - shows trajectory over geozones */}
      <Modal
        open={geoawarenessModal.open}
        onClose={() => setGeoawarenessModal({ open: false, planId: '', planName: '', uspaceId: null })}
        title={`Geoawareness: ${geoawarenessModal.planName}`}
        maxWidth="4xl"
      >
        <div className="h-[70vh] -mx-6 -mb-6">
          <GeoawarenessViewer
            key={geoawarenessModal.planId}
            planId={geoawarenessModal.planId}
            planName={geoawarenessModal.planName}
            uspaceId={geoawarenessModal.uspaceId}
          />
        </div>
      </Modal>

      {/* U-Space selector modal for external UPLANs */}
      <Modal
        open={uspaceSelectionModal.open}
        onClose={() => setUspaceSelectionModal({ open: false, planId: '' })}
        title="Select U-Space for Flight Plan"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            This flight plan has no U-Space identifier. Please select the U-Space where you want to fly to check geoawareness.
          </p>
          <UspaceSelector
            onSelect={handleUspaceSelection}
            selectedUspaceId={null}
          />
        </div>
      </Modal>

      {/* Task 11: Cesium 3D U-Plan viewer */}
      <Cesium3DModal
        isOpen={cesium3DModal.open}
        onClose={() => setCesium3DModal({ open: false, uplanData: null })}
        uplanData={cesium3DModal.uplanData}
      />

      {/* Task 17: 3D Denial viewer */}
      <Denial3DModal
        isOpen={denial3DModal.open}
        onClose={() => setDenial3DModal({ open: false, uplan: null, authorizationMessage: null, geoawarenessData: null })}
        uplan={denial3DModal.uplan as { operationVolumes?: { geometry: { type: string; coordinates: number[][][] }; [key: string]: unknown }[] } | null}
        authorizationMessage={denial3DModal.authorizationMessage}
        geoawarenessData={denial3DModal.geoawarenessData}
      />

      {/* Task 18: Unified Authorization Result modal (approved + denied) */}
      <AuthorizationResultModal
        isOpen={authResultModal.open}
        onClose={() => setAuthResultModal({ open: false, uplanData: null, status: '', reason: null, geoawarenessData: null, planName: '' })}
        uplanData={authResultModal.uplanData as any}
        status={authResultModal.status}
        reason={authResultModal.reason}
        geoawarenessData={authResultModal.geoawarenessData}
        planName={authResultModal.planName}
      />

      {/* Task 20: 3D Trajectory viewer with drone animation */}
      {trajectory3DViewer.planId && (
        <Trajectory3DViewer
          isOpen={trajectory3DViewer.open}
          onClose={() => setTrajectory3DViewer({ open: false, planId: null, planName: '' })}
          planId={trajectory3DViewer.planId}
          planName={trajectory3DViewer.planName}
        />
      )}
    </div>
  )
}

export default FlightPlansUploader
