'use client'

/**
 * What both maps (2D Leaflet, 3D Cesium) share: layer ids and presets, the colours (read from the theme tokens, so a
 * theme switch repaints both) and the rules that decide how a volume / zone is styled at a given time.
 */

import { useSyncExternalStore } from 'react'
import { isConflicting, type PlanViewModel, type VmVolume, type VmZone } from '@/lib/plan-view-model'

export type LayerId = 'waypoints' | 'trajectory' | 'volumes' | 'zones' | 'result' | 'scrs'
export type Layers = Record<LayerId, boolean>
export type Preset = 'route' | 'uplan' | 'result'
export const LAYER_IDS: LayerId[] = ['waypoints', 'trajectory', 'volumes', 'zones', 'result', 'scrs']

/** Layers that have data for this plan (a chip only appears for these). */
export type Availability = Layers

/** Layers switched on when the viewer opens with a preset (only the ones that have data). */
export function initialLayers(preset: Preset, has: Availability): Layers {
  const on: LayerId[] = preset === 'route' ? ['waypoints', 'trajectory'] : preset === 'uplan' ? ['volumes'] : ['volumes', 'result', 'scrs']
  return Object.fromEntries(LAYER_IDS.map((id) => [id, on.includes(id) && has[id]])) as Layers
}

// ---- Colours (theme tokens) ------------------------------------------------------------

export interface Palette {
  info: string
  success: string
  danger: string
  warning: string
  accent: string
  muted: string
}

const VARS: Record<keyof Palette, string> = {
  info: '--status-info',
  success: '--status-success',
  danger: '--status-error',
  warning: '--status-warning',
  accent: '--color-accent',
  muted: '--color-muted',
}
const FALLBACK: Palette = { info: 'gray', success: 'gray', danger: 'gray', warning: 'gray', accent: 'gray', muted: 'gray' }

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  return Object.fromEntries(Object.entries(VARS).map(([k, v]) => [k, css.getPropertyValue(v).trim() || 'gray'])) as unknown as Palette
}

let cached: { theme: string; palette: Palette } | null = null
function snapshot(): Palette {
  const theme = document.documentElement.getAttribute('data-theme') ?? 'dark'
  if (cached?.theme !== theme) cached = { theme, palette: readPalette() }
  return cached.palette
}
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => mo.disconnect()
}

/** Map colours from the theme tokens (`--status-*`, `--color-*`); they follow the app's dark / light toggle. */
export function usePalette(): Palette {
  return useSyncExternalStore(subscribe, snapshot, () => FALLBACK)
}

/** Geozone colour by service type; conflicts are stressed by the outline, not by a second colour family. */
export function zoneColor(type: string, p: Palette): string {
  switch (type.toUpperCase()) {
    case 'PROHIBITED':
      return p.danger
    case 'REQ_AUTHORIZATION':
      return p.warning
    case 'CONDITIONAL':
      return p.accent
    default:
      return p.muted
  }
}

// ---- Styling rules -----------------------------------------------------------------------

export type VolumeState = 'ok' | 'authorized' | 'conflicting'

/** With the Result layer on a volume shows the FAS verdict; otherwise every volume is the plain "ok" blue. */
export function volumeState(model: PlanViewModel, v: VmVolume, layers: Layers): VolumeState {
  if (!layers.result || !model.result) return 'ok'
  if (model.result.status === 'approved') return 'authorized'
  return isConflicting(model.result, v) ? 'conflicting' : 'ok'
}

export function volumeColor(state: VolumeState, p: Palette): string {
  return state === 'authorized' ? p.success : state === 'conflicting' ? p.danger : p.info
}

/** At a slider time only the volumes whose window contains it are lit (no time chosen = all lit). */
export function isActive(v: Pick<VmVolume, 'beginMs' | 'endMs'>, timeMs: number | null): boolean {
  if (timeMs == null || v.beginMs == null || v.endMs == null) return true
  return timeMs >= v.beginMs && timeMs <= v.endMs
}

export const FILL_ALPHA = 0.4
export const DIM_ALPHA = 0.06

/** A zone is drawn by the Geozones layer, and the conflicting ones also by the Result layer. */
export function zoneShown(z: Pick<VmZone, 'conflicting'>, layers: Layers): boolean {
  return layers.zones || (layers.result && z.conflicting)
}

/** mm:ss (or h:mm:ss) of a duration in ms. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
