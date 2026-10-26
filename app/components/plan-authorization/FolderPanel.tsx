'use client'

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type DragEvent } from 'react'
import { Check, ChevronDown, CircleCheck, CircleDashed, CircleX, Clock, Copy, Download, Eye, Folder, FolderOpen, Loader2, Pencil, Play, Plus, Trash2, X, type LucideIcon } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import type { FolderSummary } from '@/app/hooks/useFolders'
import { ActionMenu, type MenuEntry } from './ActionMenu'
import { PLAN_DRAG_TYPE, type Mode, type PlanDragData } from './lib'

export type FolderView = number | 'none'

export interface FolderPanelHandle {
  /** Focus the "new folder" input (opens the list on phones). */
  focusNew: () => void
}

export type FolderStatusCounts = Record<'unprocessed' | 'queued' | 'processing' | 'processed' | 'error', number>

const COUNTER_ICONS: [keyof FolderStatusCounts, LucideIcon][] = [
  ['unprocessed', CircleDashed],
  ['queued', Clock],
  ['processing', Loader2],
  ['processed', CircleCheck],
  ['error', CircleX],
]

interface Props {
  mode: Mode
  folders: FolderSummary[]
  /** Plans per folder (after the status filter). */
  counts: Record<number, number>
  noFolderCount: number
  /** Dev: per-status counters of each folder. */
  statusCounts: Record<number, FolderStatusCounts>
  selected: FolderView | null
  onSelect: (view: FolderView) => void
  onCreate: (name: string) => Promise<boolean>
  onRename: (folder: FolderSummary, name: string) => Promise<boolean>
  onDelete: (folder: FolderSummary) => void
  onDropPlan: (planId: number, folderId: number | null) => void
  onDropFiles: (files: File[], folderId: number) => void
  onClone: (folder: FolderSummary) => void
  onProcess: (folder: FolderSummary) => void
  onViewProcessed: (folder: FolderSummary) => void
  onDownloadCsvs: (folder: FolderSummary) => void
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Reads a plan drag payload; null when the drag is not a plan. */
function planDrag(e: DragEvent): PlanDragData | null {
  const raw = e.dataTransfer.getData(PLAN_DRAG_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PlanDragData
  } catch {
    return null
  }
}

interface ItemProps extends Omit<Props, 'folders' | 'counts' | 'statusCounts' | 'onCreate' | 'noFolderCount'> {
  folder: FolderSummary
  count: number
  statuses: FolderStatusCounts | undefined
  existing: string[]
}

function FolderItem({ folder, count, statuses, existing, mode, selected, onSelect, onRename, onDelete, onDropPlan, onDropFiles, onClone, onProcess, onViewProcessed, onDownloadCsvs }: ItemProps) {
  const { t } = useI18n()
  const pa = t.planAuth.folders
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(folder.name)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const errId = useId()

  useEffect(() => {
    if (editing) {
      setDraft(folder.name)
      setError('')
      input.current?.focus()
      input.current?.select()
    }
  }, [editing, folder.name])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return setError(pa.nameEmpty)
    if (name === folder.name) return setEditing(false)
    if (existing.some((n) => sameName(n, name))) return setError(pa.nameExists)
    if (await onRename(folder, name)) setEditing(false)
  }

  const entries: MenuEntry[] = [{ id: 'rename', label: pa.menu.rename, icon: Pencil, onSelect: () => setEditing(true) }]
  if (mode === 'dev') {
    entries.push(
      { id: 'process', label: pa.menu.processAll, icon: Play, onSelect: () => onProcess(folder) },
      { id: 'view', label: pa.menu.viewProcessed, icon: Eye, onSelect: () => onViewProcessed(folder) },
      { id: 'csv', label: pa.menu.downloadCsvs, icon: Download, onSelect: () => onDownloadCsvs(folder) },
      { id: 'clone', label: pa.menu.clone, icon: Copy, onSelect: () => onClone(folder) }
    )
  }
  entries.push({ id: 'delete', label: pa.menu.delete, icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => onDelete(folder) })

  const isSelected = selected === folder.id
  const Icon = isSelected ? FolderOpen : Folder

  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(PLAN_DRAG_TYPE) || e.dataTransfer.types.includes('Files')

  return (
    <li
      onDragOver={(e) => {
        if (!accepts(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes(PLAN_DRAG_TYPE) ? 'move' : 'copy'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        if (!accepts(e)) return
        e.preventDefault()
        const drag = planDrag(e)
        if (drag) {
          if (drag.sourceFolderId !== folder.id) onDropPlan(drag.planId, folder.id)
          return
        }
        const files = Array.from(e.dataTransfer.files)
        if (files.length) {
          onSelect(folder.id)
          onDropFiles(files, folder.id)
        }
      }}
      className={`rounded-lg border ${over ? 'border-brand-ring bg-info-soft' : isSelected ? 'border-line-2 bg-subtle' : 'border-transparent hover:bg-hover'}`}
    >
      {editing ? (
        <form onSubmit={submit} className="p-2">
          <div className="flex items-center gap-1">
            <input
              ref={input}
              value={draft}
              aria-label={pa.nameLabel}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              onChange={(e) => {
                setDraft(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false)
              }}
              className="min-w-0 flex-1 rounded-md border border-input bg-input px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring"
            />
            <button type="submit" aria-label={t.common.save} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover">
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={t.common.cancel} onClick={() => setEditing(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {error && (
            <p id={errId} role="alert" className="mt-1 text-xs text-danger-text">
              {error}
            </p>
          )}
        </form>
      ) : (
        <div className="flex items-center">
          <button
            type="button"
            aria-current={isSelected ? 'true' : undefined}
            onClick={() => onSelect(folder.id)}
            className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-fg-2" aria-hidden="true" />
              <span className={`min-w-0 flex-1 truncate text-sm ${isSelected ? 'font-semibold text-fg' : 'text-fg'}`}>{folder.name}</span>
              <span className="text-xs tabular-nums text-fg-2">
                <span className="sr-only">{interpolate(pa.plansCount, { n: count })}</span>
                <span aria-hidden="true">{count}</span>
              </span>
            </span>
            {mode === 'dev' && statuses && (
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-6 text-xs text-fg-2">
                {COUNTER_ICONS.filter(([k]) => statuses[k] > 0).map(([k, CounterIcon]) => (
                  <span key={k} className="inline-flex items-center gap-1" title={t.planAuth.filters[k]}>
                    <CounterIcon className="h-3 w-3" aria-hidden="true" />
                    <span className="tabular-nums">{statuses[k]}</span>
                    <span className="sr-only">{t.planAuth.filters[k]}</span>
                  </span>
                ))}
              </span>
            )}
          </button>
          <ActionMenu label={interpolate(pa.menuFor, { name: folder.name })} entries={entries} />
        </div>
      )}
    </li>
  )
}

/** Folder list (left column >= lg, collapsible section on phones): create, select, rename, menu, drop targets. */
export const FolderPanel = forwardRef<FolderPanelHandle, Props>(function FolderPanel(props, ref) {
  const { t } = useI18n()
  const pa = t.planAuth.folders
  const { folders, counts, noFolderCount, statusCounts, selected, onSelect, onCreate, onDropPlan, mode } = props
  const [open, setOpen] = useState(false)
  const newInput = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => ({
    focusNew: () => {
      setOpen(true) // the list is collapsed on phones
      requestAnimationFrame(() => newInput.current?.focus())
    },
  }))
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [overNone, setOverNone] = useState(false)
  const listId = useId()
  const errId = useId()

  // Show the "without folder" target while a plan is being dragged
  useEffect(() => {
    const start = (e: globalThis.DragEvent) => setDragging(!!e.dataTransfer?.types.includes(PLAN_DRAG_TYPE))
    const end = () => setDragging(false)
    window.addEventListener('dragstart', start)
    window.addEventListener('dragend', end)
    return () => {
      window.removeEventListener('dragstart', start)
      window.removeEventListener('dragend', end)
    }
  }, [])

  const existing = folders.map((f) => f.name)
  const current = selected === 'none' ? pa.noFolder : folders.find((f) => f.id === selected)?.name ?? pa.heading

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return setError(pa.nameEmpty)
    if (existing.some((n) => sameName(n, value))) return setError(pa.nameExists)
    setCreating(true)
    const ok = await onCreate(value)
    setCreating(false)
    if (ok) setName('')
  }

  const showNone = noFolderCount > 0 || dragging || selected === 'none'

  return (
    <section aria-label={pa.heading} className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm font-semibold text-fg lg:hidden"
      >
        <span className="truncate">
          {pa.heading}: {current}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={listId} className={`${open ? 'block' : 'hidden'} p-3 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto`}>
        <h2 className="mb-2 hidden px-1 text-sm font-semibold text-fg lg:block">{pa.heading}</h2>
        <form onSubmit={create} className="mb-3">
          <label htmlFor={`${listId}-new`} className="mb-1 block text-xs font-medium text-fg-2">
            {pa.newFolder}
          </label>
          <div className="flex gap-1">
            <input
              id={`${listId}-new`}
              ref={newInput}
              value={name}
              placeholder={pa.newFolderPlaceholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              className="min-w-0 flex-1 rounded-md border border-input bg-input px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-ring"
            />
            <button
              type="submit"
              disabled={creating}
              aria-label={pa.create}
              title={pa.create}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg hover:bg-brand-hover disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          {error && (
            <p id={errId} role="alert" className="mt-1 text-xs text-danger-text">
              {error}
            </p>
          )}
        </form>

        <ul className="flex flex-col gap-1">
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              {...props}
              folder={folder}
              count={counts[folder.id] ?? 0}
              statuses={mode === 'dev' ? statusCounts[folder.id] : undefined}
              existing={existing.filter((n) => n !== folder.name)}
              onSelect={(v) => {
                onSelect(v)
                setOpen(false)
              }}
            />
          ))}
          {showNone && (
            <li
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setOverNone(true)
              }}
              onDragLeave={() => setOverNone(false)}
              onDrop={(e) => {
                setOverNone(false)
                const drag = planDrag(e)
                if (!drag) return
                e.preventDefault()
                if (drag.sourceFolderId !== null) onDropPlan(drag.planId, null)
              }}
              className={`rounded-lg border ${overNone ? 'border-brand-ring bg-info-soft' : selected === 'none' ? 'border-line-2 bg-subtle' : 'border-transparent hover:bg-hover'}`}
            >
              <button
                type="button"
                aria-current={selected === 'none' ? 'true' : undefined}
                onClick={() => {
                  onSelect('none')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left"
              >
                <Folder className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{pa.noFolder}</span>
                <span className="text-xs tabular-nums text-fg-2">{noFolderCount}</span>
              </button>
              {dragging && <p className="px-3 pb-2 text-xs text-info-text">{pa.dropToRemove}</p>}
            </li>
          )}
        </ul>
      </div>
    </section>
  )
})
