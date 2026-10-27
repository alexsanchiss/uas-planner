'use client'

import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'

interface IndicatorProps {
  lastSyncedAt: Date | null
  isSyncing: boolean
  failed: boolean
  onRefresh: () => void
}

/** "Synced hh:mm:ss" / "Syncing..." with a manual refresh button (announced politely). */
export function SyncIndicator({ lastSyncedAt, isSyncing, failed, onRefresh }: IndicatorProps) {
  const { t, language } = useI18n()
  const pa = t.planAuth.sync
  const time = lastSyncedAt?.toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-GB')
  return (
    <div className="flex items-center gap-2 text-sm text-fg-2">
      <span role="status" aria-live="polite" className="flex items-center gap-1.5">
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {pa.syncing}
          </>
        ) : failed ? (
          <>
            <TriangleAlert className="h-4 w-4 text-warning-text" aria-hidden="true" />
            {pa.failed}
          </>
        ) : time ? (
          interpolate(pa.synced, { time })
        ) : null}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isSyncing}
        aria-label={pa.refresh}
        title={pa.refresh}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg disabled:opacity-50 lg:h-9 lg:w-9"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Shown after repeated sync errors: polling stopped until the user retries. */
export function SyncPausedBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  const pa = t.planAuth.sync
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-line bg-warning-soft p-4">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-warning-text">{pa.pausedTitle}</p>
          <p className="text-sm text-fg-2">{pa.pausedBody}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-9 rounded-md bg-warning px-3 text-sm font-medium text-warning-fg hover:bg-warning-hover"
      >
        {pa.retry}
      </button>
    </div>
  )
}
