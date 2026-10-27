'use client'

/**
 * Plan authorization: ONE component tree for both modes.
 *   mode 'prod' = guided workflow, one plan at a time (ProdPlanAuthorization).
 *   mode 'dev'  = prod's data layer + the researcher / bulk tools in the table layout (DevPlanAuthorization).
 * Dev's layout loads on demand, so the production bundle only carries the production one.
 */

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import type { Mode } from './lib'
import { PlanAuthSkeleton, PlanListSkeleton } from './States'
import { ProdPlanAuthorization } from './ProdPlanAuthorization'

const FRAME = 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'

const DevPlanAuthorization = dynamic(() => import('./DevPlanAuthorization'), {
  ssr: false,
  loading: () => (
    <div className={FRAME}>
      <PlanAuthSkeleton />
    </div>
  ),
})

export function PlanAuthorization({ mode }: { mode: Mode }) {
  if (mode === 'dev') return <DevPlanAuthorization />
  return (
    // useSearchParams (the selected plan lives in the URL) needs a Suspense boundary
    <Suspense
      fallback={
        <div className={FRAME}>
          <PlanListSkeleton />
        </div>
      }
    >
      <ProdPlanAuthorization />
    </Suspense>
  )
}

export default PlanAuthorization
