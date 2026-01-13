import React, { useState } from 'react'
import { FolderCard, type Folder, type FolderCardProps } from './FolderCard'
import { type FlightPlanListProps } from './FlightPlanList'

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
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Carpetas</h2>
        {onCreateFolder && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
          className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50"
        >
          <FolderPlusIcon />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nombre de la carpeta"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleCreateCancel()
              }
            }}
          />
          <button
            type="submit"
            disabled={!newFolderName.trim() || isCreating}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Creando...' : 'Crear'}
          </button>
          <button
            type="button"
            onClick={handleCreateCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Empty state */}
      {folders.length === 0 && !showCreateForm && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8">
          <FolderPlusIcon />
          <p className="text-sm text-gray-500 text-center">{emptyMessage}</p>
          {onCreateFolder && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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

            return (
              <FolderCard
                key={folder.id}
                folder={folder}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                onProcessPlan={onProcessPlan}
                onDownloadPlan={onDownloadPlan}
                onAuthorizePlan={onAuthorizePlan}
                onResetPlan={onResetPlan}
                onDeletePlan={onDeletePlan}
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
