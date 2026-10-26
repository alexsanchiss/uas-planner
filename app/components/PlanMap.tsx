"use client";
import React, { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Rectangle, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Point, ScanWaypoint } from "@/lib/scan-generator";
import { GeozoneLayer } from "./plan-definition/GeozoneLayer";
import { GeozoneInfoPopup } from "./plan-definition/GeozoneInfoPopup";
import { useI18n } from "@/app/i18n";
import { MapPin } from "lucide-react";
import type { GeozoneData, WebSocketStatus } from "@/app/hooks/useGeoawarenessWebSocket";

// TASK-152: Large bounds for overlay outside service area (covers the world)
const WORLD_BOUNDS: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];

// Map layer colors (Leaflet path options and marker HTML). They are data colors drawn over the map tiles,
// not UI chrome, so they live here instead of in the theme tokens. UI overlays/popups use theme classes.
const MAP_COLORS = {
  takeoff: "#22c55e",
  cruise: "#3b82f6",
  landing: "#ef4444",
  flyOver: "#a855f7",
  pause: "#f97316",
  scanArea: "#a855f7",
  scanVertex: "#8b5cf6",
  scanPreview: "#6366f1",
  route: "#2563eb",
  serviceArea: "#f59e42",
  mask: "#000000",
};
const MARKER_SHADOW = "0 2px 6px rgba(0,0,0,0.4)";

// TASK-125: Helper to format pause duration for display
function formatPauseDuration(seconds: number): string {
  if (seconds === 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// TASK-125 & TASK-129: Create custom icon with pause and fly-over indicators
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/overlay objects from map layers
function createWaypointIcon(wp: any, idx: number): L.DivIcon {
  const hasPause = wp.pauseDuration && wp.pauseDuration > 0;
  const pauseText = hasPause ? formatPauseDuration(wp.pauseDuration) : "";
  const isFlyOver = wp.flyOverMode && wp.type === "cruise"; // TASK-129: Only cruise waypoints can be fly-over
  
  // Color based on waypoint type
  // TASK-129: Fly-over waypoints get purple color to distinguish from regular cruise
  const typeColors: Record<string, string> = {
    takeoff: MAP_COLORS.takeoff,
    cruise: MAP_COLORS.cruise,
    landing: MAP_COLORS.landing,
  };
  const color = isFlyOver ? MAP_COLORS.flyOver : (typeColors[wp.type] || MAP_COLORS.cruise); // purple for fly-over
  
  // TASK-129: Fly-over waypoints get a diamond shape indicator, fly-by get a circle
  const markerShape = isFlyOver
    ? `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 3px solid white;
        transform: rotate(45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${MARKER_SHADOW};
      ">
        <span style="transform: rotate(-45deg); color: white; font-weight: bold; font-size: 12px;">${idx + 1}</span>
      </div>`
    : `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: ${MARKER_SHADOW};
      ">${idx + 1}</div>`;
  
  return L.divIcon({
    className: "custom-waypoint-marker",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        ${markerShape}
        ${hasPause ? `
          <div style="
            position: absolute;
            top: -8px;
            right: -16px;
            background: ${MAP_COLORS.pause};
            color: white;
            font-size: 9px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 8px;
            white-space: nowrap;
            box-shadow: ${MARKER_SHADOW};
          ">⏱ ${pauseText}</div>
        ` : ""}
        ${isFlyOver ? `
          <div style="
            position: absolute;
            bottom: -12px;
            background: ${MAP_COLORS.flyOver};
            color: white;
            font-size: 8px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: ${MARKER_SHADOW};
          ">⊙ OVER</div>
        ` : ""}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// TASK-12: Editable popup content for waypoint markers
// Waypoint field names for type-safe editing callbacks
type WaypointField = 'lat' | 'lng' | 'altitude' | 'speed' | 'pauseDuration' | 'flyOverMode' | 'type';

interface PopupWaypoint {
  lat: number;
  lng: number;
  type: string;
  altitude: number;
  speed: number;
  pauseDuration: number;
  flyOverMode: boolean;
}

const popupLabel = "mb-0.5 block text-[11px] font-bold text-fg-2";
const popupInput = "w-full rounded border border-line bg-input px-1 py-0.5 text-xs text-fg disabled:cursor-not-allowed disabled:opacity-50";
const popupTitle = "mb-1.5 border-b border-line pb-1 text-[13px] font-bold text-fg";
const popupFooter = "mt-2 border-t border-line pt-1.5";
const popupOk = "w-full rounded bg-brand py-1 text-xs font-bold text-brand-fg hover:bg-brand-hover";

/** Labelled popup input (label and input linked through a generated id). */
function PopupInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = React.useId();
  return (
    <div className="mb-1.5">
      <label htmlFor={id} className={popupLabel}>{label}</label>
      <input id={id} className={popupInput} {...props} />
    </div>
  );
}

function EditablePopupContent({ wp, idx, onWaypointChange }: {
  wp: PopupWaypoint;
  idx: number;
  onWaypointChange: (idx: number, field: WaypointField, value: number | boolean) => void;
}) {
  const { t } = useI18n();
  const map = useMap();
  const [localLat, setLocalLat] = React.useState(wp.lat.toString());
  const [localLng, setLocalLng] = React.useState(wp.lng.toString());

  React.useEffect(() => {
    setLocalLat(wp.lat.toFixed(7));
    setLocalLng(wp.lng.toFixed(7));
  }, [wp.lat, wp.lng]);

  const handleOk = () => {
    const lat = parseFloat(localLat);
    const lng = parseFloat(localLng);
    if (!isNaN(lat)) onWaypointChange(idx, 'lat', lat);
    if (!isNaN(lng)) onWaypointChange(idx, 'lng', lng);
    map.closePopup();
  };

  const typeColor = wp.type === 'takeoff' ? MAP_COLORS.takeoff : wp.type === 'landing' ? MAP_COLORS.landing : MAP_COLORS.cruise;

  return (
    <div className="min-w-[190px]">
      <div className={popupTitle}>
        {t.flightPlans.waypoint} {idx + 1} <span className="capitalize" style={{ color: typeColor }}>({wp.type})</span>
      </div>
      <PopupInput label={t.planGenerator.latitude} type="text" value={localLat}
        onChange={(e) => setLocalLat(e.target.value)}
        onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { onWaypointChange(idx, 'lat', v); } else { setLocalLat(wp.lat.toFixed(7)); } }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); }} />
      <PopupInput label={t.planGenerator.longitude} type="text" value={localLng}
        onChange={(e) => setLocalLng(e.target.value)}
        onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { onWaypointChange(idx, 'lng', v); } else { setLocalLng(wp.lng.toFixed(7)); } }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); }} />
      <PopupInput label={`${t.planGenerator.altitude} (m)`} type="number" min={0} value={wp.altitude}
        onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onWaypointChange(idx, 'altitude', v); }}
        disabled={wp.type === 'landing'} />
      <PopupInput label={`${t.planGenerator.speed} (m/s)`} type="number" min={0} step="0.1" value={wp.speed}
        onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onWaypointChange(idx, 'speed', v); }} />
      <PopupInput label={`${t.planGenerator.pause} (s)`} type="number" min={0} max={3600} value={wp.pauseDuration || 0}
        onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onWaypointChange(idx, 'pauseDuration', v); }} />
      {wp.type === 'cruise' && (
        <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input type="checkbox" checked={wp.flyOverMode || false}
            onChange={(e) => onWaypointChange(idx, 'flyOverMode', e.target.checked)} />
          <span className="font-bold text-fg-2">{t.planGenerator.flyOver}</span>
          <span className="text-xs" style={{ color: wp.flyOverMode ? MAP_COLORS.flyOver : MAP_COLORS.cruise }}>
            {wp.flyOverMode ? '⊙ Over' : '∽ By'}
          </span>
        </label>
      )}
      <div className={popupFooter}>
        <button type="button" onClick={handleOk} className={popupOk}>
          OK
        </button>
      </div>
    </div>
  );
}

function WaypointMarkers({ waypoints, onSelect, onDragEndMarker, onWaypointChange }: { waypoints: PopupWaypoint[]; onSelect: (idx: number) => void; onDragEndMarker: (idx: number, lat: number, lng: number) => void; onWaypointChange?: (idx: number, field: WaypointField, value: number | boolean) => void; }) {
  return waypoints.map((wp, idx) => (
    <Marker
      key={idx}
      position={[wp.lat, wp.lng]}
      icon={createWaypointIcon(wp, idx)}
      title={`Waypoint ${idx + 1} (${wp.type})`}
      alt={`Waypoint ${idx + 1} (${wp.type})`}
      eventHandlers={{
        click: () => onSelect(idx),
        dragend: (e) => {
          const marker = e.target;
          const { lat, lng } = marker.getLatLng();
          onDragEndMarker(idx, lat, lng);
        },
      }}
      draggable
    >
      <Popup minWidth={200}>
        <EditablePopupContent wp={wp} idx={idx} onWaypointChange={onWaypointChange || (() => {})} />
      </Popup>
    </Marker>
  ));
}

function MapClickHandler({ 
  onAddWaypoint, 
  onToast, 
  bounds,
  customClickHandler,
  scanMode,
  areaName
}: { 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/overlay objects from map layers
  onAddWaypoint: (wp: any) => void; 
  onToast: (msg: string) => void; 
  bounds: [[number, number], [number, number]];
  customClickHandler?: ((lat: number, lng: number) => void) | null;
  scanMode?: boolean;
  areaName?: string;
}) {
  // Use a ref so the map click handler always sees the latest customClickHandler
  // without requiring a MapContainer remount
  const customClickHandlerRef = useRef(customClickHandler);
  useEffect(() => {
    customClickHandlerRef.current = customClickHandler;
  }, [customClickHandler]);

  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      // Check if point is within service bounds
      const isWithinBounds = 
        e.latlng.lat >= bounds[0][0] &&
        e.latlng.lat <= bounds[1][0] &&
        e.latlng.lng >= bounds[0][1] &&
        e.latlng.lng <= bounds[1][1];
      
      // TASK-054: Use dynamic area name in error messages
      const displayName = areaName || 'service area';
      
      // TASK-215: When in SCAN mode, only use custom handler - NEVER add manual waypoints
      if (scanMode) {
        const handler = customClickHandlerRef.current;
        if (handler) {
          if (isWithinBounds) {
            handler(e.latlng.lat, e.latlng.lng);
          } else {
            onToast(`Point must be within the ${displayName}.`);
          }
        }
        // In SCAN mode without a handler, do nothing (user needs to complete current step)
        return;
      }
      
      // Default behavior (manual mode): add waypoint
      if (isWithinBounds) {
        onAddWaypoint({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          type: "cruise",
          altitude: 100,
          speed: 5,
          pauseDuration: 0,
          flyOverMode: false,
        });
      } else {
        onToast(`Waypoints must be within the ${displayName}.`);
      }
    },
  });
  return null;
}

// TASK-152: Create overlay polygon that covers world except service area (creates mask effect)
function createServiceAreaMask(bounds: [[number, number], [number, number]]): [number, number][][] {
  // Outer ring: world bounds (clockwise)
  const outer: [number, number][] = WORLD_BOUNDS;
  
  // Inner ring: service area bounds (counter-clockwise to create hole)
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  const inner: [number, number][] = [
    [minLat, minLng],
    [maxLat, minLng],
    [maxLat, maxLng],
    [minLat, maxLng],
  ];
  
  return [outer, inner];
}

// Reusable popup content for SCAN overlay markers (takeoff, landing, vertex)
function ScanPopupContent({ title, subtitle, lat, lng, onCommit }: {
  title: string;
  subtitle?: React.ReactNode;
  lat: number;
  lng: number;
  onCommit: (lat: number, lng: number) => void;
}) {
  const { t } = useI18n();
  const map = useMap();
  const [localLat, setLocalLat] = React.useState(lat.toFixed(7));
  const [localLng, setLocalLng] = React.useState(lng.toFixed(7));

  React.useEffect(() => {
    setLocalLat(lat.toFixed(7));
    setLocalLng(lng.toFixed(7));
  }, [lat, lng]);

  const handleOk = () => {
    const parsedLat = parseFloat(localLat);
    const parsedLng = parseFloat(localLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      onCommit(parsedLat, parsedLng);
    }
    map.closePopup();
  };

  return (
    <div className="min-w-[170px]">
      <div className={popupTitle}>
        {title}
        {subtitle}
      </div>
      <PopupInput label={t.planGenerator.latitude} type="text" value={localLat}
        onChange={(e) => setLocalLat(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); }} />
      <PopupInput label={t.planGenerator.longitude} type="text" value={localLng}
        onChange={(e) => setLocalLng(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleOk(); }} />
      <div className={popupFooter}>
        <button type="button" onClick={handleOk} className={popupOk}>
          OK
        </button>
      </div>
    </div>
  );
}

// SCAN Pattern Overlays Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/overlay objects from map layers
function ScanOverlays({ scanOverlays, onDragEnd }: { scanOverlays: any; onDragEnd?: (type: 'takeoff' | 'landing' | 'vertex', index: number, lat: number, lng: number) => void }) {
  const { t } = useI18n();
  if (!scanOverlays) return null;
  
  const { takeoffPoint, landingPoint, polygonVertices, polygonClosed, previewWaypoints } = scanOverlays;
  
  // Create custom icons for takeoff and landing
  const takeoffIcon = L.divIcon({
    className: "scan-takeoff-marker",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${MAP_COLORS.takeoff};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${MARKER_SHADOW};
      ">
        <span style="color: white; font-size: 16px;">🛫</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  
  const landingIcon = L.divIcon({
    className: "scan-landing-marker",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${MAP_COLORS.landing};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${MARKER_SHADOW};
      ">
        <span style="color: white; font-size: 16px;">🛬</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  
  // Create vertex icon for polygon vertices
  const createVertexIcon = (index: number, isFirst: boolean) => L.divIcon({
    className: "scan-vertex-marker",
    html: `
      <div style="
        width: ${isFirst ? '28px' : '24px'};
        height: ${isFirst ? '28px' : '24px'};
        background: ${isFirst ? MAP_COLORS.flyOver : MAP_COLORS.scanVertex};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isFirst ? '12px' : '10px'};
        box-shadow: ${MARKER_SHADOW};
      " class="${isFirst ? 'animate-pulse motion-reduce:animate-none' : ''}">
        ${index + 1}
      </div>
    `,
    iconSize: [isFirst ? 28 : 24, isFirst ? 28 : 24],
    iconAnchor: [isFirst ? 14 : 12, isFirst ? 14 : 12],
  });

  // Preview waypoint icon (smaller, gray)
  const createPreviewIcon = (index: number, total: number) => L.divIcon({
    className: "scan-preview-marker",
    html: `
      <div style="
        width: 16px;
        height: 16px;
        background: ${index === 0 ? MAP_COLORS.takeoff : index === total - 1 ? MAP_COLORS.landing : MAP_COLORS.scanPreview};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: ${MARKER_SHADOW};
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  
  return (
    <>
      {/* Takeoff Point Marker */}
      {takeoffPoint && (
        <Marker
          position={[takeoffPoint.lat, takeoffPoint.lng]}
          icon={takeoffIcon}
          draggable={!!onDragEnd}
          eventHandlers={onDragEnd ? {
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onDragEnd('takeoff', 0, lat, lng);
            },
          } : undefined}
        >
          <Popup minWidth={180}>
            <ScanPopupContent
              title={t.planGenerator.takeoffPointLabel}
              lat={takeoffPoint.lat}
              lng={takeoffPoint.lng}
              onCommit={(lat, lng) => onDragEnd?.('takeoff', 0, lat, lng)}
            />
          </Popup>
        </Marker>
      )}
      
      {/* Landing Point Marker */}
      {landingPoint && (
        <Marker
          position={[landingPoint.lat, landingPoint.lng]}
          icon={landingIcon}
          draggable={!!onDragEnd}
          eventHandlers={onDragEnd ? {
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onDragEnd('landing', 0, lat, lng);
            },
          } : undefined}
        >
          <Popup minWidth={180}>
            <ScanPopupContent
              title={t.planGenerator.landingPointLabel}
              lat={landingPoint.lat}
              lng={landingPoint.lng}
              onCommit={(lat, lng) => onDragEnd?.('landing', 0, lat, lng)}
            />
          </Popup>
        </Marker>
      )}
      
      {/* Polygon Vertices */}
      {polygonVertices && polygonVertices.length > 0 && (
        <>
          {/* Polygon fill (if closed) */}
          {polygonClosed && polygonVertices.length >= 3 && (
            <Polygon
              positions={polygonVertices.map((v: Point) => [v.lat, v.lng])}
              pathOptions={{
                color: MAP_COLORS.scanArea,
                weight: 2,
                fillColor: MAP_COLORS.scanArea,
                fillOpacity: 0.15,
                dashArray: polygonClosed ? undefined : "5 5",
              }}
            />
          )}
          
          {/* Polygon outline (if not closed, show as polyline) */}
          {!polygonClosed && polygonVertices.length >= 2 && (
            <Polyline
              positions={polygonVertices.map((v: Point) => [v.lat, v.lng])}
              pathOptions={{
                color: MAP_COLORS.scanArea,
                weight: 2,
                dashArray: "5 5",
              }}
            />
          )}
          
          {/* Vertex markers */}
          {polygonVertices.map((v: Point, idx: number) => (
            <Marker
              key={`vertex-${idx}`}
              position={[v.lat, v.lng]}
              icon={createVertexIcon(idx, idx === 0 && !polygonClosed && polygonVertices.length >= 3)}
              draggable={!!onDragEnd}
              eventHandlers={onDragEnd ? {
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  onDragEnd('vertex', idx, lat, lng);
                },
              } : undefined}
            >
              <Popup minWidth={180}>
                <ScanPopupContent
                  title={`${t.planGenerator.vertex} ${idx + 1}`}
                  subtitle={idx === 0 && !polygonClosed && polygonVertices.length >= 3 ? (
                    <div className="mt-0.5 text-[11px] font-normal text-muted">{t.planGenerator.clickNearToClose}</div>
                  ) : undefined}
                  lat={v.lat}
                  lng={v.lng}
                  onCommit={(lat, lng) => onDragEnd?.('vertex', idx, lat, lng)}
                />
              </Popup>
            </Marker>
          ))}
        </>
      )}
      
      {/* Preview Waypoints Polyline */}
      {previewWaypoints && previewWaypoints.length > 1 && (
        <Polyline
          positions={previewWaypoints.map((wp: ScanWaypoint) => [wp.lat, wp.lng])}
          pathOptions={{
            color: MAP_COLORS.scanPreview,
            weight: 3,
            opacity: 0.8,
          }}
        />
      )}
      
      {/* Preview Waypoint Markers (smaller, just dots) */}
      {previewWaypoints && previewWaypoints.length > 0 && (
        <>
          {previewWaypoints.map((wp: ScanWaypoint, idx: number) => (
            <Marker
              key={`preview-${idx}`}
              position={[wp.lat, wp.lng]}
              icon={createPreviewIcon(idx, previewWaypoints.length)}
            >
              <Popup>
                <strong>{t.flightPlans.waypoint} {idx + 1}</strong><br />
                {t.flightPlans.typeLabel}: {wp.type}<br />
                {t.planGenerator.altitude}: {wp.altitude}m
              </Popup>
            </Marker>
          ))}
        </>
      )}
    </>
  );
}

interface PlanMapProps {
  center: [number, number];
  bounds: [[number, number], [number, number]];
  polylinePositions: [number, number][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/overlay objects from map layers
  handleAddWaypoint: (wp: any) => void;
  setToast: (msg: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/overlay objects from map layers
  waypoints: any[];
  setSelectedIdx: (idx: number) => void;
  handleMarkerDragEnd: (idx: number, lat: number, lng: number) => void;
  // TASK-12: Waypoint editing in map popup
  onWaypointChange?: (idx: number, field: WaypointField, value: number | boolean) => void;
  // SCAN mode props
  scanMode?: boolean;
  scanOverlays?: {
    takeoffPoint: Point | null;
    landingPoint: Point | null;
    polygonVertices: Point[];
    polygonClosed: boolean;
    previewWaypoints: ScanWaypoint[];
    scanAngle: number;
  };
  customClickHandler?: ((lat: number, lng: number) => void) | null;
  // TASK-051: Geozone layer props
  geozonesData?: GeozoneData[];
  geozonesVisible?: boolean;
  onGeozoneClick?: (geozone: GeozoneData, event: L.LeafletMouseEvent) => void;
  // TASK-054/056: U-space name for display
  uspaceName?: string;
  // TASK-089: WebSocket connection status for geoawareness
  wsStatus?: WebSocketStatus;
  onReconnect?: () => void;
  // TASK-14: Scan overlay marker drag callback
  onScanOverlayDragEnd?: (type: 'takeoff' | 'landing' | 'vertex', index: number, lat: number, lng: number) => void;
  // TASK-3: Fly to a position when a waypoint is added from the sidebar
  flyToPosition?: [number, number] | null;
}

// TASK-3: Component to fly the map to a given position
function FlyToHandler({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 16));
    }
  }, [position, map]);
  return null;
}

const WS_LABEL: Record<WebSocketStatus, string> = {
  connected: "Live",
  connecting: "Connecting...",
  error: "Error ↻",
  disconnected: "Offline ↻",
};
const WS_TITLE: Record<WebSocketStatus, string> = {
  connected: "Geoawareness service connected",
  connecting: "Connecting to geoawareness service...",
  error: "Connection error - Click to retry",
  disconnected: "Disconnected - Click to reconnect",
};
const WS_TONE: Record<WebSocketStatus, { dot: string; text: string }> = {
  connected: { dot: "bg-success", text: "text-success-text" },
  connecting: { dot: "bg-warning animate-pulse motion-reduce:animate-none", text: "text-warning-text" },
  error: { dot: "bg-danger", text: "text-danger-text" },
  disconnected: { dot: "bg-line-2", text: "text-muted" },
};

// TASK-089: connection status of the geoawareness stream. The state is always written out (not only a colored
// dot); in the error/offline states it is a real button that retries.
function WsStatusBadge({ status, onReconnect }: { status: WebSocketStatus; onReconnect?: () => void }) {
  const ref = useRef<HTMLButtonElement | HTMLDivElement>(null);
  // Clicks on this overlay must not reach the map (they would add a waypoint under it)
  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);
  const tone = WS_TONE[status];
  const cls = "absolute right-2.5 top-2.5 z-[1000] flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 shadow-theme-md";
  const content = (
    <>
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span className={`text-[11px] font-medium ${tone.text}`}>{WS_LABEL[status]}</span>
    </>
  );
  if ((status === "error" || status === "disconnected") && onReconnect) {
    return (
      <button
        type="button"
        ref={ref as React.RefObject<HTMLButtonElement>}
        onClick={onReconnect}
        title={WS_TITLE[status]}
        aria-label={WS_TITLE[status]}
        className={`${cls} cursor-pointer hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring`}
      >
        {content}
      </button>
    );
  }
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} role="status" title={WS_TITLE[status]} className={cls}>
      {content}
    </div>
  );
}

const PlanMap = (props: PlanMapProps) => {
  const bounds = props.bounds as [[number, number], [number, number]];
  const maskPolygon = createServiceAreaMask(bounds);
  
  // TASK-051: State for selected geozone popup
  const [selectedGeozone, setSelectedGeozone] = useState<GeozoneData | null>(null);
  const [popupPosition, setPopupPosition] = useState<L.LatLngExpression | null>(null);
  
  // TASK-051: Handle geozone click - show info popup
  const handleGeozoneClick = (geozone: GeozoneData, event: L.LeafletMouseEvent) => {
    setSelectedGeozone(geozone);
    setPopupPosition(event.latlng);
    // Also call external handler if provided
    props.onGeozoneClick?.(geozone, event);
  };
  
  // Close popup handler
  const handleClosePopup = () => {
    setSelectedGeozone(null);
    setPopupPosition(null);
  };
  
  return (
    <MapContainer
      center={props.center as [number, number]}
      zoom={13}
      bounds={bounds}
      maxBounds={bounds}
      className="h-full w-full"
      style={{ height: "100%", minHeight: 400 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* TASK-152: Semi-transparent overlay outside service area */}
      <Polygon
        positions={maskPolygon}
        pathOptions={{
          fillColor: MAP_COLORS.mask,
          fillOpacity: 0.4,
          stroke: false,
        }}
      />
      
      {/* TASK-151: Service area rectangle with dashed border and subtle fill */}
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: MAP_COLORS.serviceArea,
          weight: 3,
          dashArray: "8 6",
          fillColor: MAP_COLORS.serviceArea,
          fillOpacity: 0.08,
        }}
      />
      
      {/* TASK-051: Geozone layer - rendered between bounds and waypoints */}
      {props.geozonesData && props.geozonesData.length > 0 && (
        <GeozoneLayer
          geozones={props.geozonesData}
          visible={props.geozonesVisible !== false}
          onGeozoneClick={handleGeozoneClick}
          fillOpacity={0.2}
          hoverFillOpacity={0.4}
        />
      )}
      
      {/* TASK-051: Geozone info popup */}
      {selectedGeozone && popupPosition && (
        <GeozoneInfoPopup
          geozone={selectedGeozone}
          position={popupPosition}
          onClose={handleClosePopup}
        />
      )}
      
      {/* SCAN Mode Overlays */}
      {props.scanMode && props.scanOverlays && (
        <ScanOverlays scanOverlays={props.scanOverlays} onDragEnd={props.onScanOverlayDragEnd} />
      )}
      
      {/* Regular waypoints (only in manual mode) */}
      {!props.scanMode && (
        <>
          {/* Polyline to connect waypoints */}
          {props.polylinePositions.length > 1 ? (
            <Polyline
              positions={props.polylinePositions as [number, number][]}
              pathOptions={{ color: MAP_COLORS.route, weight: 4 }}
            />
          ) : null}
          {/* Waypoint markers with selection and drag */}
          <WaypointMarkers waypoints={props.waypoints} onSelect={props.setSelectedIdx} onDragEndMarker={props.handleMarkerDragEnd} onWaypointChange={props.onWaypointChange} />
        </>
      )}
      
      {/* TASK-056: U-space name label overlay */}
      {props.uspaceName && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-[1000] -translate-x-1/2">
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border-2 border-dashed border-warning bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-warning-text shadow-theme-md">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {props.uspaceName}
          </div>
        </div>
      )}

      {/* TASK-089: WebSocket connection status indicator */}
      {props.wsStatus && <WsStatusBadge status={props.wsStatus} onReconnect={props.onReconnect} />}

      {/* TASK-3: Fly to position when waypoint added from sidebar */}
      {props.flyToPosition && <FlyToHandler position={props.flyToPosition} />}

      {/* Map click handler */}
      <MapClickHandler 
        onAddWaypoint={props.handleAddWaypoint} 
        onToast={props.setToast} 
        bounds={bounds}
        customClickHandler={props.customClickHandler}
        scanMode={props.scanMode}
        areaName={props.uspaceName}
      />
    </MapContainer>
  );
};

export default PlanMap; 