'use client'

import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, CircleCheck, CircleDashed, CircleX, FileJson, FolderPlus, Hourglass, Loader2, Pencil, Search, ShieldCheck, ShieldX, Trash2, Undo2, type LucideIcon } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import type { FolderCounts } from '@/app/hooks/useFolders'
import { NO_FOLDER_KEY, SEARCH_KEY, type PlanPages } from '@/app/hooks/useFolderPlans'
import { ActionMenu, type MenuEntry } from './ActionMenu'
import { InlineNameForm } from './InlineNameForm'
import { PLAN_DRAG_TYPE, startPlanDrag, type PlanDragData, type PlanRow, type ProgressKind } from './lib'
import { NewFolderForm } from './NewFolderForm'
import { planStatusText } from './planStatus'

const ICONS: Record<ProgressKind | 'review', { Icon: LucideIcon; tone: string; spin?: boolean }> = {
  noFile: { Icon: CircleDashed, tone: 'text-muted' },
  step: { Icon: CircleDashed, tone: 'text-muted' },
  review: { Icon: CircleCheck, tone: 'text-success-text' },
  processing: { Icon: Loader2, tone: 'text-info-text', spin: true },
  authorizing: { Icon: Hourglass, tone: 'text-warning-text' },
  approved: { Icon: ShieldCheck, tone: 'text-success-text' },
  denied: { Icon: ShieldX, tone: 'text-danger-text' },
  withdrawn: { Icon: Undo2, tone: 'text-warning-text' },
  error: { Icon: CircleX, tone: 'text-danger-text' },
}

const SECONDARY =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover lg:min-h-9'
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function planDrag(e: DragEvent): PlanDragData | null {
  const raw = e.dataTransfer.getData(PLAN_DRAG_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PlanDragData
  } catch {
    return null
  }
}

/** Debounce of the server-side name search. */
const SEARCH_DELAY_MS = 300

interface Group {
  key: string
  folder: FolderCounts | null
  /** Plans of the group on the server. */
  count: number
}

interface Props {
  folders: FolderCounts[]
  /** Plans without folder. */
  noFolderCount: number
  /** Loaded pages of the groups on screen and the server-side search (useFolderPlans). */
  list: PlanPages
  selectedId: number | null
  /** Group of the selected plan: it stays open. */
  selectedKey: string | null
  onSelect: (id: number) => void
  onCreateFolder: (name: string) => Promise<boolean>
  onRenameFolder: (folder: FolderCounts, name: string) => Promise<boolean>
  onDeleteFolder: (folder: FolderCounts) => void
  /** Files chosen to import as external U-plans into a folder. */
  onImport: (files: File[], folderId: number) => void
  onMovePlan: (planId: number, folderId: number | null) => void
  /** Shown under the header when there are no plans at all (phones; desktop shows it in the workspace pane). */
  empty: ReactNode
}

/**
 * Production plan list: server-side search, folders as collapsible groups (a group loads its first page when it opens,
 * "Show more" appends the next one), plans without folder, one compact selectable row per plan.
 */
export function PlanList({ folders, noFolderCount, list, selectedId, selectedKey, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder, onImport, onMovePlan, empty }: Props) {
  const { t, language } = useI18n()
  const pa = t.planAuth
  const w = pa.workspace
  const [query, setQuery] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [renaming, setRenaming] = useState<number | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const headId = useId()
  const searchId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const importFolder = useRef<number | null>(null)
  const newInput = useRef<HTMLInputElement>(null)

  const hasPlans = folders.length > 0 || noFolderCount > 0
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = folders.map((f) => ({ key: String(f.id), folder: f, count: f.planCount }))
    if (noFolderCount > 0) out.push({ key: NO_FOLDER_KEY, folder: null, count: noFolderCount })
    return out
  }, [folders, noFolderCount])

  // The name search runs on the server, once typing pauses
  const { setQuery: runSearch } = list
  useEffect(() => {
    const id = setTimeout(() => runSearch(query), SEARCH_DELAY_MS)
    return () => clearTimeout(id)
  }, [query, runSearch])
  const search = list.search

  useEffect(() => {
    if (newOpen) newInput.current?.focus()
  }, [newOpen])

  // Keep the selected row visible in the (independently scrolling) list when it changes from outside
  useEffect(() => {
    if (selectedId !== null) document.querySelector(`[data-plan-row="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const pickImport = (folderId: number) => {
    importFolder.current = folderId
    fileInput.current?.click()
  }

  const existingNames = folders.map((f) => f.name)

  const planRows = (rows: PlanRow[]) => (
    <ul className="flex flex-col gap-0.5">
      {rows.map((plan) => {
        const status = planStatusText(plan, w, language)
        const { Icon, tone, spin } = ICONS[status.progress.kind === 'step' && status.progress.step === 4 ? 'review' : status.progress.kind]
        const isSelected = plan.id === selectedId
        return (
          <li key={plan.id} draggable onDragStart={(e) => startPlanDrag(e, plan)}>
            <button
              type="button"
              data-plan-row={plan.id}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onSelect(plan.id)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-left ${isSelected ? 'border-brand bg-subtle' : 'border-transparent hover:bg-hover'}`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${tone} ${spin ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{plan.customName}</span>
                <span className="block truncate text-xs text-fg-2">{status.line}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  /** Rows of a group + its "Show more (N left)". */
  const pageOf = (key: string, rows: PlanRow[]) => {
    const left = (list.totalOf(key) ?? 0) - list.loadedOf(key)
    return (
      <>
        {planRows(rows)}
        {left > 0 && (
          <button type="button" onClick={() => list.more(key)} className={`${SECONDARY} mt-1 w-full justify-center`}>
            {interpolate(w.showMore, { n: left })}
          </button>
        )}
      </>
    )
  }
  const loadingText = (
    <p role="status" className="px-2 py-2 text-sm text-fg-2">
      {w.loadingPlans}
    </p>
  )

  const searchRows = search ? list.rowsOf(SEARCH_KEY) : []
  const searchTotal = list.totalOf(SEARCH_KEY)

  return (
    <section aria-labelledby={headId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headId} data-plan-list-heading tabIndex={-1} className="text-lg font-semibold text-fg outline-none">
          {w.yourPlans}
        </h2>
        <button type="button" aria-expanded={newOpen} onClick={() => setNewOpen((o) => !o)} className={SECONDARY}>
          <FolderPlus className="h-4 w-4" aria-hidden="true" />
          {pa.folders.newFolder}
        </button>
      </div>

      {newOpen && (
        <NewFolderForm
          existing={existingNames}
          inputRef={newInput}
          onCreate={async (name) => {
            const ok = await onCreateFolder(name)
            if (ok) setNewOpen(false)
            return ok
          }}
        />
      )}

      {hasPlans && (
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {w.searchLabel}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder={w.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-input pl-9 pr-3 text-base text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-ring sm:text-sm lg:min-h-10"
          />
        </div>
      )}

      {!hasPlans && <div className="lg:hidden">{empty}</div>}

      {search ? (
        <div role="region" aria-label={w.searchResults} className="rounded-lg border border-line bg-surface px-1 pb-1">
          <p className="flex min-h-11 items-center justify-between gap-2 px-3 text-sm font-semibold text-fg">
            <span>{w.searchResults}</span>
            <span className="text-xs tabular-nums text-fg-2">{searchTotal}</span>
          </p>
          {searchRows.length > 0 ? (
            pageOf(SEARCH_KEY, searchRows)
          ) : searchTotal === undefined ? (
            loadingText
          ) : (
            <p role="status" className="px-2 py-2 text-sm text-fg-2">
              {interpolate(w.noMatches, { q: search.text })}
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
          const forced = g.key === selectedKey // the group of the selected plan stays open
          const open = forced || list.openKeys.has(g.key)
          const rows = open ? list.rowsOf(g.key) : []
          const name = g.folder ? g.folder.name : pa.folders.noFolder
          const bodyId = `${headId}-${g.key}`
          const head = (
            <>
              <ChevronDown className={`h-4 w-4 shrink-0 text-fg-2 transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{name}</span>
              <span className="text-xs tabular-nums text-fg-2">
                <span className="sr-only">{interpolate(pa.folders.plansCount, { n: g.count })}</span>
                <span aria-hidden="true">{g.count}</span>
              </span>
            </>
          )
          const HEAD = 'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left'
          const folder = g.folder
          const entries: MenuEntry[] = folder
            ? [
                { id: 'import', label: pa.upload.importUplan, icon: FileJson, onSelect: () => pickImport(folder.id) },
                { id: 'rename', label: pa.folders.menu.rename, icon: Pencil, onSelect: () => setRenaming(folder.id) },
                { id: 'delete', label: pa.folders.menu.delete, icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => onDeleteFolder(folder) },
              ]
            : []

          return (
            <li
              key={g.key}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setOver(g.key)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null)
                const drag = planDrag(e)
                if (!drag) return
                e.preventDefault()
                const target = g.folder ? g.folder.id : null
                if (drag.sourceFolderId !== target) onMovePlan(drag.planId, target)
              }}
              className={`rounded-lg border ${over === g.key ? 'border-brand-ring bg-info-soft' : 'border-line bg-surface'}`}
            >
              {folder && renaming === folder.id ? (
                <div className="p-2">
                  <InlineNameForm
                    initial={folder.name}
                    label={pa.folders.nameLabel}
                    validate={(n) => (!n ? pa.folders.nameEmpty : existingNames.some((x) => x !== folder.name && sameName(x, n)) ? pa.folders.nameExists : null)}
                    onSubmit={(n) => onRenameFolder(folder, n)}
                    onClose={() => setRenaming(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center">
                  {forced ? (
                    <div className={HEAD}>{head}</div>
                  ) : (
                    <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => list.toggle(g.key)} className={`${HEAD} hover:bg-hover`}>
                      {head}
                    </button>
                  )}
                  {folder && <ActionMenu label={interpolate(pa.folders.menuFor, { name: folder.name })} entries={entries} touch />}
                </div>
              )}

              {open && (
                <div id={bodyId} className="px-1 pb-1">
                  {rows.length > 0 ? (
                    pageOf(g.key, rows)
                  ) : list.totalOf(g.key) === undefined ? (
                    loadingText
                  ) : (
                    folder && (
                      <div className="px-2 pb-2 pt-1">
                        <p className="text-sm text-fg-2">{w.emptyFolder}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href="/plan-definition" className={SECONDARY}>
                            {w.createPlan}
                          </Link>
                          <button type="button" className={SECONDARY} onClick={() => pickImport(folder.id)}>
                            <FileJson className="h-4 w-4" aria-hidden="true" />
                            {pa.upload.importUplan}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-label={pa.upload.uplanInput}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = '' // the same file can be chosen again
          const id = importFolder.current
          if (files.length && id !== null) onImport(files, id)
        }}
      />
    </section>
  )
}
