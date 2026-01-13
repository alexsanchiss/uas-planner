"use client";
import React from "react";
import { MapContainer, TileLayer, Polyline, Rectangle, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";

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

function WaypointMarkers({ waypoints, onSelect, onDragEndMarker }: { waypoints: any[]; onSelect: (idx: number) => void; onDragEndMarker: (idx: number, lat: number, lng: number) => void; }) {
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
      <Popup>
        <div>
          <div>
            <b>Type:</b> {wp.type}
          </div>
          <div>
            <b>Altitude:</b> {wp.altitude} m
          </div>
          <div>
            <b>Speed:</b> {wp.speed} m/s
          </div>
          {/* TASK-125: Display pause duration in popup */}
          {wp.pauseDuration > 0 && (
            <div>
              <b>Pause:</b> {formatPauseDuration(wp.pauseDuration)}
            </div>
          )}
          {/* TASK-129 & TASK-130: Display fly-over mode with explanation */}
          {wp.type === "cruise" && (
            <div>
              <b>Mode:</b>{" "}
              <span
                style={{ color: wp.flyOverMode ? "#a855f7" : "#3b82f6" }}
                title={
                  wp.flyOverMode
                    ? "Drone must pass directly over this waypoint (more precise)"
                    : "Drone smoothly curves past this waypoint (faster)"
                }
              >
                {wp.flyOverMode ? "⊙ Fly-Over" : "∽ Fly-By"}
              </span>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  ));
}

function MapClickHandler({ onAddWaypoint, onToast, bounds }: { onAddWaypoint: (wp: any) => void; onToast: (msg: string) => void; bounds: [[number, number], [number, number]]; }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      // Only add if within limits
      if (
        e.latlng.lat >= bounds[0][0] &&
        e.latlng.lat <= bounds[1][0] &&
        e.latlng.lng >= bounds[0][1] &&
        e.latlng.lng <= bounds[1][1]
      ) {
        onAddWaypoint({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          type: "cruise",
          altitude: 100,
          speed: 5,
          pauseDuration: 0, // TASK-121: Default pause duration
          flyOverMode: false, // TASK-126: Default fly-by mode
        });
      } else {
        onToast("Waypoints must be within the FAS service area.");
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

const PlanMap = (props: any) => {
  const bounds = props.bounds as [[number, number], [number, number]];
  const maskPolygon = createServiceAreaMask(bounds);
  
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
      
      {/* Polyline to connect waypoints */}
      {props.polylinePositions.length > 1 ? (
        <Polyline
          positions={props.polylinePositions as [number, number][]}
          pathOptions={{ color: "#2563eb", weight: 4 }}
        />
      ) : null}
      {/* Map click handler for adding waypoints */}
      <MapClickHandler onAddWaypoint={props.handleAddWaypoint} onToast={props.setToast} bounds={bounds} />
      {/* Waypoint markers with selection and drag */}
      <WaypointMarkers waypoints={props.waypoints} onSelect={props.setSelectedIdx} onDragEndMarker={props.handleMarkerDragEnd} />
    </MapContainer>
  );
};

export default PlanMap; 