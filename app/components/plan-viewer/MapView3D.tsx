'use client'

/* eslint-disable @typescript-eslint/no-explicit-any -- Cesium entities are untyped */

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { toEllipsoid } from '@/lib/altitude'
import { addLine, addPoint, addPrism, createPlanScene, moveEntity, setPrismStyle, type PlanScene } from '@/lib/cesium-scene'
import { droneAt, resolveHeights, ringCentroid, zoneNeedsTerrain, type PlanViewModel, type VmVolume, type VmZone } from '@/lib/plan-view-model'
import { featureId } from './featureInfo'
import { DIM_ALPHA, FILL_ALPHA, isActive, volumeColor, volumeState, zoneColor, zoneShown, type Layers, type Palette } from './viewerStyle'

export interface Status3D {
  /** The World Terrain provider did not load or has no data here: nothing terrain-based is drawn. */
  terrainDown: boolean
  /** Geozones that should be visible but have no terrain height (left out instead of drawn underground). */
  skippedZones: number
}

interface Props {
  model: PlanViewModel
  layers: Layers
  palette: Palette
  timeMs: number | null
  onSelect: (id: string | null) => void
  onStatus: (s: Status3D) => void
}

interface Drawn {
  vols: { e: any; v: VmVolume }[]
  zones: { e: any; z: VmZone }[]
  drone: any | null
  takeoffH: number
  skippedZones: number
}

const DATA_LAYERS = ['waypoints', 'trajectory', 'volumes', 'zones', 'scrs'] as const

/**
 * 3D map: ONE Cesium Viewer for the lifetime of the component (destroyed on unmount = switching back to 2D or closing).
 * Layers are data sources filled when their data arrives and shown / hidden afterwards; the viewer is never recreated.
 * Heights: lib/plan-view-model.ts resolveHeights on the sampled terrain (takeoff + the centroid of AGL zones).
 */
export default function MapView3D({ model, layers, palette: p, timeMs, onSelect, onStatus }: Props) {
  const { t } = useI18n()
  const vt = t.planAuth.viewer
  const box = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PlanScene | null>(null)
  const drawn = useRef<Drawn | null>(null)
  const fitted = useRef(false)
  const zoneH = useRef<Record<string, number>>({})
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const [scene, setScene] = useState<PlanScene | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [takeoffH, setTakeoffH] = useState<number | null>(null)
  const [zonesVersion, setZonesVersion] = useState(0)
  const [drawVersion, setDrawVersion] = useState(0)
  const [terrainDown, setTerrainDown] = useState(false)
  const [skipped, setSkipped] = useState(0)

  // 1. The Viewer (token fetched once, Cesium loaded once, World Terrain provider ready before anything is sampled)
  useEffect(() => {
    const el = box.current
    if (!el) return
    let dead = false
    setFailed(false)
    setScene(null)
    createPlanScene(el, { osm: window.matchMedia('(min-width: 768px)').matches, onPick: (id) => onSelectRef.current(id), cancelled: () => dead })
      .then((s) => {
        if (dead) return s.destroy()
        sceneRef.current = s
        setScene(s)
        if (!s.terrainReady) setTerrainDown(true)
      })
      .catch(() => !dead && setFailed(true))
    return () => {
      dead = true
      sceneRef.current?.destroy()
      sceneRef.current = null
      drawn.current = null
      fitted.current = false
      zoneH.current = {}
    }
  }, [attempt])

  // 2. Terrain under the takeoff point: the base of every height measured above takeoff
  const tLon = model.takeoff?.lon
  const tLat = model.takeoff?.lat
  useEffect(() => {
    if (!scene || !scene.terrainReady || tLon == null || tLat == null) return
    let dead = false
    scene
      .sampleGround([{ lon: tLon, lat: tLat }])
      .then(([h]) => {
        if (dead) return
        if (Number.isFinite(h)) setTakeoffH(h)
        else setTerrainDown(true)
      })
      .catch(() => !dead && setTerrainDown(true))
    return () => {
      dead = true
    }
  }, [scene, tLon, tLat])

  // 3. Terrain under the centroid of the zones with an AGL limit (the ones that are or may be shown)
  useEffect(() => {
    if (!scene || !scene.terrainReady) return
    const need = model.zones.filter((z) => zoneNeedsTerrain(z) && zoneShown(z, layers) && !(z.id in zoneH.current))
    if (need.length === 0) return
    let dead = false
    scene
      .sampleGround(need.map((z) => ringCentroid(z.ring)))
      .then((hs) => {
        if (dead) return
        need.forEach((z, i) => (zoneH.current[z.id] = hs[i]))
        setZonesVersion((v) => v + 1)
      })
      .catch(() => !dead && setTerrainDown(true))
    return () => {
      dead = true
    }
  }, [scene, model.zones, layers])

  // 4. Entities: rebuilt when the data or the heights change (never the viewer)
  useEffect(() => {
    if (!scene || takeoffH == null) return
    const abs = resolveHeights(model, { takeoffH, zoneH: zoneH.current })
    DATA_LAYERS.forEach((n) => scene.layer(n).entities.removeAll())
    const d: Drawn = { vols: [], zones: [], drone: null, takeoffH, skippedZones: 0 }

    if (abs.waypoints.length > 1) addLine(scene, 'waypoints', { id: 'route', name: vt.layers.waypoints, points: abs.waypoints, css: p.muted, width: 2, dashed: true })
    abs.waypoints.forEach((w, i) => {
      const label = w.type === 'takeoff' ? vt.info.takeoff : w.type === 'landing' ? vt.info.landing : undefined
      addPoint(scene, 'waypoints', { id: featureId.waypoint(i), name: label ?? vt.layers.waypoints, lon: w.lon, lat: w.lat, h: w.h, css: w.type === 'takeoff' ? p.success : w.type === 'landing' ? p.danger : p.info, size: w.type === 'cruise' ? 8 : 11, label })
    })
    if (abs.trajectory.length > 1) addLine(scene, 'trajectory', { id: 'trajectory', name: vt.layers.trajectory, points: abs.trajectory, css: p.accent, width: 3 })
    if (abs.trajectory.length > 0) d.drone = addPoint(scene, 'trajectory', { id: 'drone', name: vt.legend.drone, lon: abs.trajectory[0].lon, lat: abs.trajectory[0].lat, h: abs.trajectory[0].h, css: p.warning, size: 15 })
    abs.volumes.forEach((v) => {
      const e = addPrism(scene, 'volumes', { id: featureId.volume(v.ordinal), name: v.name || vt.layers.volumes, ring: v.ring, lowerH: v.lowerH, upperH: v.upperH, fill: p.info, fillAlpha: FILL_ALPHA, outline: p.info })
      d.vols.push({ e, v })
    })
    abs.zones.forEach((z) => {
      const e = addPrism(scene, 'zones', { id: featureId.zone(z.id), name: z.name || z.id, ring: z.ring, lowerH: z.lowerH, upperH: z.upperH, fill: p.muted, fillAlpha: 0.2, outline: p.muted })
      d.zones.push({ e, z })
    })
    if (abs.scrs) {
      addLine(scene, 'scrs', { id: 'scrs-current', name: vt.legend.currentRoute, points: abs.scrs.current, css: p.muted, width: 3, dashed: true })
      addLine(scene, 'scrs', { id: 'scrs-alt', name: vt.legend.alternative, points: abs.scrs.alternative, css: p.success, width: 4 })
    }
    drawn.current = d

    if (!fitted.current) {
      const core = [...abs.waypoints, ...abs.trajectory, ...abs.scrs?.alternative ?? [], ...abs.volumes.flatMap((v) => v.ring.map(([lon, lat]) => ({ lon, lat, h: v.upperH })))]
      if (core.length > 0) {
        fitted.current = true
        scene.fit(core)
      }
    }
    setDrawVersion((v) => v + 1)
  }, [scene, model, takeoffH, zonesVersion, p, vt])

  // 5. Style: layer visibility, volume colours and time dimming, zone visibility, drone position (cheap: no entity is rebuilt)
  useEffect(() => {
    const d = drawn.current
    if (!scene || !d) return
    DATA_LAYERS.filter((n) => n !== 'zones').forEach((n) => scene.setVisible(n, layers[n]))
    d.vols.forEach(({ e, v }) => {
      const c = volumeColor(volumeState(model, v, layers), p)
      setPrismStyle(scene, e, c, isActive(v, timeMs) ? FILL_ALPHA : DIM_ALPHA, c)
    })
    let shown = 0
    d.zones.forEach(({ e, z }) => {
      const on = zoneShown(z, layers)
      e.show = on
      if (on) shown++
      const c = z.conflicting ? p.danger : zoneColor(z.type, p)
      setPrismStyle(scene, e, c, z.conflicting ? 0.4 : 0.2, c)
    })
    d.skippedZones = model.zones.filter((z) => zoneShown(z, layers)).length - shown
    setSkipped(d.skippedZones)
    if (d.drone) {
      const pos = timeMs != null ? droneAt(model.trajectory, (timeMs - (model.timeline?.startMs ?? 0)) / 1000) : null
      d.drone.show = !!pos
      if (pos) moveEntity(scene, d.drone, { lon: pos.lon, lat: pos.lat, h: toEllipsoid(pos.alt, { terrainH: d.takeoffH, takeoffH: d.takeoffH, geoidN: 0 }) })
    }
    scene.render()
  }, [scene, drawVersion, model, layers, p, timeMs])

  useEffect(() => {
    onStatus({ terrainDown, skippedZones: skipped })
  }, [onStatus, terrainDown, skipped])

  return (
    <div className="relative h-full w-full bg-subtle">
      <div ref={box} className="h-full w-full" />
      {!scene && !failed && (
        <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-surface text-sm text-fg-2">
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {vt.warn.loading3d}
        </div>
      )}
      {failed && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center text-sm text-fg-2">
          <p>{vt.warn.sceneError}</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex min-h-11 items-center rounded-md border border-line-2 bg-surface px-4 font-medium text-fg hover:bg-hover">
            {vt.warn.retry}
          </button>
        </div>
      )}
    </div>
  )
}
