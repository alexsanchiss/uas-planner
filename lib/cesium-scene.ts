/* eslint-disable @typescript-eslint/no-explicit-any -- Cesium is a dynamically loaded global, no static types */

/**
 * Cesium side of the plan viewer (client only). ONE Viewer per scene, created once with the Ion token (fetched once),
 * the World Terrain provider and no widgets; layers are CustomDataSources that are filled / shown / hidden without
 * touching the viewer. Every entity uses HeightReference.NONE with heights computed beforehand (lib/plan-view-model.ts
 * resolveHeights), so nothing depends on when a terrain tile happens to load. If the World Terrain provider does not
 * load, `terrainReady` is false and `sampleGround` rejects: callers show a warning instead of drawing underground.
 */

import { getCesiumToken, loadCesium } from './cesium-loader'
import type { LonLat, Ring } from './plan-view-model'

export interface PlanScene {
  Cesium: any
  viewer: any
  /** false = the World Terrain provider did not load (the globe is the bare ellipsoid). */
  terrainReady: boolean
  /** Terrain heights (metres above the ellipsoid) at the points, max detail; NaN where a point has no data. Rejects when terrain is not ready. */
  sampleGround(points: LonLat[]): Promise<number[]>
  /** Data source of a layer, created on first use. */
  layer(name: string): any
  setVisible(name: string, on: boolean): void
  /** Frame positions given as lon, lat, height. */
  fit(points: { lon: number; lat: number; h: number }[]): void
  render(): void
  destroy(): void
}

/** `cancelled` is polled before the Viewer is created: an unmounted caller (StrictMode's double mount) must not leave a second Viewer in the container. */
export async function createPlanScene(container: HTMLElement, opts: { osm: boolean; onPick: (id: string | null) => void; cancelled: () => boolean }): Promise<PlanScene> {
  const Cesium = await loadCesium(await getCesiumToken())
  let terrainProvider: any = null
  try {
    terrainProvider = await Cesium.createWorldTerrainAsync()
  } catch {
    terrainProvider = null
  }
  if (opts.cancelled()) throw new Error('cancelled')
  const viewer = new Cesium.Viewer(container, {
    ...(terrainProvider ? { terrainProvider } : {}),
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: true,
    requestRenderMode: true,
  })
  const layers = new Map<string, any>()
  viewer.selectedEntityChanged.addEventListener((e: any) => opts.onPick(typeof e?.id === 'string' ? e.id : null))
  if (opts.osm) {
    Cesium.createOsmBuildingsAsync()
      .then((b: any) => {
        if (!viewer.isDestroyed()) {
          viewer.scene.primitives.add(b)
          viewer.scene.requestRender()
        }
      })
      .catch(() => {})
  }

  return {
    Cesium,
    viewer,
    terrainReady: !!terrainProvider,
    async sampleGround(points) {
      if (!terrainProvider || terrainProvider instanceof Cesium.EllipsoidTerrainProvider) throw new Error('terrain-unavailable')
      const sampled: any[] = await Cesium.sampleTerrainMostDetailed(terrainProvider, points.map((p) => Cesium.Cartographic.fromDegrees(p.lon, p.lat)))
      return sampled.map((c) => (Number.isFinite(c.height) ? c.height : NaN))
    },
    layer(name) {
      let ds = layers.get(name)
      if (!ds) {
        ds = new Cesium.CustomDataSource(name)
        layers.set(name, ds)
        viewer.dataSources.add(ds)
      }
      return ds
    },
    setVisible(name, on) {
      const ds = layers.get(name)
      if (ds) ds.show = on
      viewer.scene.requestRender()
    },
    fit(points) {
      if (points.length === 0 || viewer.isDestroyed()) return
      const sphere = Cesium.BoundingSphere.fromPoints(points.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.h)))
      sphere.radius = Math.max(sphere.radius * 2.5, 300)
      viewer.camera.flyToBoundingSphere(sphere, { duration: 1.2, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0) })
    },
    render: () => !viewer.isDestroyed() && viewer.scene.requestRender(),
    destroy() {
      if (!viewer.isDestroyed()) viewer.destroy()
    },
  }
}

// ---- Entity builders (absolute heights, HeightReference.NONE) --------------------------

const color = (C: any, css: string, alpha = 1) => C.Color.fromCssColorString(css).withAlpha(alpha)

/** Extruded polygon between two absolute heights. */
export function addPrism(s: PlanScene, layer: string, o: { id: string; name: string; ring: Ring; lowerH: number; upperH: number; fill: string; fillAlpha: number; outline: string }) {
  const C = s.Cesium
  return s.layer(layer).entities.add({
    id: o.id,
    name: o.name,
    polygon: {
      hierarchy: C.Cartesian3.fromDegreesArray(o.ring.flat()),
      height: o.lowerH,
      extrudedHeight: o.upperH,
      heightReference: C.HeightReference.NONE,
      extrudedHeightReference: C.HeightReference.NONE,
      material: color(C, o.fill, o.fillAlpha),
      outline: true,
      outlineColor: color(C, o.outline),
    },
  })
}

export function setPrismStyle(s: PlanScene, entity: any, fill: string, fillAlpha: number, outline: string) {
  const C = s.Cesium
  entity.polygon.material = color(C, fill, fillAlpha)
  entity.polygon.outlineColor = color(C, outline)
}

export function addLine(s: PlanScene, layer: string, o: { id: string; name: string; points: { lon: number; lat: number; h: number }[]; css: string; width: number; dashed?: boolean }) {
  const C = s.Cesium
  const c = color(C, o.css)
  return s.layer(layer).entities.add({
    id: o.id,
    name: o.name,
    polyline: {
      positions: C.Cartesian3.fromDegreesArrayHeights(o.points.flatMap((p) => [p.lon, p.lat, p.h])),
      width: o.width,
      clampToGround: false,
      material: o.dashed ? new C.PolylineDashMaterialProperty({ color: c }) : c,
    },
  })
}

export function addPoint(s: PlanScene, layer: string, o: { id: string; name: string; lon: number; lat: number; h: number; css: string; size: number; label?: string }) {
  const C = s.Cesium
  return s.layer(layer).entities.add({
    id: o.id,
    name: o.name,
    position: C.Cartesian3.fromDegrees(o.lon, o.lat, o.h),
    point: { pixelSize: o.size, color: color(C, o.css), outlineColor: C.Color.WHITE, outlineWidth: 1, heightReference: C.HeightReference.NONE },
    label: o.label
      ? { text: o.label, font: '12px sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2, style: C.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -12), heightReference: C.HeightReference.NONE }
      : undefined,
  })
}

export function moveEntity(s: PlanScene, entity: any, p: { lon: number; lat: number; h: number }) {
  entity.position = s.Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.h)
}
