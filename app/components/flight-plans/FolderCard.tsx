import React, { useState, useEffect, useRef } from 'react'
import { FlightPlanList, type FlightPlanListProps } from './FlightPlanList'
import { type FlightPlan } from './FlightPlanCard'
import { ConfirmDialog } from '../ui/confirm-dialog'

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
  loadingPlanIds,
  loadingStates = {},
  className = '',
}: FolderCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      return 'El nombre de la carpeta no puede estar vacío'
    }
    
    // Check uniqueness (exclude current folder's name)
    const otherFolderNames = existingFolderNames.filter(
      n => n.toLowerCase() !== folder.name.toLowerCase()
    )
    if (otherFolderNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())) {
      return 'Ya existe una carpeta con este nombre'
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

  const planCount = folder.flightPlans.length

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      {/* Folder header */}
      <div
        className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
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
                  {loadingStates.renaming ? '...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={handleRenameCancel}
                  className="flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-500"
                >
                  Cancelar
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
                className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                title={folder.name}
                onClick={handleEditClick}
              >
                {folder.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {planCount} {planCount === 1 ? 'plan de vuelo' : 'planes de vuelo'}
              </p>
            </div>

            <button
              onClick={handleDeleteClick}
              disabled={loadingStates.deleting}
              className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Eliminar carpeta"
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
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50">
          <FlightPlanList
            plans={folder.flightPlans}
            onProcess={onProcessPlan}
            onDownload={onDownloadPlan}
            onAuthorize={onAuthorizePlan}
            onReset={onResetPlan}
            onDelete={onDeletePlan}
            loadingPlanIds={loadingPlanIds}
            emptyMessage="Esta carpeta está vacía"
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Eliminar carpeta"
        message={`¿Estás seguro de que quieres eliminar la carpeta "${folder.name}"? ${
          planCount > 0
            ? `Esta acción eliminará también ${planCount} ${planCount === 1 ? 'plan de vuelo' : 'planes de vuelo'}.`
            : ''
        } Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={loadingStates.deleting}
      />
    </div>
  )
}
