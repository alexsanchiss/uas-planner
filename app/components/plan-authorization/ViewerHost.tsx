'use client'

import { useState, type ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import { interpolate, useI18n } from '@/app/i18n'
import { Modal } from '@/app/components/ui/modal'
import { getAuthToken } from '@/lib/api-client'
import type { TrajectoryRow } from './files'
import type { UplanData, Waypoint } from './lib'

// Heavy viewers (Leaflet / Cesium / three) load on demand and never during SSR.
const WaypointMapModal = dynamic(() => import('@/app/components/flight-plans/WaypointMapModal'), { ssr: false })
const TrajectoryMapViewer = dynamic(() => import('@/app/components/flight-plans/TrajectoryMapViewer'), { ssr: false })
const Trajectory3DViewer = dynamic(() => import('@/app/components/flight-plans/Trajectory3DViewer'), { ssr: false })
const Cesium3DModal = dynamic(() => import('@/app/components/flight-plans/Cesium3DModal'), { ssr: false })
const Geoawareness3DModal = dynamic(() => import('@/app/components/flight-plans/Geoawareness3DModal'), { ssr: false })
const AuthorizationResultModal = dynamic(() => import('@/app/components/flight-plans/AuthorizationResultModal'), { ssr: false })
const AlternativeTrajectoryModal = dynamic(() => import('@/app/components/flight-plans/AlternativeTrajectoryModal'), { ssr: false })
const UplanFormModal = dynamic(() => import('@/app/components/flight-plans/UplanFormModal'), { ssr: false })
const UplanViewModal = dynamic(() => import('@/app/components/UplanViewModal'), { ssr: false })
const MapModal = dynamic(() => import('@/app/components/MapModal'), { ssr: false })
const BulkUplanViewModal = dynamic(() => import('@/app/components/BulkUplanViewModal'), { ssr: false })

type Wp = { lat: number; lon: number; alt?: number }

export type ViewerState =
  | { kind: 'waypoints'; planName: string; waypoints: Waypoint[] }
  | { kind: 'trajectory2d'; planId: number; planName: string }
  | { kind: 'trajectory3d'; planId: number; planName: string }
  | { kind: 'uplan3d'; uplanData: UplanData }
  | { kind: 'uplan2d'; name: string; uplan: UplanData | null; fileContent: string | null }
  | { kind: 'geo3d'; planId: number; uspaceId: string; uplanData: UplanData | null }
  | {
      kind: 'result'
      planId: number
      planName: string
      status: 'aprobado' | 'denegado' | 'withdrawn'
      reason: string | null
      uplanData: UplanData | null
      geoawarenessData: unknown
    }
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

/** SCRS proposal compared with the current route (opens on top of the result modal). */
export interface ScrsState {
  planId: number
  current: Wp[]
  alternative: Wp[]
}

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
  scrs: ScrsState | null
  onCloseScrs: () => void
  acceptingScrs: boolean
  onAcceptScrs: () => void
  onOpenScrs: (current: Wp[], alternative: Wp[]) => void
  /** UplanFormModal saved a draft / the U-plan. */
  onFormSaved: () => void
  /** "Save & request authorization" inside the U-plan form. */
  onFormRequestAuth: (planId: number) => void
}

/** Mounts the viewer that is open (conditionally, so every open starts from a fresh state). */
export function ViewerHost({ viewer, onClose, scrs, onCloseScrs, acceptingScrs, onAcceptScrs, onOpenScrs, onFormSaved, onFormRequestAuth }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.viewers

  return (
    <>
      {viewer?.kind === 'waypoints' && <WaypointMapModal open onClose={onClose} title={pa.waypointsTitle} planName={viewer.planName} waypoints={viewer.waypoints} />}
      {viewer?.kind === 'trajectory2d' && <TrajectoryMapViewer key={viewer.planId} planId={String(viewer.planId)} planName={viewer.planName} onClose={onClose} />}
      {viewer?.kind === 'trajectory3d' && <Trajectory3DViewer isOpen onClose={onClose} planId={String(viewer.planId)} planName={viewer.planName} />}
      {viewer?.kind === 'uplan3d' && <Cesium3DModal isOpen onClose={onClose} uplanData={viewer.uplanData as ComponentProps<typeof Cesium3DModal>['uplanData']} />}
      {viewer?.kind === 'uplan2d' && <UplanViewModal open onClose={onClose} uplan={viewer.uplan} name={viewer.name} fileContent={viewer.fileContent} />}
      {viewer?.kind === 'geo3d' && (
        <Geoawareness3DModal isOpen onClose={onClose} planId={String(viewer.planId)} uspaceId={viewer.uspaceId} uplanData={viewer.uplanData as ComponentProps<typeof Geoawareness3DModal>['uplanData']} />
      )}
      {viewer?.kind === 'result' && (
        <AuthorizationResultModal
          isOpen
          onClose={onClose}
          uplanData={viewer.uplanData as ComponentProps<typeof AuthorizationResultModal>['uplanData']}
          status={viewer.status}
          reason={viewer.reason}
          geoawarenessData={viewer.geoawarenessData}
          planName={viewer.planName}
          planId={String(viewer.planId)}
          onViewScrsAlternative={onOpenScrs}
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

      {scrs && (
        <AlternativeTrajectoryModal
          open
          onClose={onCloseScrs}
          currentWaypoints={scrs.current}
          alternativeWaypoints={scrs.alternative}
          onAccept={onAcceptScrs}
          onReject={onCloseScrs}
          isProcessing={acceptingScrs}
        />
      )}
    </>
  )
}
