'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { interpolate, useI18n } from '@/app/i18n'
import { Modal } from '@/app/components/ui/modal'
import { getAuthToken } from '@/lib/api-client'
import type { Preset } from '@/app/components/plan-viewer/viewerStyle'
import type { ViewerDetail } from '@/app/components/plan-viewer/PlanViewer'
import type { TrajectoryRow } from './files'
import type { AuthPhase, PlanPhase, UplanData } from './lib'

// Heavy viewers (Leaflet / Cesium) load on demand and never during SSR.
const PlanViewer = dynamic(() => import('@/app/components/plan-viewer/PlanViewer'), { ssr: false })
const UplanFormModal = dynamic(() => import('@/app/components/flight-plans/UplanFormModal'), { ssr: false })
const MapModal = dynamic(() => import('@/app/components/MapModal'), { ssr: false })
const BulkUplanViewModal = dynamic(() => import('@/app/components/BulkUplanViewModal'), { ssr: false })

export type ViewerState =
  | { kind: 'planViewer'; preset: Preset; planId: number; planName: string; plan: PlanPhase; auth: AuthPhase; detail: ViewerDetail }
  | {
      kind: 'uplanForm'
      planId: number
      planName: string
      uplan: unknown
      hasBeenProcessed: boolean
      hasCsvResult: boolean
      hasScheduledAt: boolean
      missingFields?: string[]
      fieldErrors?: Record<string, string>
    }
  | { kind: 'multiTrajectory'; title: string; trajectories: TrajectoryRow[][]; names: string[] }
  | { kind: 'bulkUplans'; uplans: UplanData[]; names: string[] }
  | { kind: 'bulkErrors'; errors: { name: string; message: unknown }[] }

function MultiTrajectory({ title, trajectories, names, onClose }: { title: string; trajectories: TrajectoryRow[][]; names: string[]; onClose: () => void }) {
  const [idxs, setIdxs] = useState<number[]>(() => trajectories.map(() => 0))
  return <MapModal open onClose={onClose} title={title} trajectories={trajectories} currentIdxs={idxs} setCurrentIdxs={setIdxs} names={names} />
}

/** Denied / withdrawn messages of the selected plans, one at a time. */
function BulkErrors({ errors, onClose }: { errors: { name: string; message: unknown }[]; onClose: () => void }) {
  const { t } = useI18n()
  const pa = t.planAuth.viewers
  const [idx, setIdx] = useState(0)
  const current = errors[idx]
  const text = typeof current.message === 'string' ? current.message : JSON.stringify(current.message, null, 2)
  const nav = 'min-h-9 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <Modal open onClose={onClose} title={interpolate(pa.errorFor, { name: current.name, i: idx + 1, n: errors.length })} maxWidth="2xl">
      <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-subtle p-4 text-left text-xs text-fg">{text}</pre>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" className={nav} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          {pa.previous}
        </button>
        <button type="button" className={nav} disabled={idx === errors.length - 1} onClick={() => setIdx(idx + 1)}>
          {pa.next}
        </button>
      </div>
    </Modal>
  )
}

interface Props {
  viewer: ViewerState | null
  onClose: () => void
  /** "Accept alternative" of the plan viewer is running. */
  acceptingScrs: boolean
  onAcceptScrs: (planId: number) => void
  /** UplanFormModal saved a draft / the U-plan. */
  onFormSaved: () => void
  /** "Save & request authorization" inside the U-plan form. */
  onFormRequestAuth: (planId: number) => void
}

/** Mounts the viewer that is open (conditionally, so every open starts from a fresh state). */
export function ViewerHost({ viewer, onClose, acceptingScrs, onAcceptScrs, onFormSaved, onFormRequestAuth }: Props) {
  return (
    <>
      {viewer?.kind === 'planViewer' && (
        <PlanViewer
          key={`${viewer.planId}-${viewer.preset}`}
          preset={viewer.preset}
          planId={viewer.planId}
          planName={viewer.planName}
          plan={viewer.plan}
          auth={viewer.auth}
          detail={viewer.detail}
          onClose={onClose}
          accepting={acceptingScrs}
          onAcceptScrs={() => onAcceptScrs(viewer.planId)}
        />
      )}
      {viewer?.kind === 'uplanForm' && (
        <UplanFormModal
          open
          onClose={onClose}
          planId={String(viewer.planId)}
          existingUplan={viewer.uplan}
          planName={viewer.planName}
          authToken={getAuthToken() ?? ''}
          hasBeenProcessed={viewer.hasBeenProcessed}
          hasCsvResult={viewer.hasCsvResult}
          hasScheduledAt={viewer.hasScheduledAt}
          missingFields={viewer.missingFields}
          fieldErrors={viewer.fieldErrors}
          onSave={onFormSaved}
          onRequestAuthorization={(id) => onFormRequestAuth(Number(id))}
        />
      )}
      {viewer?.kind === 'multiTrajectory' && <MultiTrajectory title={viewer.title} trajectories={viewer.trajectories} names={viewer.names} onClose={onClose} />}
      {viewer?.kind === 'bulkUplans' && <BulkUplanViewModal open onClose={onClose} uplans={viewer.uplans} names={viewer.names} />}
      {viewer?.kind === 'bulkErrors' && <BulkErrors errors={viewer.errors} onClose={onClose} />}
    </>
  )
}
