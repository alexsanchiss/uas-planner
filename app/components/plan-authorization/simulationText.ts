/** Text of a plan's simulation settings (pure, no React): the summary line, the short muted line of the lists. */

import { interpolate } from '@/app/i18n/interpolate'
import type { Translations } from '@/app/i18n/translations'
import type { SimulationSettings } from '@/lib/simulation'

type Sim = Translations['planAuth']['sim']
type Processing = Translations['planAuth']['processing']

const num = (n: number, language: string) => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(n)

export const isDefaultSimulation = (s: SimulationSettings) => s.airframe === 'multirotor' && !s.wind

/** "Multirotor · no wind" / "Fixed wing · wind 8 m/s from 270°, gusts 12 m/s". */
export function simulationSummary(s: SimulationSettings, sim: Sim, language: string): string {
  const aircraft = sim.aircraft[s.airframe]
  if (!s.wind) return interpolate(sim.summaryNoWind, { aircraft })
  const { speed, direction, gust } = s.wind
  const base = interpolate(sim.summaryWind, { aircraft, speed: num(speed, language), dir: num(direction, language) })
  return gust !== null ? base + interpolate(sim.summaryGust, { gust: num(gust, language) }) : base
}

/** "Fixed wing · 8 m/s" for the muted line of a table row / card; null when the settings are the default. */
export function simulationShort(s: SimulationSettings, sim: Sim, language: string): string | null {
  if (isDefaultSimulation(s)) return null
  const aircraft = sim.aircraft[s.airframe]
  return s.wind ? interpolate(sim.short, { aircraft, speed: num(s.wind.speed, language) }) : aircraft
}

/** "≈ 2 min left" / "≈ 40 s left" / "Finishing…" from the milliseconds to the estimated end. */
export function remainingText(ms: number, s: Processing): string {
  if (ms <= 0) return s.finishing
  const sec = Math.ceil(ms / 1000)
  return sec < 60 ? interpolate(s.remainingSec, { n: sec }) : interpolate(s.remainingMin, { n: Math.round(sec / 60) })
}
