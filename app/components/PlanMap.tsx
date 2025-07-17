"use client";
import React from "react";
import { MapContainer, TileLayer, Polyline, Rectangle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";

function WaypointMarkers({ waypoints, onSelect, onDragEndMarker }: { waypoints: any[]; onSelect: (idx: number) => void; onDragEndMarker: (idx: number, lat: number, lng: number) => void; }) {
  return waypoints.map((wp, idx) => (
    <Marker
      key={idx}
      position={[wp.lat, wp.lng]}
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
        });
      } else {
        onToast("Waypoints must be within the FAS service area.");
      }
    },
  });
  return null;
}

const PlanMap = (props: any) => (
  <MapContainer
    center={props.center as [number, number]}
    zoom={13}
    bounds={props.bounds as [[number, number], [number, number]]}
    maxBounds={props.bounds as [[number, number], [number, number]]}
    className="h-full w-full"
    style={{ height: "100%", minHeight: 400 }}
  >
    <TileLayer
      attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <Rectangle
      bounds={props.bounds as [[number, number], [number, number]]}
      pathOptions={{ color: "#f59e42", weight: 2, dashArray: "6 6" }}
    />
    {/* Polyline to connect waypoints */}
    {props.polylinePositions.length > 1 ? (
      <Polyline
        positions={props.polylinePositions as [number, number][]}
        pathOptions={{ color: "#2563eb", weight: 4 }}
      />
    ) : null}
    {/* Map click handler for adding waypoints */}
    <MapClickHandler onAddWaypoint={props.handleAddWaypoint} onToast={props.setToast} bounds={props.bounds} />
    {/* Waypoint markers with selection and drag */}
    <WaypointMarkers waypoints={props.waypoints} onSelect={props.setSelectedIdx} onDragEndMarker={props.handleMarkerDragEnd} />
  </MapContainer>
);

export default PlanMap; 