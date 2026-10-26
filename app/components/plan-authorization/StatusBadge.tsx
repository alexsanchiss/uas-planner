'use client'

import { CircleCheck, CircleDashed, CircleX, Clock, Hourglass, Loader2, ShieldCheck, ShieldOff, ShieldX, Undo2, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import type { AuthPhase, PlanPhase } from './lib'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONE: Record<Tone, string> = {
  neutral: 'border-line bg-subtle text-fg-2',
  success: 'border-success-line bg-success-soft text-success-text',
  warning: 'border-warning-line bg-warning-soft text-warning-text',
  danger: 'border-danger-line bg-danger-soft text-danger-text',
  info: 'border-info-line bg-info-soft text-info-text',
}

const PLAN: Record<PlanPhase, { tone: Tone; Icon: LucideIcon; spin?: boolean }> = {
  idle: { tone: 'neutral', Icon: CircleDashed },
  queued: { tone: 'warning', Icon: Clock },
  processing: { tone: 'info', Icon: Loader2, spin: true },
  done: { tone: 'success', Icon: CircleCheck },
  error: { tone: 'danger', Icon: CircleX },
}

const AUTH: Record<AuthPhase, { tone: Tone; Icon: LucideIcon; spin?: boolean }> = {
  none: { tone: 'neutral', Icon: ShieldOff },
  pending: { tone: 'warning', Icon: Hourglass },
  approved: { tone: 'success', Icon: ShieldCheck },
  denied: { tone: 'danger', Icon: ShieldX },
  withdrawn: { tone: 'warning', Icon: Undo2 },
}

function Badge({ tone, Icon, spin, label, kind }: { tone: Tone; Icon: LucideIcon; spin?: boolean; label: string; kind: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
      title={`${kind}: ${label}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${spin ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Plan processing status: icon + text (never colour alone). */
export function PlanStatusBadge({ phase }: { phase: PlanPhase }) {
  const { t } = useI18n()
  return <Badge {...PLAN[phase]} label={t.planAuth.status.plan[phase]} kind={t.planAuth.status.planKind} />
}

/** FAS authorization status: icon + text. */
export function AuthStatusBadge({ phase }: { phase: AuthPhase }) {
  const { t } = useI18n()
  return <Badge {...AUTH[phase]} label={t.planAuth.status.auth[phase]} kind={t.planAuth.status.authKind} />
}
