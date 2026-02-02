/**
 * UspaceSelector Component
 * TASK-042: Interactive map for selecting U-spaces
 *
 * Features:
 * - Displays all available U-spaces as polygons on a map
 * - Click on a U-space to select it
 * - Centers map and highlights the selected U-space
 * - Returns the selected uspace_identifier to parent component
 */

"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useUspaces, USpace } from "@/app/hooks/useUspaces";
import { Loader2, MapPin, RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Calculate the approximate area of a polygon using the Shoelace formula
 * Used for sorting polygons so smaller ones are rendered on top
 */
function calculatePolygonArea(boundary: { latitude: number; longitude: number }[]): number {
  if (boundary.length < 3) return 0;
  
  let area = 0;
  const n = boundary.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += boundary[i].longitude * boundary[j].latitude;
    area -= boundary[j].longitude * boundary[i].latitude;
  }
  
  return Math.abs(area / 2);
}

/**
 * Colors for U-space polygons
 */
const USPACE_COLORS = {
  default: {
    color: "#3b82f6", // blue border
    fillColor: "#3b82f6",
    fillOpacity: 0.15,
    weight: 2,
  },
  hover: {
    color: "#2563eb",
    fillColor: "#3b82f6",
    fillOpacity: 0.3,
    weight: 3,
  },
  selected: {
    color: "#f97316", // orange border
    fillColor: "#f97316",
    fillOpacity: 0.25,
    weight: 3,
  },
};

interface UspaceSelectorProps {
  /** Callback when a U-space is selected */
  onSelect: (uspace: USpace) => void;
  /** Currently selected U-space ID (for highlighting) */
  selectedUspaceId?: string | null;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Component to fit map bounds to show all U-spaces
 */
function FitBoundsToUspaces({
  uspaces,
  selectedUspaceId,
}: {
  uspaces: USpace[];
  selectedUspaceId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (uspaces.length === 0) return;

    // If a U-space is selected, zoom to it
    if (selectedUspaceId) {
      const selectedUspace = uspaces.find((u) => u.id === selectedUspaceId);
      if (selectedUspace && selectedUspace.boundary.length > 0) {
        const bounds = L.latLngBounds(
          selectedUspace.boundary.map((p) => [p.latitude, p.longitude])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        return;
      }
    }

    // Otherwise, fit to all U-spaces
    const allPoints: [number, number][] = uspaces.flatMap((uspace) =>
      uspace.boundary.map((p) => [p.latitude, p.longitude] as [number, number])
    );

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, uspaces, selectedUspaceId]);

  return null;
}

/**
 * Individual U-space polygon with hover and click behavior
 * Uses bringToFront on hover to ensure the hovered polygon is always clickable
 */
function UspacePolygon({
  uspace,
  isSelected,
  onSelect,
}: {
  uspace: USpace;
  isSelected: boolean;
  onSelect: (uspace: USpace) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const polygonRef = useRef<L.Polygon | null>(null);

  const positions: [number, number][] = useMemo(
    () =>
      uspace.boundary.map((p) => [p.latitude, p.longitude] as [number, number]),
    [uspace.boundary]
  );

  // Get path options based on state
  const pathOptions = useMemo(() => {
    if (isSelected) return USPACE_COLORS.selected;
    if (isHovered) return USPACE_COLORS.hover;
    return USPACE_COLORS.default;
  }, [isSelected, isHovered]);

  if (positions.length === 0) return null;

  return (
    <Polygon
      ref={polygonRef}
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={{
        click: () => onSelect(uspace),
        mouseover: () => {
          setIsHovered(true);
          // Bring this polygon to front so it's always clickable on hover
          if (polygonRef.current) {
            polygonRef.current.bringToFront();
          }
        },
        mouseout: () => setIsHovered(false),
      }}
    >
      <Popup>
        <div className="min-w-[150px]">
          <h3 className="font-semibold text-sm mb-1">{uspace.name}</h3>
          <p className="text-xs text-gray-600 mb-2">ID: {uspace.id}</p>
          <button
            onClick={() => onSelect(uspace)}
            className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Select this U-space
          </button>
        </div>
      </Popup>
    </Polygon>
  );
}

/**
 * UspaceSelector - Main component for selecting a U-space from a map
 */
export function UspaceSelector({
  onSelect,
  selectedUspaceId,
  className = "",
}: UspaceSelectorProps) {
  const { uspaces, loading, error, refetch, isRefetching } = useUspaces();

  // Default center (Europe) - will be overridden by fitBounds
  const defaultCenter: [number, number] = [39.47, -0.38];
  const defaultZoom = 6;

  // Loading state
  if (loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[400px] bg-[var(--bg-secondary)] rounded-lg ${className}`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-3" />
        <p className="text-[var(--text-secondary)] text-sm">
          Loading U-spaces...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[400px] bg-[var(--bg-secondary)] rounded-lg p-6 ${className}`}
      >
        <AlertTriangle className="w-10 h-10 text-yellow-500 mb-3" />
        <p className="text-[var(--text-primary)] font-medium mb-2">
          Failed to load U-spaces
        </p>
        <p className="text-[var(--text-tertiary)] text-sm text-center mb-4">
          {error.message}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-hover)] disabled:opacity-60 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
          />
          {isRefetching ? "Retrying..." : "Try Again"}
        </button>
      </div>
    );
  }

  // Empty state
  if (uspaces.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-[400px] bg-[var(--bg-secondary)] rounded-lg p-6 ${className}`}
      >
        <MapPin className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
        <p className="text-[var(--text-primary)] font-medium mb-2">
          No U-spaces available
        </p>
        <p className="text-[var(--text-tertiary)] text-sm text-center">
          There are no U-spaces configured in the geoawareness service.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="absolute top-3 left-3 z-[1000] bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Select a U-space
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            ({uspaces.length} available)
          </span>
        </div>
      </div>

      {/* Refresh button */}
      <button
        onClick={() => refetch()}
        disabled={isRefetching}
        className="absolute top-3 right-3 z-[1000] bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-md p-2 shadow-md border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-60"
        title="Refresh U-spaces"
      >
        <RefreshCw
          className={`w-4 h-4 text-[var(--text-secondary)] ${
            isRefetching ? "animate-spin" : ""
          }`}
        />
      </button>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-[var(--border-primary)]">
        <div className="text-xs text-[var(--text-tertiary)] mb-1">Legend</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-blue-500/20 border-2 border-blue-500 rounded-sm" />
            <span className="text-xs text-[var(--text-secondary)]">
              Available
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-orange-500/25 border-2 border-orange-500 rounded-sm" />
            <span className="text-xs text-[var(--text-secondary)]">
              Selected
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-[400px] w-full rounded-lg"
        style={{ height: "400px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fit bounds to U-spaces */}
        <FitBoundsToUspaces
          uspaces={uspaces}
          selectedUspaceId={selectedUspaceId}
        />

        {/* U-space polygons - sorted by area (largest first) so smallest render on top */}
        {[...uspaces]
          .sort((a, b) => calculatePolygonArea(b.boundary) - calculatePolygonArea(a.boundary))
          .map((uspace) => (
            <UspacePolygon
              key={uspace.id}
              uspace={uspace}
              isSelected={uspace.id === selectedUspaceId}
              onSelect={onSelect}
            />
          ))}
      </MapContainer>
    </div>
  );
}

export default UspaceSelector;
