import { labelAlt, labelAltRange, type AltFormats } from '@/lib/altitude'
import { interpolate } from '@/app/i18n'
import type { Translations } from '@/app/i18n'
import { isConflicting, type PlanViewModel } from '@/lib/plan-view-model'
import { clock } from './viewerStyle'

export type ViewerT = Translations['planAuth']['viewer']

/** Feature ids shared by both maps: `wp:<index>`, `vol:<ordinal>`, `zone:<id>`. */
export const featureId = {
  waypoint: (i: number) => `wp:${i}`,
  volume: (ordinal: number) => `vol:${ordinal}`,
  zone: (id: string) => `zone:${id}`,
}

export interface FeatureInfo {
  title: string
  /** Short line for map tooltips: the main altitude, with its reference. */
  summary: string
  rows: [label: string, value: string][]
}

/** Texts of a clicked / hovered feature (altitudes always with their reference). Null when the id is not in the model. */
export function describeFeature(id: string | null, model: PlanViewModel, t: ViewerT): FeatureInfo | null {
  if (!id) return null
  const f: AltFormats = t.alt
  const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)]
  if (kind === 'wp') {
    const w = model.waypoints[Number(key)]
    if (!w) return null
    const title = w.type === 'takeoff' ? t.info.takeoff : w.type === 'landing' ? t.info.landing : interpolate(t.info.waypoint, { n: Number(key) + 1 })
    return {
      title,
      summary: labelAlt(w.alt, f),
      rows: [
        [t.info.altitude, labelAlt(w.alt, f)],
        [t.info.position, `${w.lat.toFixed(6)}, ${w.lon.toFixed(6)}`],
      ],
    }
  }
  if (kind === 'vol') {
    const v = model.volumes.find((x) => x.ordinal === Number(key))
    if (!v) return null
    const start = model.timeline?.startMs ?? 0
    const rows: FeatureInfo['rows'] = []
    if (v.min) rows.push([t.info.lower, labelAlt(v.min, f)])
    if (v.max) rows.push([t.info.upper, labelAlt(v.max, f)])
    if (v.beginMs != null && v.endMs != null) rows.push([t.info.from, clock(v.beginMs - start)], [t.info.to, clock(v.endMs - start)])
    if (model.result) rows.push([t.info.status, model.result.status === 'approved' ? t.info.authorized : isConflicting(model.result, v) ? t.info.conflicting : t.info.ok])
    return { title: v.name || interpolate(t.info.volume, { n: v.ordinal + 1 }), summary: v.min && v.max ? labelAltRange(v.min, v.max, f) : '', rows }
  }
  if (kind === 'zone') {
    const z = model.zones.find((x) => x.id === key)
    if (!z) return null
    const rows: FeatureInfo['rows'] = []
    if (z.type) rows.push([t.info.type, z.type.replace(/_/g, ' ')])
    rows.push([t.info.lower, labelAlt(z.lower, f)], [t.info.upper, labelAlt(z.upper, f)])
    if (z.conflicting) rows.push([t.info.status, t.info.conflicting])
    return { title: z.name || z.id, summary: labelAltRange(z.lower, z.upper, f), rows }
  }
  return null
}
