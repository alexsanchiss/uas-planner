/**
 * CISP (Common Information Service Provider) client: the list of U-spaces.
 *
 * UPPS asks the CISP directly, as the U-space regulation expects, not through the
 * Geo-awareness service. The CISP answers GeoJSON-like features; UPPS keeps the shape
 * the UI has always used: `{ id, name, boundary: [{ latitude, longitude }] }`.
 */

import { z } from 'zod'

export const DEFAULT_CISP_USPACES_URL = 'http://sna-server.upvnet.upv.es:8000/spirit_cisp/uspaces'
export const CISP_TIMEOUT_MS = 15_000

export function getCispUspacesUrl(): string {
  return process.env.CISP_USPACES_URL || DEFAULT_CISP_USPACES_URL
}

export interface USpaceBoundaryPoint {
  latitude: number
  longitude: number
}

export interface USpace {
  /** CISP `properties.identifier`; the Geo-awareness stream and the plan's uspace_identifier use it */
  id: string
  name: string
  /** Closed outer ring of the polygon */
  boundary: USpaceBoundaryPoint[]
}

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)], z.number())

const cispFeature = z.object({
  name: z.string().nullish(),
  geometry: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(lonLat)).min(1),
  }),
  properties: z.object({ identifier: z.string().min(1) }),
})

/**
 * CISP response -> U-spaces. Returns null when the payload is not a CISP U-space list.
 * Features without an identifier or a closed polygon ring are left out, so one bad entry
 * does not hide the rest.
 */
export function toUspaces(data: unknown): USpace[] | null {
  const list = z.object({ uspaces: z.array(z.unknown()) }).safeParse(data)
  if (!list.success) return null
  return list.data.uspaces.flatMap((raw) => {
    const f = cispFeature.safeParse(raw)
    if (!f.success) return []
    const ring = f.data.geometry.coordinates[0]
    if (ring.length < 4) return []
    const { identifier } = f.data.properties
    return [{
      id: identifier,
      name: f.data.name || identifier,
      boundary: ring.map(([longitude, latitude]) => ({ latitude, longitude })),
    }]
  })
}
