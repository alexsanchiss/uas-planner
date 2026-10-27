/**
 * useFolderPlans - the plans of an account that has too many to load at once (production plan list).
 *
 * Instead of GET /api/flightPlans?fields=summary (every plan) it loads, with the paging of that route
 * (`limit` / `offset` / `folderId` / `q`), only what is on screen:
 *   - one group per expanded folder (`folderKey(id)`) or for the plans without folder (`'none'`):
 *     the first PLANS_PER_PAGE rows, `more(key)` appends the next page;
 *   - while a name search is active, the matches across folders (`SEARCH_KEY`) instead of the folder groups;
 *   - the selected plan, from GET /api/flightPlans/[id], when no loaded page has it (?selectPlan=<id> to a plan
 *     that is not in a page). Its group is opened too, so its row is in the list.
 * Every refresh (adaptive poll, after a mutation, `reload`) re-reads exactly those pages (the first `want` rows of
 * each, in chunks of 100) and publishes the union as `fp.flightPlans`. `fp` is a normal useFlightPlans (same
 * optimistic updates, adaptive 3 s / 15 s polling, pause while the tab is hidden), so usePlanActions /
 * useGroupActions work on it unchanged; the mutations that change a folder count also call `onCountsStale`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, apiJson } from '@/lib/api-client'
import { useFlightPlans, type FlightPlan, type FlightPlanSummary, type UseFlightPlansReturn } from './useFlightPlans'

/** Rows per page of a group (the old Dev uploader's PLANS_PER_FOLDER_PAGE). */
export const PLANS_PER_PAGE = 25
/** Server cap of `limit`. */
const MAX_LIMIT = 100
export const NO_FOLDER_KEY = 'none'
export const SEARCH_KEY = 'q'
/** Group key of a plan's folder: the folder id, or 'none'. */
export const folderKey = (folderId: number | null): string => (folderId === null ? NO_FOLDER_KEY : String(folderId))

interface PageResponse {
  items: FlightPlanSummary[]
  total: number
}
interface Page {
  ids: number[]
  total: number
}

function pageUrl(key: string, query: string, offset: number, limit: number): string {
  const p = new URLSearchParams({ fields: 'summary', limit: String(limit), offset: String(offset) })
  if (key === SEARCH_KEY) p.set('q', query)
  else p.set('folderId', key)
  return `/api/flightPlans?${p}`
}

/** The first `n` rows of a group, in chunks of the server's `limit` cap. */
async function fetchPage(key: string, query: string, n: number): Promise<PageResponse> {
  const items: FlightPlanSummary[] = []
  let total = 0
  for (let offset = 0; offset < n; offset += MAX_LIMIT) {
    const limit = Math.min(MAX_LIMIT, n - offset)
    const res = await apiJson<PageResponse>(pageUrl(key, query, offset, limit))
    items.push(...res.items)
    total = res.total
    if (res.items.length < limit) break
  }
  return { items, total }
}

/** Row of GET /api/flightPlans/[id] as a summary row: the heavy text is dropped right away. */
function toSummary(d: FlightPlan & { activationMessage?: unknown }): FlightPlanSummary {
  const { fileContent, uplan, activationMessage, ...rest } = d
  void activationMessage
  return { ...rest, hasFileContent: fileContent != null, hasUplan: uplan != null }
}

interface Options {
  /** Selected plan (?selectPlan=): always part of the list, whatever page it is on. */
  selectedId: number | null
  /** Called after a mutation that changes a folder's plan count (delete, move, import, create). */
  onCountsStale?: () => void
}

export function useFolderPlans({ selectedId, onCountsStale }: Options) {
  const want = useRef(new Map<string, number>()) // group key -> rows wanted
  const query = useRef('')
  const version = useRef(0) // bumped when `want` / `query` change while a load may be running
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const staleRef = useRef(onCountsStale)
  staleRef.current = onCountsStale

  const [pages, setPages] = useState<Record<string, Page>>({})
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [missingId, setMissingId] = useState<number | null>(null)

  const syncOpen = () => setOpenKeys(new Set([...want.current.keys()].filter((k) => k !== SEARCH_KEY)))

  /** Everything on screen, fresh. Repeats when the groups changed while it was running. */
  const loadAll = useCallback(async (): Promise<FlightPlanSummary[]> => {
    let rows: Map<number, FlightPlanSummary>
    let fresh: Record<string, Page>
    let missing: number | null
    let v: number
    do {
      v = version.current
      rows = new Map()
      fresh = {}
      missing = null
      const active = [...want.current].filter(([k]) => (query.current ? k === SEARCH_KEY : k !== SEARCH_KEY))
      await Promise.all(
        active.map(async ([key, n]) => {
          try {
            const { items, total } = await fetchPage(key, query.current, n)
            items.forEach((r) => rows.set(r.id, r))
            fresh[key] = { ids: items.map((r) => r.id), total }
          } catch (e) {
            if (e instanceof ApiError && e.status === 404 && key !== SEARCH_KEY) want.current.delete(key) // folder deleted
            else throw e
          }
        })
      )
      const id = selectedRef.current
      if (id !== null && !rows.has(id)) {
        // ponytail: the detail route returns the full row (fileContent / uplan), dropped here; only hit while the selected
        // plan is on no loaded page. A `fields=summary` on that route would make this poll light.
        try {
          rows.set(id, toSummary(await apiJson<FlightPlan>(`/api/flightPlans/${id}`)))
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 403)) missing = id
          else throw e
        }
      }
      const sel = id !== null ? rows.get(id) : undefined
      if (sel && !want.current.has(folderKey(sel.folderId))) {
        want.current.set(folderKey(sel.folderId), PLANS_PER_PAGE) // the selected plan's group is open
        version.current++
      }
    } while (v !== version.current)

    setMissingId(missing)
    setPages((prev) => {
      const next: Record<string, Page> = {}
      for (const k of want.current.keys()) {
        const p = fresh[k] ?? prev[k] // keeps the folder pages while a search hides them
        if (p) next[k] = p
      }
      return next
    })
    syncOpen()
    return [...rows.values()]
  }, [])

  const base = useFlightPlans({ summary: true, fetcher: loadAll })
  const refreshRef = useRef(base.refresh)
  refreshRef.current = base.refresh
  const planIds = useRef<Set<number>>(new Set())
  planIds.current = new Set(base.flightPlans.map((p) => p.id))

  const reload = useCallback(() => {
    version.current++
    return refreshRef.current()
  }, [])

  // A plan selected from outside the loaded pages (URL, default selection) is fetched right away
  const handledSelection = useRef(selectedId)
  useEffect(() => {
    if (selectedId === handledSelection.current) return
    handledSelection.current = selectedId
    if (selectedId !== null && !planIds.current.has(selectedId)) void reload()
  }, [selectedId, reload])

  const open = useCallback(
    (key: string) => {
      if (want.current.has(key)) return
      want.current.set(key, PLANS_PER_PAGE)
      syncOpen()
      void reload()
    },
    [reload]
  )
  const close = useCallback((key: string) => {
    if (!want.current.delete(key)) return
    syncOpen()
    setPages((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)))
  }, [])
  const toggle = useCallback((key: string) => (want.current.has(key) ? close(key) : open(key)), [open, close])
  /** Appends the next page of a group (or of the search results). */
  const more = useCallback(
    (key: string) => {
      want.current.set(key, (want.current.get(key) ?? 0) + PLANS_PER_PAGE)
      void reload()
    },
    [reload]
  )
  /** Server-side name search ('' = off). The caller debounces. */
  const setQuery = useCallback(
    (text: string) => {
      const q = text.trim()
      if (q === query.current) return
      query.current = q
      setSearchText(q)
      if (q) want.current.set(SEARCH_KEY, PLANS_PER_PAGE)
      else want.current.delete(SEARCH_KEY)
      void reload()
    },
    [reload]
  )

  /** Ids of the approved plans of a folder (what a folder delete must cancel at FAS first), all pages. */
  const approvedIdsOf = useCallback(async (folderId: number): Promise<number[]> => {
    const ids: number[] = []
    for (let offset = 0; ; offset += MAX_LIMIT) {
      const res = await apiJson<PageResponse>(
        `/api/flightPlans?fields=summary&limit=${MAX_LIMIT}&offset=${offset}&folderId=${folderId}&authorizationStatus=aprobado`
      )
      ids.push(...res.items.map((p) => p.id))
      if (res.items.length < MAX_LIMIT) return ids
    }
  }, [])

  const byId = useMemo(() => new Map(base.flightPlans.map((p) => [p.id, p])), [base.flightPlans])
  const rowsOf = (key: string): FlightPlanSummary[] =>
    (pages[key]?.ids ?? []).map((id) => byId.get(id)).filter((p): p is FlightPlanSummary => !!p)

  // The mutations that change a folder's count refresh the counts too (the folder hook refreshes its own)
  const counted =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      const res = await fn(...a)
      staleRef.current?.()
      return res
    }
  const fp: UseFlightPlansReturn<FlightPlanSummary> = {
    ...base,
    createFlightPlan: counted(base.createFlightPlan),
    createFlightPlans: counted(base.createFlightPlans),
    deleteFlightPlan: counted(base.deleteFlightPlan),
    deleteFlightPlans: counted(base.deleteFlightPlans),
    moveFlightPlan: counted(base.moveFlightPlan),
    importExternalUplan: counted(base.importExternalUplan),
  }

  return {
    /** useFlightPlans over the pages on screen: `flightPlans` = loaded rows (+ the selected plan). */
    fp,
    /** Expanded groups (folder keys and 'none'). */
    openKeys,
    /** Loaded rows of a group, newest first. */
    rowsOf,
    /** Plans of the group on the server (undefined until its first page arrives: the group is loading). */
    totalOf: (key: string): number | undefined => pages[key]?.total,
    open,
    close,
    toggle,
    more,
    /** Active name search (trimmed text) or null. */
    search: searchText ? { text: searchText } : null,
    setQuery,
    /** The selected plan does not exist (deleted, stale link, not the caller's). */
    selectedMissing: selectedId !== null && missingId === selectedId,
    approvedIdsOf,
  }
}

export type FolderPlans = ReturnType<typeof useFolderPlans>

/** What the plan list needs from the hook. */
export type PlanPages = Pick<FolderPlans, 'openKeys' | 'rowsOf' | 'toggle' | 'more' | 'search' | 'setQuery' | 'totalOf'>
