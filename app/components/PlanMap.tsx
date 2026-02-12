"use client";
import React, { useState } from "react";
import { MapContainer, TileLayer, Polyline, Rectangle, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Point, ScanWaypoint } from "@/lib/scan-generator";
import { GeozoneLayer } from "./plan-generator/GeozoneLayer";
import { GeozoneInfoPopup } from "./plan-generator/GeozoneInfoPopup";
import { useI18n } from "@/app/i18n";
import type { GeozoneData, WebSocketStatus } from "@/app/hooks/useGeoawarenessWebSocket";

// TASK-152: Large bounds for overlay outside service area (covers the world)
const WORLD_BOUNDS: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];

// TASK-125: Helper to format pause duration for display
function formatPauseDuration(seconds: number): string {
  if (seconds === 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// TASK-125 & TASK-129: Create custom icon with pause and fly-over indicators
function createWaypointIcon(wp: any, idx: number): L.DivIcon {
  const hasPause = wp.pauseDuration && wp.pauseDuration > 0;
  const pauseText = hasPause ? formatPauseDuration(wp.pauseDuration) : "";
  const isFlyOver = wp.flyOverMode && wp.type === "cruise"; // TASK-129: Only cruise waypoints can be fly-over
  
  // Color based on waypoint type
  // TASK-129: Fly-over waypoints get purple color to distinguish from regular cruise
  const typeColors: Record<string, string> = {
    takeoff: "#22c55e", // green
    cruise: "#3b82f6",  // blue
    landing: "#ef4444", // red
  };
  const color = isFlyOver ? "#a855f7" : (typeColors[wp.type] || "#3b82f6"); // purple for fly-over
  
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
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
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
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
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
            background: #f97316;
            color: white;
            font-size: 9px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 8px;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          ">⏱ ${pauseText}</div>
        ` : ""}
        ${isFlyOver ? `
          <div style="
            position: absolute;
            bottom: -12px;
            background: #a855f7;
            color: white;
            font-size: 8px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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

function EditablePopupContent({ wp, idx, onWaypointChange }: {
  wp: PopupWaypoint;
  idx: number;
  onWaypointChange: (idx: number, field: WaypointField, value: number | boolean) => void;
}) {
  const { t } = useI18n();
  const [localLat, setLocalLat] = React.useState(wp.lat.toString());
  const [localLng, setLocalLng] = React.useState(wp.lng.toString());
  
  React.useEffect(() => {
    setLocalLat(wp.lat.toFixed(7));
    setLocalLng(wp.lng.toFixed(7));
  }, [wp.lat, wp.lng]);
  
  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '12px', padding: '2px 4px',
    border: '1px solid var(--border-primary, #ccc)', borderRadius: '3px', boxSizing: 'border-box',
    backgroundColor: 'var(--input-bg, #fff)', color: 'var(--text-primary, #000)',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '1px', color: 'var(--text-secondary, #555)',
  };
  const rowStyle: React.CSSProperties = { marginBottom: '5px' };
  const typeColor = wp.type === 'takeoff' ? '#22c55e' : wp.type === 'landing' ? '#ef4444' : '#3b82f6';

  return (
    <div style={{ minWidth: '190px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '13px', borderBottom: '1px solid var(--border-primary, #eee)', paddingBottom: '4px', color: 'var(--text-primary, #000)' }}>
        {t.flightPlans.waypoint} {idx + 1} <span style={{ color: typeColor, textTransform: 'capitalize' }}>({wp.type})</span>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>{t.planGenerator.latitude}</label>
        <input type="text" value={localLat}
          onChange={(e) => setLocalLat(e.target.value)}
          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { onWaypointChange(idx, 'lat', v); } else { setLocalLat(wp.lat.toFixed(7)); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={inputStyle} />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>{t.planGenerator.longitude}</label>
        <input type="text" value={localLng}
          onChange={(e) => setLocalLng(e.target.value)}
          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { onWaypointChange(idx, 'lng', v); } else { setLocalLng(wp.lng.toFixed(7)); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={inputStyle} />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>{t.planGenerator.altitude} (m)</label>
        <input type="number" min={0} value={wp.altitude}
          onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onWaypointChange(idx, 'altitude', v); }}
          disabled={wp.type === 'landing'}
          style={{ ...inputStyle, ...(wp.type === 'landing' ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }} />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>{t.planGenerator.speed} (m/s)</label>
        <input type="number" min={0} step="0.1" value={wp.speed}
          onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onWaypointChange(idx, 'speed', v); }}
          style={inputStyle} />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>{t.planGenerator.pause} (s)</label>
        <input type="number" min={0} max={3600} value={wp.pauseDuration || 0}
          onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onWaypointChange(idx, 'pauseDuration', v); }}
          style={inputStyle} />
      </div>
      {wp.type === 'cruise' && (
        <div style={{ marginTop: '4px' }}>
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" checked={wp.flyOverMode || false}
              onChange={(e) => onWaypointChange(idx, 'flyOverMode', e.target.checked)} />
            <span style={{ fontWeight: 'bold', color: 'var(--text-secondary, #555)' }}>{t.planGenerator.flyOver}</span>
            <span style={{ color: wp.flyOverMode ? '#a855f7' : '#3b82f6', fontSize: '12px' }}>
              {wp.flyOverMode ? '⊙ Over' : '∽ By'}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function WaypointMarkers({ waypoints, onSelect, onDragEndMarker, onWaypointChange }: { waypoints: PopupWaypoint[]; onSelect: (idx: number) => void; onDragEndMarker: (idx: number, lat: number, lng: number) => void; onWaypointChange?: (idx: number, field: WaypointField, value: number | boolean) => void; }) {
  return waypoints.map((wp, idx) => (
    <Marker
      key={idx}
      position={[wp.lat, wp.lng]}
      icon={createWaypointIcon(wp, idx)}
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
  onAddWaypoint: (wp: any) => void; 
  onToast: (msg: string) => void; 
  bounds: [[number, number], [number, number]];
  customClickHandler?: ((lat: number, lng: number) => void) | null;
  scanMode?: boolean;
  areaName?: string;
}) {
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
        if (customClickHandler) {
          if (isWithinBounds) {
            customClickHandler(e.latlng.lat, e.latlng.lng);
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

// SCAN Pattern Overlays Component
function ScanOverlays({ scanOverlays, onDragEnd }: { scanOverlays: any; onDragEnd?: (type: 'takeoff' | 'landing' | 'vertex', index: number, lat: number, lng: number) => void }) {
  const { t } = useI18n();
  if (!scanOverlays) return null;
  
  const { takeoffPoint, landingPoint, polygonVertices, polygonClosed, previewWaypoints } = scanOverlays;

  const coordLabelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '1px', color: 'var(--text-secondary, #555)',
  };
  const coordInputStyle: React.CSSProperties = {
    width: '100%', fontSize: '12px', padding: '2px 4px',
    border: '1px solid var(--border-primary, #ccc)', borderRadius: '3px', boxSizing: 'border-box',
    backgroundColor: 'var(--input-bg, #fff)', color: 'var(--text-primary, #000)',
  };
  
  // Create custom icons for takeoff and landing
  const takeoffIcon = L.divIcon({
    className: "scan-takeoff-marker",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: #22c55e;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
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
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
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
        background: ${isFirst ? '#a855f7' : '#8b5cf6'};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isFirst ? '12px' : '10px'};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ${isFirst ? 'animation: pulse 1.5s infinite;' : ''}
      ">
        ${index + 1}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      </style>
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
        background: ${index === 0 ? '#22c55e' : index === total - 1 ? '#ef4444' : '#6366f1'};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
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
            <div style={{ minWidth: '170px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '13px', borderBottom: '1px solid var(--border-primary, #eee)', paddingBottom: '4px', color: 'var(--text-primary, #000)' }}>
                {t.planGenerator.takeoffPointLabel}
              </div>
              <div style={{ marginBottom: '4px' }}>
                <label style={coordLabelStyle}>{t.planGenerator.latitude}</label>
                <input type="number" step="any" defaultValue={takeoffPoint.lat}
                  onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && onDragEnd) onDragEnd('takeoff', 0, v, takeoffPoint.lng); }}
                  style={coordInputStyle} />
              </div>
              <div>
                <label style={coordLabelStyle}>{t.planGenerator.longitude}</label>
                <input type="number" step="any" defaultValue={takeoffPoint.lng}
                  onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && onDragEnd) onDragEnd('takeoff', 0, takeoffPoint.lat, v); }}
                  style={coordInputStyle} />
              </div>
            </div>
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
            <div style={{ minWidth: '170px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '13px', borderBottom: '1px solid var(--border-primary, #eee)', paddingBottom: '4px', color: 'var(--text-primary, #000)' }}>
                {t.planGenerator.landingPointLabel}
              </div>
              <div style={{ marginBottom: '4px' }}>
                <label style={coordLabelStyle}>{t.planGenerator.latitude}</label>
                <input type="number" step="any" defaultValue={landingPoint.lat}
                  onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && onDragEnd) onDragEnd('landing', 0, v, landingPoint.lng); }}
                  style={coordInputStyle} />
              </div>
              <div>
                <label style={coordLabelStyle}>{t.planGenerator.longitude}</label>
                <input type="number" step="any" defaultValue={landingPoint.lng}
                  onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && onDragEnd) onDragEnd('landing', 0, landingPoint.lat, v); }}
                  style={coordInputStyle} />
              </div>
            </div>
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
                color: "#a855f7",
                weight: 2,
                fillColor: "#a855f7",
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
                color: "#a855f7",
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
                <div style={{ minWidth: '170px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '13px', borderBottom: '1px solid var(--border-primary, #eee)', paddingBottom: '4px', color: 'var(--text-primary, #000)' }}>
                    {t.planGenerator.vertex} {idx + 1}
                    {idx === 0 && !polygonClosed && polygonVertices.length >= 3 && (
                      <div style={{color: '#a855f7', fontSize: '11px', fontWeight: 'normal', marginTop: '2px'}}>{t.planGenerator.clickNearToClose}</div>
                    )}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <label style={coordLabelStyle}>{t.planGenerator.latitude}</label>
                    <input type="number" step="any" defaultValue={v.lat}
                      onBlur={(e) => { const val = Number(e.target.value); if (!isNaN(val) && onDragEnd) onDragEnd('vertex', idx, val, v.lng); }}
                      style={coordInputStyle} />
                  </div>
                  <div>
                    <label style={coordLabelStyle}>{t.planGenerator.longitude}</label>
                    <input type="number" step="any" defaultValue={v.lng}
                      onBlur={(e) => { const val = Number(e.target.value); if (!isNaN(val) && onDragEnd) onDragEnd('vertex', idx, v.lat, val); }}
                      style={coordInputStyle} />
                  </div>
                </div>
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
            color: "#6366f1",
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
  handleAddWaypoint: (wp: any) => void;
  setToast: (msg: string) => void;
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
          fillColor: "#000000",
          fillOpacity: 0.4,
          stroke: false,
        }}
      />
      
      {/* TASK-151: Service area rectangle with dashed border and subtle fill */}
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: "#f59e42",
          weight: 3,
          dashArray: "8 6",
          fillColor: "#f59e42",
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
              pathOptions={{ color: "#2563eb", weight: 4 }}
            />
          ) : null}
          {/* Waypoint markers with selection and drag */}
          <WaypointMarkers waypoints={props.waypoints} onSelect={props.setSelectedIdx} onDragEndMarker={props.handleMarkerDragEnd} onWaypointChange={props.onWaypointChange} />
        </>
      )}
      
      {/* TASK-056: U-space name label overlay */}
      {props.uspaceName && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#f59e42',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              border: '2px dashed #f59e42',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            📍 {props.uspaceName}
          </div>
        </div>
      )}
      
      {/* TASK-089: WebSocket connection status indicator */}
      {props.wsStatus && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            padding: '6px 10px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            cursor: props.wsStatus === 'error' || props.wsStatus === 'disconnected' ? 'pointer' : 'default',
          }}
          onClick={() => {
            if ((props.wsStatus === 'error' || props.wsStatus === 'disconnected') && props.onReconnect) {
              props.onReconnect();
            }
          }}
          title={
            props.wsStatus === 'connected' ? 'Geoawareness service connected' :
            props.wsStatus === 'connecting' ? 'Connecting to geoawareness service...' :
            props.wsStatus === 'error' ? 'Connection error - Click to retry' :
            'Disconnected - Click to reconnect'
          }
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 
                props.wsStatus === 'connected' ? '#22c55e' :
                props.wsStatus === 'connecting' ? '#eab308' :
                props.wsStatus === 'error' ? '#ef4444' :
                '#6b7280',
              animation: props.wsStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <span
            style={{
              color: 
                props.wsStatus === 'connected' ? '#86efac' :
                props.wsStatus === 'connecting' ? '#fef08a' :
                props.wsStatus === 'error' ? '#fca5a5' :
                '#9ca3af',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            {props.wsStatus === 'connected' ? 'Live' :
             props.wsStatus === 'connecting' ? 'Connecting...' :
             props.wsStatus === 'error' ? 'Error ↻' :
             'Offline ↻'}
          </span>
        </div>
      )}
      
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