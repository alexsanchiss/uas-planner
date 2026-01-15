import React, { useState, DragEvent } from 'react'
import { FolderCard, type Folder, type FolderCardProps } from './FolderCard'
import { type FlightPlanListProps } from './FlightPlanList'
import { type FlightPlanDragData } from './FlightPlanCard'

export interface FolderListProps {
  folders: Folder[]
  onCreateFolder?: (name: string) => void
  onRenameFolder?: (folderId: string, newName: string) => void
  onDeleteFolder?: (folderId: string) => void
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
  /** TASK-222: Called when a plan is dropped onto a folder */
  onDropPlan?: (planId: string, targetFolderId: string | null) => void
  loadingPlanIds?: FlightPlanListProps['loadingPlanIds']
  loadingFolderIds?: {
    renaming?: Set<string>
    deleting?: Set<string>
  }
  isCreating?: boolean
  emptyMessage?: string
  className?: string
}

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function FolderPlusIcon() {
  return (
    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  )
}

export function FolderList({
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
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
  loadingPlanIds,
  loadingFolderIds = {},
  isCreating = false,
  emptyMessage = 'No hay carpetas. Cree una carpeta para organizar sus planes de vuelo.',
  className = '',
}: FolderListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newFolderName.trim()) {
      onCreateFolder?.(newFolderName.trim())
      setNewFolderName('')
      setShowCreateForm(false)
    }
  }

  const handleCreateCancel = () => {
    setNewFolderName('')
    setShowCreateForm(false)
  }

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${className}`}>
      {/* Header with create button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Carpetas</h2>
        {onCreateFolder && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors w-full sm:w-auto"
          >
            <PlusIcon />
            Nueva carpeta
          </button>
        )}
      </div>

      {/* Create folder form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30"
        >
          <div className="flex items-center gap-2 flex-1">
            <FolderPlusIcon />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              className="flex-1 px-3 py-2 sm:py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCreateCancel()
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newFolderName.trim() || isCreating}
              className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Creando...' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={handleCreateCancel}
              className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {folders.length === 0 && !showCreateForm && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 sm:p-8">
          <FolderPlusIcon />
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">{emptyMessage}</p>
          {onCreateFolder && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <PlusIcon />
              Crear carpeta
            </button>
          )}
        </div>
      )}

      {/* Folders list */}
      {folders.length > 0 && (
        <div className="flex flex-col gap-3">
          {folders.map((folder) => {
            const folderLoadingStates: FolderCardProps['loadingStates'] = {
              renaming: loadingFolderIds.renaming?.has(folder.id),
              deleting: loadingFolderIds.deleting?.has(folder.id),
            }

            // Get all folder names for uniqueness validation
            const existingFolderNames = folders.map(f => f.name)

            return (
              <FolderCard
                key={folder.id}
                folder={folder}
                existingFolderNames={existingFolderNames}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                onProcessPlan={onProcessPlan}
                onDownloadPlan={onDownloadPlan}
                onAuthorizePlan={onAuthorizePlan}
                onResetPlan={onResetPlan}
                onDeletePlan={onDeletePlan}
                onSelectPlan={onSelectPlan}
                selectedPlanId={selectedPlanId}
                onRenamePlan={onRenamePlan}
                draggable={draggable}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDropPlan={onDropPlan}
                loadingPlanIds={loadingPlanIds}
                loadingStates={folderLoadingStates}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
