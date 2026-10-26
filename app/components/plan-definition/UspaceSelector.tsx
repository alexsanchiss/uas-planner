/**
 * UspaceSelector Component
 * TASK-042: Interactive map for selecting U-spaces
 *
 * Features:
 * - Displays all available U-spaces as polygons on a map
 * - Click anywhere on the map to select the smallest U-space containing that point
 * - Centers map and highlights the selected U-space
 * - Returns the selected uspace_identifier to parent component
 * - Keyboard / screen-reader alternative: the same U-spaces as a filterable list next to the map
 */

"use client";

import React, { useEffect, useId, useMemo, useState, useCallback } from "react";
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
import { MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import { interpolate, useI18n } from "@/app/i18n";

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
 * Colors for U-space polygons. Leaflet path options and the legend swatches share them;
 * map layer colors are data colors (not UI chrome), so they are not theme tokens.
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
        // console.log(`[UspaceSelector] Clicked at (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        // console.log(`[UspaceSelector] Found ${containingUspaces.length} U-spaces containing this point`);
        // console.log(`[UspaceSelector] Selecting smallest: ${smallestUspace.name} (area: ${calculatePolygonArea(smallestUspace.boundary).toFixed(6)})`);
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

/** Skeleton with the final layout (map block + list rows) while the U-spaces load. */
function UspaceSelectorSkeleton({ className }: { className: string }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] ${className}`}>
      <span className="sr-only">{t.planDef.uspace.loading}</span>
      <div className="h-[26rem] animate-pulse rounded-lg bg-subtle lg:h-[34rem]" aria-hidden="true" />
      <div className="space-y-2" aria-hidden="true">
        <div className="h-9 animate-pulse rounded-md bg-subtle" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-subtle" />
        ))}
      </div>
    </div>
  );
}

const overlayBox = "rounded-md border border-line bg-surface px-3 py-2 shadow-theme-md";

/**
 * UspaceSelector - Main component for selecting a U-space from a map (or from the list next to it)
 */
export function UspaceSelector({
  onSelect,
  selectedUspaceId,
  className = "",
}: UspaceSelectorProps) {
  const { t } = useI18n();
  const us = t.planDef.uspace;
  const { uspaces, loading, error, refetch, isRefetching } = useUspaces();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filterId = useId();

  const defaultCenter: [number, number] = [39.47, -0.38];
  const defaultZoom = 6;

  // Sort uspaces by area (largest first) for rendering - smallest will be on top
  const sortedUspacesForRendering = useMemo(() => {
    return [...uspaces].sort((a, b) =>
      calculatePolygonArea(b.boundary) - calculatePolygonArea(a.boundary)
    );
  }, [uspaces]);

  // Alphabetical list for the keyboard alternative, narrowed by the filter box
  const listedUspaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...uspaces]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
  }, [uspaces, query]);

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  if (loading) return <UspaceSelectorSkeleton className={className} />;

  if (error) {
    return (
      <div role="alert" className={`flex h-[26rem] flex-col items-center justify-center rounded-lg border border-danger-line bg-danger-soft p-6 ${className}`}>
        <AlertTriangle className="mb-3 h-10 w-10 text-danger-text" aria-hidden="true" />
        <p className="mb-2 font-medium text-fg">{us.loadError}</p>
        <p className="mb-4 text-center text-sm text-fg-2">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn btn-primary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
          {isRefetching ? us.retrying : us.retry}
        </button>
      </div>
    );
  }

  if (uspaces.length === 0) {
    return (
      <div className={`flex h-[26rem] flex-col items-center justify-center rounded-lg border border-line bg-surface p-6 ${className}`}>
        <MapPin className="mb-3 h-10 w-10 text-muted" aria-hidden="true" />
        <p className="mb-2 font-medium text-fg">{us.noneTitle}</p>
        <p className="text-center text-sm text-muted">
          {us.noneBody}
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] ${className}`}>
      <div className="relative h-[26rem] overflow-hidden rounded-lg border border-line lg:h-[34rem]">
        {/* Header */}
        <div className={`absolute left-3 top-3 z-[1000] ${overlayBox}`}>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-text" aria-hidden="true" />
            <span className="text-sm font-medium text-fg">
              {us.clickToSelect}
            </span>
            <span className="text-xs text-muted">
              {interpolate(us.available, { n: uspaces.length })}
            </span>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          aria-label={us.refresh}
          title={us.refresh}
          className="absolute right-3 top-3 z-[1000] rounded-md border border-line bg-surface p-2 shadow-theme-md transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 text-fg-2 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>

        {/* Legend */}
        <div className={`absolute bottom-3 left-3 z-[1000] ${overlayBox}`}>
          <div className="mb-1 text-xs text-muted">{us.legend}</div>
          <div className="flex flex-col gap-1">
            {(["default", "selected"] as const).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="h-3 w-4 rounded-sm border-2"
                  style={{ borderColor: USPACE_COLORS[key].color, backgroundColor: `${USPACE_COLORS[key].fillColor}40` }}
                  aria-hidden="true"
                />
                <span className="text-xs text-fg-2">{key === "default" ? us.legendAvailable : us.legendSelected}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hovered U-space name tooltip */}
        {hoveredId && (
          <div className={`absolute left-3 top-14 z-[1000] ${overlayBox} py-1.5`}>
            <span className="text-sm font-medium text-fg">
              {uspaces.find(u => u.id === hoveredId)?.name || hoveredId}
            </span>
          </div>
        )}

        {/* Map */}
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          className="h-full w-full"
          style={{ height: "100%" }}
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

      {/* Keyboard / screen-reader alternative to the map */}
      <section aria-labelledby={`${filterId}-title`} className="flex max-h-72 min-h-0 flex-col rounded-lg border border-line bg-surface lg:h-[34rem] lg:max-h-none">
        <div className="border-b border-line p-3">
          <h2 id={`${filterId}-title`} className="mb-2 text-sm font-semibold text-fg">
            {interpolate(us.listTitle, { n: listedUspaces.length })}
          </h2>
          <label htmlFor={filterId} className="sr-only">
            {us.filterLabel}
          </label>
          <input
            id={filterId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={us.filterPlaceholder}
            className="input text-sm"
          />
        </div>
        {listedUspaces.length === 0 ? (
          <p className="p-3 text-sm text-muted">{us.noMatch}</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {listedUspaces.map((uspace) => {
              const selected = uspace.id === selectedUspaceId;
              return (
                <li key={uspace.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(uspace)}
                    onMouseEnter={() => handleHover(uspace.id)}
                    onMouseLeave={() => handleHover(null)}
                    onFocus={() => handleHover(uspace.id)}
                    onBlur={() => handleHover(null)}
                    aria-current={selected ? "true" : undefined}
                    className={`flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
                      selected ? "bg-info-soft" : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-fg">
                      {uspace.name}
                      {selected && <span className="ml-2 text-xs text-brand-text">{us.selected}</span>}
                    </span>
                    {uspace.id !== uspace.name && <span className="text-xs text-muted">{uspace.id}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default UspaceSelector;
