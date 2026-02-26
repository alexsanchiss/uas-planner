/**
 * GeozoneLayer Component
 * TASK-049: Leaflet layer for displaying geozones with color-coded types
 *
 * Features:
 * - Renders geozones as colored polygons based on type
 * - Supports visibility toggle
 * - Color-codes geozones by type:
 *   - prohibited: Red (#DC2626)
 *   - restricted: Orange (#F97316)
 *   - controlled: Yellow (#EAB308)
 *   - advisory: Blue (#3B82F6)
 *   - warning: Purple (#8B5CF6)
 *   - temporary: Gray (#6B7280)
 * - Shows hover effects for better interaction
 * - Designed to work with useGeozones data
 */

"use client";

import React, { useMemo, useState } from "react";
import { Polygon, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { GeozoneData } from "@/app/hooks/useGeoawarenessWebSocket";

/**
 * Geozone type for styling
 */
export type GeozoneType = 
  | "prohibited" 
  | "restricted" 
  | "controlled" 
  | "advisory" 
  | "warning" 
  | "temporary"
  | "PROHIBITED"
  | "REQ_AUTHORIZATION"
  | "CONDITIONAL"
  | "NO_RESTRICTION"
  | "U-SPACE";

/**
 * Color configuration for different geozone types
 */
const GEOZONE_COLORS: Record<string, { color: string; fillColor: string }> = {
  // Standard types from PLAN.md
  prohibited: { color: "#DC2626", fillColor: "#DC2626" },
  restricted: { color: "#F97316", fillColor: "#F97316" },
  controlled: { color: "#EAB308", fillColor: "#EAB308" },
  advisory: { color: "#3B82F6", fillColor: "#3B82F6" },
  warning: { color: "#8B5CF6", fillColor: "#8B5CF6" },
  temporary: { color: "#6B7280", fillColor: "#6B7280" },
  // Types from geozones_map.html
  PROHIBITED: { color: "#4daf4a", fillColor: "#4daf4a" },
  REQ_AUTHORIZATION: { color: "#ff7f00", fillColor: "#ff7f00" },
  CONDITIONAL: { color: "#a65628", fillColor: "#a65628" },
  NO_RESTRICTION: { color: "#999999", fillColor: "#999999" },
  "U-SPACE": { color: "#e41a1c", fillColor: "#e41a1c" },
  // Default fallback
  default: { color: "#6B7280", fillColor: "#6B7280" },
};

/**
 * Get colors for a geozone type
 */
function getGeozoneColors(type?: string): { color: string; fillColor: string } {
  if (!type) return GEOZONE_COLORS.default;
  const normalizedType = type.toLowerCase();
  return GEOZONE_COLORS[type] || GEOZONE_COLORS[normalizedType] || GEOZONE_COLORS.default;
}

/**
 * Get display name for a geozone type
 */
function getGeozoneTypeDisplayName(type?: string): string {
  if (!type) return "Unknown";
  
  const displayNames: Record<string, string> = {
    prohibited: "Prohibited",
    restricted: "Restricted",
    controlled: "Controlled",
    advisory: "Advisory",
    warning: "Warning",
    temporary: "Temporary",
    PROHIBITED: "Prohibited",
    REQ_AUTHORIZATION: "Requires Authorization",
    CONDITIONAL: "Conditional",
    NO_RESTRICTION: "No Restriction",
    "U-SPACE": "U-Space",
  };
  
  return displayNames[type] || type;
}

interface GeozonePolygonProps {
  /** Geozone data */
  geozone: GeozoneData;
  /** Click handler for showing info popup */
  onClick?: (geozone: GeozoneData, event: L.LeafletMouseEvent) => void;
  /** Default fill opacity */
  fillOpacity?: number;
  /** Hover fill opacity */
  hoverFillOpacity?: number;
}

/**
 * Detect if a coordinate pair is in [lat, lng] or [lng, lat] format
 * Latitude must be between -90 and 90, longitude between -180 and 180
 * If first value is > 90 or < -90, it's likely longitude (so format is [lng, lat])
 * If first value is between -90 and 90 and second is > 90 or < -90, it's [lat, lng]
 */
function isLatLngOrder(coord: number[]): boolean {
  if (coord.length < 2) return false;
  const [first, second] = coord;
  // If first value is a valid latitude (-90 to 90) and second is outside that range or also valid
  // we assume [lat, lng] if second value looks like a longitude
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    // If second value is clearly out of latitude range, it's [lat, lng]
    if (Math.abs(second) > 90) return true;
    // Both could be valid lat or lng - check which makes more geographic sense
    // For European coordinates (Spain), lat ~39-40, lng ~0 (negative)
    // If first is around 39-40 and second is around -0.3, it's [lat, lng]
    if (first > 30 && first < 50 && Math.abs(second) < 1) return true;
  }
  return false;
}

/**
 * Parse geometry coordinates to Leaflet positions [lat, lng][]
 * Handles various malformed GeoJSON coordinate formats:
 * - Standard: [[[lng, lat], ...]] (Polygon with rings)
 * - Missing ring: [[lng, lat], ...] (flat coordinate pairs)
 * - Swapped order: [[[lat, lng], ...]] or [[lat, lng], ...]
 */
function parseCoordinatesToPositions(geometry: GeozoneData['geometry']): [number, number][] | null {
  if (!geometry || !geometry.coordinates) return null;
  
  const coords = geometry.coordinates;
  
  // Handle non-array coordinates (e.g., malformed data)
  if (!Array.isArray(coords) || coords.length === 0) return null;
  
  // Determine the structure of the coordinates
  let ring: unknown[];
  
  if (geometry.type === "MultiPolygon") {
    // MultiPolygon: [[[[lng, lat], ...], ...], ...]
    const multiCoords = coords as number[][][][];
    if (multiCoords.length === 0 || !multiCoords[0] || multiCoords[0].length === 0) return null;
    ring = multiCoords[0][0];
  } else {
    // Polygon or similar - need to detect the nesting level
    // Check what the first element looks like
    const firstElement = coords[0];
    
    if (!Array.isArray(firstElement)) {
      // coords is just a single point? Not valid
      return null;
    }
    
    // Check if firstElement is a coordinate pair [number, number]
    // or another array (ring of coordinates [[number, number], ...])
    if (typeof firstElement[0] === 'number') {
      // coords is [[lng, lat], [lng, lat], ...] - missing outer ring wrapper
      // This is incorrectly nested - should be [[[lng, lat], ...]]
      ring = coords as unknown[];
    } else if (Array.isArray(firstElement[0])) {
      // coords is [[[lng, lat], ...]] - properly nested
      ring = firstElement as unknown[];
    } else {
      return null;
    }
  }
  
  // Now ring should be [[lng, lat], [lng, lat], ...]
  if (!Array.isArray(ring) || ring.length === 0) return null;
  
  // Validate we have coordinate pairs
  const firstCoord = ring[0];
  if (!Array.isArray(firstCoord) || firstCoord.length < 2) return null;
  
  // Detect coordinate order
  const needsSwap = isLatLngOrder(firstCoord as number[]);
  
  // Convert to Leaflet positions [lat, lng]
  return ring
    .filter((coord): coord is number[] => 
      Array.isArray(coord) && coord.length >= 2 && 
      typeof coord[0] === 'number' && typeof coord[1] === 'number'
    )
    .map(coord => {
      if (needsSwap) {
        // Already in [lat, lng] order
        return [coord[0], coord[1]] as [number, number];
      } else {
        // Standard GeoJSON [lng, lat] -> convert to [lat, lng]
        return [coord[1], coord[0]] as [number, number];
      }
    });
}

/**
 * Individual geozone polygon component
 */
function GeozonePolygon({
  geozone,
  onClick,
  fillOpacity = 0.25,
  hoverFillOpacity = 0.45,
}: GeozonePolygonProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Convert GeoJSON coordinates to Leaflet positions with robust parsing
  const positions = useMemo(() => {
    return parseCoordinatesToPositions(geozone.geometry);
  }, [geozone]);

  // Get colors based on geozone type
  const colors = useMemo(() => {
    const type = geozone.properties?.type;
    return getGeozoneColors(type);
  }, [geozone.properties?.type]);

  // Path options with hover effect
  const pathOptions = useMemo(() => ({
    color: colors.color,
    fillColor: colors.fillColor,
    fillOpacity: isHovered ? hoverFillOpacity : fillOpacity,
    weight: isHovered ? 3 : 2,
    opacity: isHovered ? 1 : 0.8,
  }), [colors, isHovered, fillOpacity, hoverFillOpacity]);

  if (!positions || positions.length < 3) {
    return null;
  }

  const geozoneName = geozone.properties?.name || geozone.uas_geozones_identifier;
  const geozoneType = geozone.properties?.type;

  return (
    <Polygon
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={{
        click: (e) => {
          // TASK-053: Prevent map click event from firing (avoid waypoint placement on geozone click)
          // Stop propagation on the original DOM event to prevent useMapEvents from receiving it
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
          // Also stop Leaflet event propagation
          L.DomEvent.stopPropagation(e);
          onClick?.(geozone, e);
        },
        mouseover: () => setIsHovered(true),
        mouseout: () => setIsHovered(false),
      }}
    >
      <Tooltip
        sticky
        direction="top"
        offset={[0, -10]}
        opacity={0.95}
      >
        <div className="min-w-[120px]">
          <div className="font-semibold text-sm">{geozoneName}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: colors.fillColor }}
            />
            <span className="text-xs text-gray-600">
              {getGeozoneTypeDisplayName(geozoneType)}
            </span>
          </div>
        </div>
      </Tooltip>
    </Polygon>
  );
}

interface GeozoneLayerProps {
  /** Array of geozone data from WebSocket */
  geozones: GeozoneData[];
  /** Whether the layer is visible */
  visible?: boolean;
  /** Click handler for geozones (for info popup) */
  onGeozoneClick?: (geozone: GeozoneData, event: L.LeafletMouseEvent) => void;
  /** Default fill opacity for geozones */
  fillOpacity?: number;
  /** Hover fill opacity for geozones */
  hoverFillOpacity?: number;
}

/**
 * GeozoneLayer - Renders a collection of geozones on the map
 * 
 * @example
 * ```tsx
 * const { data } = useGeoawarenessWebSocket({ uspaceId: 'USP-ESP-BEN-01' });
 * 
 * return (
 *   <MapContainer>
 *     <TileLayer ... />
 *     <GeozoneLayer
 *       geozones={data?.geozones_data || []}
 *       visible={showGeozones}
 *       onGeozoneClick={(geozone) => openInfoPopup(geozone)}
 *     />
 *   </MapContainer>
 * );
 * ```
 */
export function GeozoneLayer({
  geozones,
  visible = true,
  onGeozoneClick,
  fillOpacity = 0.25,
  hoverFillOpacity = 0.45,
}: GeozoneLayerProps) {
  if (!visible || !geozones || geozones.length === 0) {
    return null;
  }

  return (
    <>
      {geozones.map((geozone) => (
        <GeozonePolygon
          key={geozone.uas_geozones_identifier}
          geozone={geozone}
          onClick={onGeozoneClick}
          fillOpacity={fillOpacity}
          hoverFillOpacity={hoverFillOpacity}
        />
      ))}
    </>
  );
}

/**
 * GeozoneLegend - A legend component showing geozone type colors
 */
export function GeozoneLegend({ className = "" }: { className?: string }) {
  const legendItems = [
    { type: "prohibited", label: "Prohibited" },
    { type: "restricted", label: "Restricted" },
    { type: "controlled", label: "Controlled" },
    { type: "advisory", label: "Advisory" },
    { type: "warning", label: "Warning" },
    { type: "temporary", label: "Temporary" },
  ];

  return (
    <div className={`bg-[var(--surface-primary)]/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-[var(--border-primary)] ${className}`}>
      <div className="text-xs font-medium text-[var(--text-primary)] mb-1.5">
        Geozone Types
      </div>
      <div className="flex flex-col gap-1">
        {legendItems.map(({ type, label }) => {
          const colors = getGeozoneColors(type);
          return (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-4 h-3 rounded-sm border"
                style={{
                  backgroundColor: `${colors.fillColor}40`,
                  borderColor: colors.color,
                }}
              />
              <span className="text-xs text-[var(--text-secondary)]">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GeozoneLayer;
