/**
 * UspaceSelector Component
 * TASK-042: Interactive map for selecting U-spaces
 *
 * Features:
 * - Displays all available U-spaces as polygons on a map
 * - Click anywhere on the map to select the smallest U-space containing that point
 * - Centers map and highlights the selected U-space
 * - Returns the selected uspace_identifier to parent component
 */

"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useUspaces, USpace } from "@/app/hooks/useUspaces";
import { Loader2, MapPin, RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Calculate the approximate area of a polygon using the Shoelace formula
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
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(lat: number, lng: number, boundary: { latitude: number; longitude: number }[]): boolean {
  let inside = false;
  const n = boundary.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = boundary[i].latitude;
    const xi = boundary[i].longitude;
    const yj = boundary[j].latitude;
    const xj = boundary[j].longitude;
    
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Colors for U-space polygons
 */
const USPACE_COLORS = {
  default: {
    color: "#3b82f6",
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
    color: "#f97316",
    fillColor: "#f97316",
    fillOpacity: 0.25,
    weight: 3,
  },
};

interface UspaceSelectorProps {
  onSelect: (uspace: USpace) => void;
  selectedUspaceId?: string | null;
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
 * Component that handles map clicks and selects the smallest U-space containing the click point
 */
function MapClickHandler({
  uspaces,
  onSelect,
}: {
  uspaces: USpace[];
  onSelect: (uspace: USpace) => void;
}) {
  // Sort uspaces by area (smallest first) for priority selection
  const sortedUspaces = useMemo(() => {
    return [...uspaces].sort((a, b) => 
      calculatePolygonArea(a.boundary) - calculatePolygonArea(b.boundary)
    );
  }, [uspaces]);

  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      
      // Find ALL uspaces containing the click point
      const containingUspaces = sortedUspaces.filter(uspace => 
        isPointInPolygon(lat, lng, uspace.boundary)
      );
      
      // Select the smallest one (first in sorted list)
      if (containingUspaces.length > 0) {
        const smallestUspace = containingUspaces[0];
        console.log(`[UspaceSelector] Clicked at (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        console.log(`[UspaceSelector] Found ${containingUspaces.length} U-spaces containing this point`);
        console.log(`[UspaceSelector] Selecting smallest: ${smallestUspace.name} (area: ${calculatePolygonArea(smallestUspace.boundary).toFixed(6)})`);
        onSelect(smallestUspace);
      }
    },
  });

  return null;
}

/**
 * Individual U-space polygon with hover effect
 */
function UspacePolygon({
  uspace,
  isSelected,
  hoveredId,
  onHover,
}: {
  uspace: USpace;
  isSelected: boolean;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const isHovered = hoveredId === uspace.id;

  const positions: [number, number][] = useMemo(
    () => uspace.boundary.map((p) => [p.latitude, p.longitude] as [number, number]),
    [uspace.boundary]
  );

  const pathOptions = useMemo(() => {
    if (isSelected) return USPACE_COLORS.selected;
    if (isHovered) return USPACE_COLORS.hover;
    return USPACE_COLORS.default;
  }, [isSelected, isHovered]);

  if (positions.length === 0) return null;

  return (
    <Polygon
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={{
        mouseover: () => onHover(uspace.id),
        mouseout: () => onHover(null),
      }}
    />
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const defaultCenter: [number, number] = [39.47, -0.38];
  const defaultZoom = 6;

  // Sort uspaces by area (largest first) for rendering - smallest will be on top
  const sortedUspacesForRendering = useMemo(() => {
    return [...uspaces].sort((a, b) => 
      calculatePolygonArea(b.boundary) - calculatePolygonArea(a.boundary)
    );
  }, [uspaces]);

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center h-[400px] bg-[var(--bg-secondary)] rounded-lg ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-3" />
        <p className="text-[var(--text-secondary)] text-sm">Loading U-spaces...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-[400px] bg-[var(--bg-secondary)] rounded-lg p-6 ${className}`}>
        <AlertTriangle className="w-10 h-10 text-yellow-500 mb-3" />
        <p className="text-[var(--text-primary)] font-medium mb-2">Failed to load U-spaces</p>
        <p className="text-[var(--text-tertiary)] text-sm text-center mb-4">{error.message}</p>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-[var(--color-primary-hover)] disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
          {isRefetching ? "Retrying..." : "Try Again"}
        </button>
      </div>
    );
  }

  if (uspaces.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-[400px] bg-[var(--bg-secondary)] rounded-lg p-6 ${className}`}>
        <MapPin className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
        <p className="text-[var(--text-primary)] font-medium mb-2">No U-spaces available</p>
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
            Click on a U-space to select it
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
        <RefreshCw className={`w-4 h-4 text-[var(--text-secondary)] ${isRefetching ? "animate-spin" : ""}`} />
      </button>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-[var(--border-primary)]">
        <div className="text-xs text-[var(--text-tertiary)] mb-1">Legend</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-blue-500/20 border-2 border-blue-500 rounded-sm" />
            <span className="text-xs text-[var(--text-secondary)]">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-orange-500/25 border-2 border-orange-500 rounded-sm" />
            <span className="text-xs text-[var(--text-secondary)]">Selected</span>
          </div>
        </div>
      </div>

      {/* Hovered U-space name tooltip */}
      {hoveredId && (
        <div className="absolute top-14 left-3 z-[1000] bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-md px-3 py-1.5 shadow-md border border-[var(--border-primary)]">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {uspaces.find(u => u.id === hoveredId)?.name || hoveredId}
          </span>
        </div>
      )}

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

        <FitBoundsToUspaces uspaces={uspaces} selectedUspaceId={selectedUspaceId} />
        
        {/* Map click handler - selects smallest U-space at click point */}
        <MapClickHandler uspaces={uspaces} onSelect={onSelect} />

        {/* U-space polygons - sorted by area (largest first) so smallest render on top */}
        {sortedUspacesForRendering.map((uspace) => (
          <UspacePolygon
            key={uspace.id}
            uspace={uspace}
            isSelected={uspace.id === selectedUspaceId}
            hoveredId={hoveredId}
            onHover={handleHover}
          />
        ))}
      </MapContainer>
    </div>
  );
}

export default UspaceSelector;
