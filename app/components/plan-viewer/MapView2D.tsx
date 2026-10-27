'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '@/app/i18n'
import { localeOf } from '@/lib/altitude'
import { droneAt, type PlanViewModel, type Ring } from '@/lib/plan-view-model'
import { describeFeature, featureId } from './featureInfo'
import { DIM_ALPHA, FILL_ALPHA, isActive, volumeColor, volumeState, zoneColor, zoneShown, type Layers, type Palette } from './viewerStyle'

interface Props {
  model: PlanViewModel
  layers: Layers
  palette: Palette
  timeMs: number | null
  selected: string | null
  onSelect: (id: string | null) => void
}

type LatLng = [number, number]
const ll = (r: Ring): LatLng[] => r.map(([lon, lat]) => [lat, lon])

/** Keeps the map framed on the plan data of the visible layers, and valid when its container changes size (mode switch, rotation). */
function Framing({ points }: { points: LatLng[] }) {
  const map = useMap()
  const key = useMemo(() => {
    if (points.length === 0) return ''
    const lats = points.map((p) => p[0])
    const lons = points.map((p) => p[1])
    return [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)].map((n) => n.toFixed(5)).join(',')
  }, [points])

  // `sized`: the container has a real size (the dialog is still animating in at mount), so the first fit is not made on 0 x 0
  const [sized, setSized] = useState(false)
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
      setSized(el.clientWidth > 0 && el.clientHeight > 0)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])

  useEffect(() => {
    if (!key || !sized) return
    const [s, n, w, e] = key.split(',').map(Number)
    map.invalidateSize()
    map.fitBounds(
      [
        [s, w],
        [n, e],
      ],
      { padding: [28, 28], maxZoom: 18 }
    )
  }, [map, key, sized])
  return null
}

export default function MapView2D({ model, layers, palette: p, timeMs, selected, onSelect }: Props) {
  const { t, language } = useI18n()
  const vt = t.planAuth.viewer

  const framed = useMemo(() => {
    const pts: LatLng[] = []
    const core = (all: boolean) => {
      if (all || layers.waypoints) model.waypoints.forEach((w) => pts.push([w.lat, w.lon]))
      if (all || layers.trajectory) model.trajectory.forEach((w) => pts.push([w.lat, w.lon]))
      if (all || layers.volumes) model.volumes.forEach((v) => pts.push(...ll(v.ring)))
      if ((all || layers.scrs) && model.scrs) [...model.scrs.current, ...model.scrs.alternative].forEach((w) => pts.push([w.lat, w.lon]))
    }
    core(false)
    if (pts.length === 0) core(true)
    // Geozones frame the map only when there is nothing else (they are far larger than the flight)
    if (pts.length === 0) model.zones.forEach((z) => pts.push(...ll(z.ring)))
    return pts
  }, [model, layers.waypoints, layers.trajectory, layers.volumes, layers.scrs])

  const drone = timeMs != null && layers.trajectory ? droneAt(model.trajectory, (timeMs - (model.timeline?.startMs ?? 0)) / 1000) : null
  const tip = (id: string) => {
    const info = describeFeature(id, model, vt, localeOf(language))
    return info ? (
      <Tooltip sticky>
        <strong>{info.title}</strong>
        {info.summary && <span> · {info.summary}</span>}
      </Tooltip>
    ) : null
  }
  const waypointColor = { takeoff: p.success, cruise: p.info, landing: p.danger }

  return (
    <MapContainer center={[39.47, -0.38]} zoom={13} scrollWheelZoom className="h-full w-full bg-subtle">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <Framing points={framed} />

      {model.zones
        .filter((z) => zoneShown(z, layers))
        .map((z) => {
          const id = featureId.zone(z.id)
          const color = z.conflicting ? p.danger : zoneColor(z.type, p)
          return (
            <Polygon
              key={id}
              positions={ll(z.ring)}
              pathOptions={{ color, weight: selected === id ? 4 : z.conflicting ? 3 : 1.5, dashArray: z.conflicting ? '6 4' : undefined, fillColor: color, fillOpacity: z.conflicting ? 0.25 : 0.12 }}
              eventHandlers={{ click: () => onSelect(id) }}
            >
              {tip(id)}
            </Polygon>
          )
        })}

      {layers.volumes &&
        model.volumes.map((v) => {
          const id = featureId.volume(v.ordinal)
          const color = volumeColor(volumeState(model, v, layers), p)
          const lit = isActive(v, timeMs)
          return (
            <Polygon
              key={id}
              positions={ll(v.ring)}
              pathOptions={{ color, weight: selected === id ? 4 : 2, opacity: lit ? 0.95 : 0.25, fillColor: color, fillOpacity: lit ? FILL_ALPHA : DIM_ALPHA }}
              eventHandlers={{ click: () => onSelect(id) }}
            >
              {tip(id)}
            </Polygon>
          )
        })}

      {layers.scrs && model.scrs && (
        <>
          <Polyline positions={model.scrs.current.map((w): LatLng => [w.lat, w.lon])} pathOptions={{ color: p.muted, weight: 3, dashArray: '6 6' }} />
          <Polyline positions={model.scrs.alternative.map((w): LatLng => [w.lat, w.lon])} pathOptions={{ color: p.success, weight: 4 }} />
        </>
      )}

      {layers.trajectory && model.trajectory.length > 1 && <Polyline positions={model.trajectory.map((w): LatLng => [w.lat, w.lon])} pathOptions={{ color: p.accent, weight: 3 }} />}

      {layers.waypoints && model.waypoints.length > 1 && <Polyline positions={model.waypoints.map((w): LatLng => [w.lat, w.lon])} pathOptions={{ color: p.muted, weight: 2, dashArray: '4 6' }} />}
      {layers.waypoints &&
        model.waypoints.map((w, i) => {
          const id = featureId.waypoint(i)
          return (
            <CircleMarker
              key={id}
              center={[w.lat, w.lon]}
              radius={selected === id ? 9 : w.type === 'cruise' ? 6 : 8}
              pathOptions={{ color: p.muted, weight: 2, fillColor: waypointColor[w.type], fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelect(id) }}
            >
              {tip(id)}
            </CircleMarker>
          )
        })}

      {drone && (
        <CircleMarker center={[drone.lat, drone.lon]} radius={8} pathOptions={{ color: p.muted, weight: 2, fillColor: p.warning, fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]}>
            {vt.legend.drone}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}

