import { NextResponse } from 'next/server'
import { CISP_TIMEOUT_MS, getCispUspacesUrl, toUspaces } from '@/lib/cisp'

// The list lives in the CISP and can change at any time: never prerender or cache it.
export const dynamic = 'force-dynamic'

/**
 * GET /api/uspaces
 *
 * U-spaces from the CISP (`CISP_USPACES_URL`), relayed because the browser cannot reach it.
 * Public, like the plan-definition data it feeds. 503/504 when the CISP is down or slow,
 * 502 when it answers something that is not a U-space list.
 */
export async function GET() {
  let response: Response
  try {
    response = await fetch(getCispUspacesUrl(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(CISP_TIMEOUT_MS),
    })
  } catch (err) {
    const timeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[USpaces] CISP request failed:', err)
    return NextResponse.json(
      { error: timeout ? 'U-space service (CISP) timeout' : 'U-space service (CISP) unavailable' },
      { status: timeout ? 504 : 503 }
    )
  }

  if (!response.ok) {
    console.error(`[USpaces] CISP answered ${response.status}`)
    return NextResponse.json({ error: `U-space service (CISP) error ${response.status}` }, { status: 502 })
  }

  const uspaces = toUspaces(await response.json().catch(() => null))
  if (!uspaces) {
    console.error('[USpaces] CISP answer is not a U-space list')
    return NextResponse.json({ error: 'Invalid answer from the U-space service (CISP)' }, { status: 502 })
  }

  return NextResponse.json({ success: true, uspaces, count: uspaces.length })
}
