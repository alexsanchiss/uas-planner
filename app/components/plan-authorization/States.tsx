'use client'

import type { ReactNode } from 'react'
import { TriangleAlert, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/app/i18n'

/** Dev loading placeholder with the shape of the final layout (folder column + table rows). */
export function PlanAuthSkeleton() {
  const { t } = useI18n()
  const bar = 'animate-pulse rounded-md bg-subtle motion-reduce:animate-none'
  return (
    <div role="status" aria-busy="true" aria-label={t.planAuth.states.loading} className="grid min-h-[40dvh] gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
        <div className={`${bar} h-10`} />
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${bar} h-10`} />
        ))}
      </div>
      <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${bar} h-12`} />
        ))}
      </div>
      <span className="sr-only">{t.planAuth.states.loading}</span>
    </div>
  )
}

/** Production loading placeholder: the plan list column and the workspace (desktop only). */
export function PlanListSkeleton() {
  const { t } = useI18n()
  const bar = 'animate-pulse rounded-md bg-subtle motion-reduce:animate-none'
  return (
    <div role="status" aria-busy="true" aria-label={t.planAuth.states.loading} className="grid min-h-[40dvh] gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className={`${bar} h-11`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${bar} h-14`} />
        ))}
      </div>
      <div className="hidden space-y-4 lg:block">
        <div className={`${bar} h-8 w-1/2`} />
        <div className={`${bar} h-10`} />
        <div className={`${bar} h-40`} />
      </div>
      <span className="sr-only">{t.planAuth.states.loading}</span>
    </div>
  )
}

interface MessageProps {
  icon: LucideIcon
  title: string
  body?: string
  tone?: 'neutral' | 'danger'
  children?: ReactNode
}

/** Empty / error block: icon, title, one line of help and an action. */
export function StateMessage({ icon: Icon, title, body, tone = 'neutral', children }: MessageProps) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
      <Icon className={`h-8 w-8 ${tone === 'danger' ? 'text-danger-text' : 'text-muted'}`} aria-hidden="true" />
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {body && <p className="max-w-md text-sm text-fg-2">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

/** Load failure with Retry. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  const pa = t.planAuth.states
  return (
    <StateMessage icon={TriangleAlert} tone="danger" title={pa.loadErrorTitle} body={pa.loadErrorBody}>
      <button type="button" onClick={onRetry} className="min-h-10 rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-hover">
        {t.planAuth.sync.retry}
      </button>
    </StateMessage>
  )
}
