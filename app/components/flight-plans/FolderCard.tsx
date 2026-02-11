import React, { useState, useEffect, useRef, DragEvent } from 'react'
import { FlightPlanList, type FlightPlanListProps } from './FlightPlanList'
import { type FlightPlan, type FlightPlanDragData, type Waypoint, FLIGHT_PLAN_DRAG_TYPE } from './FlightPlanCard'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { useI18n } from '@/app/i18n'

export interface Folder {
  id: string
  name: string
  createdAt?: string | Date
  updatedAt?: string | Date
  flightPlans: FlightPlan[]
}

export interface FolderCardProps {
  folder: Folder
  defaultExpanded?: boolean
  /** List of existing folder names (for uniqueness validation) */
  existingFolderNames?: string[]
  onRename?: (folderId: string, newName: string) => void
  onDelete?: (folderId: string) => void
  onProcessPlan?: (planId: string) => void
  onDownloadPlan?: (planId: string) => void
  onAuthorizePlan?: (planId: string) => void
  onResetPlan?: (planId: string) => void
  onDeletePlan?: (planId: string) => void
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
  /** TASK-222: Called when a plan is dropped onto this folder */
  onDropPlan?: (planId: string, targetFolderId: string) => void
  /** Task 2: Called when an external UPLAN .json file is dropped onto this folder */
  onImportExternalUplan?: (uplan: object, folderId: string, customName: string) => void
  /** Callback when clicking on waypoint preview to open map */
  onWaypointPreviewClick?: (planId: string, waypoints: Waypoint[]) => void
  /** Callback to view authorization message */
  onViewAuthorizationMessage?: (planId: string, message: unknown) => void
  loadingPlanIds?: FlightPlanListProps['loadingPlanIds']
  loadingStates?: {
    renaming?: boolean
    deleting?: boolean
  }
  className?: string
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  )
}

function DeleteFolderIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

export function FolderCard({
  folder,
  defaultExpanded = false,
  existingFolderNames = [],
  onRename,
  onDelete,
  onProcessPlan,
  onDownloadPlan,
  onAuthorizePlan,
  onResetPlan,
  onDeletePlan,
  onSelectPlan,
  selectedPlanId,
  onRenamePlan,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDropPlan,
  onImportExternalUplan,
  onWaypointPreviewClick,
  onViewAuthorizationMessage,
  loadingPlanIds,
  loadingStates = {},
  className = '',
}: FolderCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFileDragOver, setIsFileDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit name when folder name changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditName(folder.name)
    }
  }, [folder.name, isEditing])

  // Auto-expand folder when it contains the selected plan
  useEffect(() => {
    if (selectedPlanId && folder.flightPlans.some(plan => plan.id === selectedPlanId)) {
      setExpanded(true)
    }
  }, [selectedPlanId, folder.flightPlans])

  const handleToggle = () => {
    if (!isEditing) {
      setExpanded(!expanded)
    }
  }

  /**
   * Validate folder name
   * - Must be non-empty
   * - Must be unique within user's folders
   */
  const validateName = (name: string): string | null => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      return t.flightPlans.folderNameEmpty
    }
    
    // Check uniqueness (exclude current folder's name)
    const otherFolderNames = existingFolderNames.filter(
      n => n.toLowerCase() !== folder.name.toLowerCase()
    )
    if (otherFolderNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())) {
      return t.flightPlans.folderNameExists
    }
    
    return null
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setEditName(newValue)
    // Clear validation error as user types
    if (validationError) {
      setValidationError(null)
    }
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const trimmedName = editName.trim()
    const error = validateName(trimmedName)
    
    if (error) {
      setValidationError(error)
      return
    }
    
    // Only call onRename if the name actually changed
    if (trimmedName !== folder.name) {
      onRename?.(folder.id, trimmedName)
    }
    
    setIsEditing(false)
    setValidationError(null)
  }

  const handleRenameCancel = () => {
    setEditName(folder.name)
    setIsEditing(false)
    setValidationError(null)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = () => {
    onDelete?.(folder.id)
    setShowDeleteConfirm(false)
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  // Helper: check if drag event contains external files (not flight plan cards)
  const isFileDrag = (e: DragEvent<HTMLDivElement>): boolean => {
    return e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes(FLIGHT_PLAN_DRAG_TYPE)
  }

  // TASK-222: Handle drag over
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    if (isFileDrag(e)) {
      e.dataTransfer.dropEffect = 'copy'
      setIsFileDragOver(true)
      return
    }
    
    // Only allow drops from flight plans
    if (!e.dataTransfer.types.includes(FLIGHT_PLAN_DRAG_TYPE)) {
      return
    }
    
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  // TASK-222: Handle drag enter
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    if (isFileDrag(e)) {
      setIsFileDragOver(true)
      return
    }
    
    if (!e.dataTransfer.types.includes(FLIGHT_PLAN_DRAG_TYPE)) {
      return
    }
    
    setIsDragOver(true)
  }

  // TASK-222: Handle drag leave
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    // Only set drag state to false if we're leaving the folder card entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false)
      setIsFileDragOver(false)
    }
  }

  // Task 2: Handle external UPLAN file drop
  const handleFileDrop = async (files: FileList) => {
    const file = files[0]
    if (!file) return

    // Accept only .json files
    if (!file.name.toLowerCase().endsWith('.json')) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      // Validate it has operationVolumes
      if (!parsed.operationVolumes || !Array.isArray(parsed.operationVolumes) || parsed.operationVolumes.length === 0) {
        return
      }

      onImportExternalUplan?.(parsed, folder.id, file.name)
      setExpanded(true)
    } catch {
      // JSON parse error — invalid file
    }
  }

  // TASK-222: Handle drop
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    setIsFileDragOver(false)
    
    // Task 2: Check for external file drops first
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !e.dataTransfer.types.includes(FLIGHT_PLAN_DRAG_TYPE)) {
      handleFileDrop(e.dataTransfer.files)
      return
    }

    const dragDataStr = e.dataTransfer.getData(FLIGHT_PLAN_DRAG_TYPE)
    if (!dragDataStr) return
    
    try {
      const dragData: FlightPlanDragData = JSON.parse(dragDataStr)
      
      // Don't do anything if dropping in the same folder
      if (dragData.sourceFolderId === folder.id) {
        return
      }
      
      // Call the drop handler
      onDropPlan?.(dragData.planId, folder.id)
      
      // Expand the folder to show the new plan
      setExpanded(true)
    } catch (err) {
      console.error('Error parsing drag data:', err)
    }
  }

  const planCount = folder.flightPlans.length

  return (
    <div 
      className={`rounded-lg border bg-[var(--surface-primary)] shadow-sm transition-all ${className} ${
        isFileDragOver
          ? 'border-green-500 dark:border-green-400 border-2 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500/30'
          : isDragOver
            ? 'border-blue-500 dark:border-blue-400 border-2 bg-[var(--surface-secondary)] ring-2 ring-blue-500/30'
            : 'border-[var(--border-primary)]'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Folder header */}
      <div
        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer transition-colors ${
          isFileDragOver
            ? 'bg-green-50 dark:bg-green-900/20'
            : isDragOver
              ? 'bg-[var(--surface-tertiary)]'
              : 'hover:bg-[var(--bg-hover)]'
        }`}
        onClick={handleToggle}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <ChevronIcon expanded={expanded} />
        <FolderIcon />
        
        {/* Task 2: File drop indicator */}
        {isFileDragOver && (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 animate-pulse">
            {t.flightPlans.dropUplanHere}
          </span>
        )}
        
        {/* TASK-222: Drop indicator */}
        {isDragOver && !isFileDragOver && (
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse">
            {t.flightPlans.dropHere}
          </span>
        )}

        {isEditing ? (
          <form onSubmit={handleRenameSubmit} className="flex-1 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={handleNameChange}
                className={`flex-1 px-2 py-1.5 sm:py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                  validationError
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleRenameCancel()
                  }
                }}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'folder-name-error' : undefined}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loadingStates.renaming || !editName.trim()}
                >
                  {loadingStates.renaming ? '...' : t.common.save}
                </button>
                <button
                  type="button"
                  onClick={handleRenameCancel}
                  className="flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
            {validationError && (
              <p id="folder-name-error" className="text-xs text-red-600 ml-1">
                {validationError}
              </p>
            )}
          </form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h3
                className="text-sm font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                title={folder.name}
                onClick={handleEditClick}
              >
                {folder.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {planCount} {planCount === 1 ? t.flightPlans.flightPlan.toLowerCase() : t.flightPlans.flightPlans.toLowerCase()}
              </p>
            </div>

            <button
              onClick={handleDeleteClick}
              disabled={loadingStates.deleting}
              className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Delete folder"
            >
              {loadingStates.deleting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <DeleteFolderIcon />
              )}
            </button>
          </>
        )}
      </div>

      {/* Expanded content - flight plans list */}
      {expanded && (
        <div className="border-t border-[var(--border-primary)] p-3 sm:p-4 bg-[var(--bg-secondary)]">
          <FlightPlanList
            plans={folder.flightPlans}
            folderId={folder.id}
            onProcess={onProcessPlan}
            onDownload={onDownloadPlan}
            onAuthorize={onAuthorizePlan}
            onReset={onResetPlan}
            onDelete={onDeletePlan}
            onSelectPlan={onSelectPlan}
            selectedPlanId={selectedPlanId}
            onRenamePlan={onRenamePlan}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onWaypointPreviewClick={onWaypointPreviewClick}
            onViewAuthorizationMessage={onViewAuthorizationMessage}
            loadingPlanIds={loadingPlanIds}
            emptyMessage={t.flightPlans.emptyFolder}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t.flightPlans.deleteFolder}
        message={`${t.flightPlans.confirmDeleteFolder}${
          planCount > 0
            ? ` (${planCount} ${planCount === 1 ? t.flightPlans.flightPlan.toLowerCase() : t.flightPlans.flightPlans.toLowerCase()})` 
            : ''
        } ${t.flightPlans.actionCannotBeUndone}`}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        variant="danger"
        loading={loadingStates.deleting}
      />
    </div>
  )
}
