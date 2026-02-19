import { useState, useEffect, useMemo } from "react";
import { Modal } from "./ui/modal";
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Waypoint type for display
 * TASK-079: Added for waypoint visualization
 */
interface Waypoint {
  lat: number;
  lng: number;
  alt: number;
  type?: 'takeoff' | 'cruise' | 'landing';
}

/**
 * Parse waypoints from QGC plan JSON fileContent
 * TASK-079: Extract waypoints for visual preview
 */
function parseWaypointsFromPlan(fileContent?: string | null): Waypoint[] {
  if (!fileContent) return []
  
  try {
    const plan = JSON.parse(fileContent)
    const items = plan?.mission?.items || []
    
    return items
      .filter((item: { params?: number[] }) => item.params && item.params.length >= 7)
      .map((item: { params: number[]; Altitude?: number }, idx: number, arr: unknown[]) => ({
        lat: item.params[4],
        lng: item.params[5],
        alt: item.params[6] || item.Altitude || 0,
        type: idx === 0 ? 'takeoff' as const : idx === arr.length - 1 ? 'landing' as const : 'cruise' as const,
      }))
      .filter((wp: Waypoint) => wp.lat && wp.lng && !isNaN(wp.lat) && !isNaN(wp.lng))
  } catch {
    return []
  }
}

function FitBoundsHandler({ bounds, names }: { bounds: [[number, number], [number, number]], names: string[] }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds[0] && bounds[1]) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bounds, names, map]);
  return null;
}

// Handler to invalidate map size on container/window resize
function MapResizeHandler() {
  const map = useMap();
  
  useEffect(() => {
    // Invalidate size on mount to ensure proper initial render
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    // Handle window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  
  return null;
}

function extractAlt(val: any): number | string | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  }
  return null;
}

/**
 * UplanViewModal Props
 * TASK-079: Added fileContent for waypoint visualization
 */
interface UplanViewModalProps {
  open: boolean;
  onClose: () => void;
  uplan: any;
  name: string;
  fileContent?: string | null;
}

const UplanViewModal = ({ open, onClose, uplan, name, fileContent }: UplanViewModalProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showVolumes, setShowVolumes] = useState(true);
  
  // TASK-079: Parse waypoints from fileContent
  const waypoints = useMemo(() => parseWaypointsFromPlan(fileContent), [fileContent]);
  const hasWaypoints = waypoints.length > 0;
  
  // Parse operationVolumes (must be before useEffect)
  const vols = useMemo(() => {
    if (!uplan || !uplan.operationVolumes) return [];
    return uplan.operationVolumes.map((vol: any, idx: number) => {
      const coords = vol.geometry.coordinates[0].map(([lon, lat]: [number, number]) => [lat, lon]);
      const t0 = new Date(vol.timeBegin).getTime() / 1000;
      const t1 = new Date(vol.timeEnd).getTime() / 1000;
      return { coords, t0, t1, idx, label: vol.name || `Volume ${idx + 1}` };
    });
  }, [uplan]);
  
  const hasVolumes = vols.length > 0;
  const minT = hasVolumes ? Math.min(...vols.map((v: any) => v.t0)) : 0;
  const maxT = hasVolumes ? Math.max(...vols.map((v: any) => v.t1)) : 0;
  
  // Play/pause effect
  useEffect(() => {
    if (!playing || !hasVolumes) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev < Math.round(maxT - minT)) return prev + 1;
        return 0;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [playing, maxT, minT, hasVolumes]);
  
  // ESC key closes modal
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  
  // TASK-079: Early return only if modal is closed OR we have neither waypoints nor volumes
  if (!open || (!hasWaypoints && !hasVolumes)) return null;
  
  // Show only active polygons (time-based) - but always show all volumes with different styling
  const activeVols = hasVolumes 
    ? vols.filter((v: any) => currentTime + minT >= v.t0 && currentTime + minT <= v.t1)
    : [];
  
  // When showVolumes is true, render all volumes (active ones highlighted, inactive dimmed)
  const volumesToRender = hasVolumes ? vols : [];
  
  // Find the first active volume for the label
  const activeLabelVol = activeVols.length > 0 ? activeVols[0] : null;
  let labelLatLon: [number, number] | null = null;
  let minHeight = null, maxHeight = null;
  if (activeLabelVol && activeLabelVol.coords.length > 0) {
    labelLatLon = activeLabelVol.coords[0];
    // Try to get min/max height from the original uplan.operationVolumes
    const volIdx = activeLabelVol.idx;
    const origVol = uplan.operationVolumes[volIdx];
    if (origVol && origVol.minAltitude && origVol.maxAltitude) {
      minHeight = extractAlt(origVol.minAltitude);
      maxHeight = extractAlt(origVol.maxAltitude);
    } else if (origVol && origVol.elevation) {
      minHeight = extractAlt(origVol.elevation.min);
      maxHeight = extractAlt(origVol.elevation.max);
    }
  }
  
  // Compute bounds from all coords (volumes + waypoints)
  const volCoords = vols.flatMap((v: any) => v.coords);
  const wpCoords = waypoints.map(wp => [wp.lat, wp.lng]);
  const allCoords = [...volCoords, ...wpCoords];
  const lats = allCoords.map((c: any) => c[0]);
  const lons = allCoords.map((c: any) => c[1]);
  const hasPoints = lats.length > 0 && lons.length > 0;
  const minLat = hasPoints ? Math.min(...lats) : 0;
  const maxLat = hasPoints ? Math.max(...lats) : 0;
  const minLon = hasPoints ? Math.min(...lons) : 0;
  const maxLon = hasPoints ? Math.max(...lons) : 0;
  const bounds: [[number, number], [number, number]] = [[minLat, minLon], [maxLat, maxLon]];
  const center: [number, number] = hasPoints ? [(minLat + maxLat) / 2, (minLon + maxLon) / 2] : [0, 0];
  const posixTime = Math.round(minT + currentTime);
  
  function formatUtcTime(posix: number) {
    const date = new Date(posix * 1000);
    const day = date.toISOString().slice(0, 10);
    const hour = date.getUTCHours().toString().padStart(2, '0');
    const min = date.getUTCMinutes().toString().padStart(2, '0');
    const sec = date.getUTCSeconds().toString().padStart(2, '0');
    return `${day}, ${hour}:${min}:${sec} UTC`;
  }
  
  // Get color for waypoint type
  const getWaypointColor = (type?: string, index?: number, total?: number) => {
    if (type === 'takeoff' || index === 0) return '#22c55e'; // green
    if (type === 'landing' || (total && index === total - 1)) return '#ef4444'; // red
    return '#3b82f6'; // blue for cruise
  };
  
  const utcTime = hasVolumes ? formatUtcTime(posixTime) : null;
  const polylinePath = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
  
  return (
    <Modal open={open} onClose={onClose} title={`U-plan: ${name}`} maxWidth="4xl">
      <div className="w-full max-w-[95vw] h-[50vh] md:h-[450px] max-h-[70vh] min-h-[200px] mb-4 relative overflow-hidden rounded-lg">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <FitBoundsHandler bounds={bounds} names={[name]} />
          <MapResizeHandler />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          
          {/* TASK-079: Render waypoints with polyline */}
          {showWaypoints && hasWaypoints && (
            <>
              {polylinePath.length > 1 && (
                <Polyline 
                  positions={polylinePath} 
                  color="#3b82f6" 
                  weight={3}
                  opacity={0.8}
                />
              )}
              {waypoints.map((wp, idx) => {
                const color = getWaypointColor(wp.type, idx, waypoints.length);
                const label = wp.type === 'takeoff' ? 'Takeoff' : 
                             wp.type === 'landing' ? 'Landing' : 
                             `Waypoint ${idx + 1}`;
                return (
                  <CircleMarker
                    key={`wp-${idx}`}
                    center={[wp.lat, wp.lng]}
                    radius={8}
                    pathOptions={{ 
                      color: color, 
                      fillColor: color, 
                      fillOpacity: 0.8,
                      weight: 2
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      <div className="text-xs">
                        <div className="font-semibold">{label}</div>
                        <div>Lat: {wp.lat.toFixed(6)}</div>
                        <div>Lng: {wp.lng.toFixed(6)}</div>
                        <div>Alt: {wp.alt}m AGL</div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </>
          )}
          
          {/* Render 4D volumes with hover tooltips - TASK-081 */}
          {showVolumes && volumesToRender.map((v: any, i: number) => {
            const origVol = uplan.operationVolumes?.[v.idx];
            const timeBegin = origVol?.timeBegin ? new Date(origVol.timeBegin).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'N/A';
            const timeEnd = origVol?.timeEnd ? new Date(origVol.timeEnd).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'N/A';
            
            // Check if this volume is active at current time
            const isActive = currentTime + minT >= v.t0 && currentTime + minT <= v.t1;
            
            // Extract altitude info - handle both number and {value, reference, uom} object format
            let minAlt: string = 'N/A';
            let maxAlt: string = 'N/A';
            
            const extractAltValue = (alt: any): string => {
              if (!alt) return 'N/A';
              if (typeof alt === 'number') return `${alt.toFixed(1)}m`;
              if (typeof alt === 'object' && alt.value !== undefined) {
                return `${typeof alt.value === 'number' ? alt.value.toFixed(1) : alt.value}${alt.uom || 'm'}`;
              }
              if (typeof alt === 'string') return alt;
              return 'N/A';
            };
            
            if (origVol?.minAltitude && origVol?.maxAltitude) {
              minAlt = extractAltValue(origVol.minAltitude);
              maxAlt = extractAltValue(origVol.maxAltitude);
            } else if (origVol?.elevation) {
              minAlt = extractAltValue(origVol.elevation.min);
              maxAlt = extractAltValue(origVol.elevation.max);
            }
            
            // Calculate approximate dimensions from polygon coordinates
            let dimensions = '';
            if (v.coords && v.coords.length >= 4) {
              // Calculate distance between first two corners (width) and between corner 0 and corner 3 (length)
              const toRad = (deg: number) => deg * Math.PI / 180;
              const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371000; // Earth radius in meters
                const dLat = toRad(lat2 - lat1);
                const dLon = toRad(lon2 - lon1);
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
              };
              const width = haversine(v.coords[0][0], v.coords[0][1], v.coords[1][0], v.coords[1][1]);
              const length = haversine(v.coords[1][0], v.coords[1][1], v.coords[2][0], v.coords[2][1]);
              dimensions = `${width.toFixed(1)}m × ${length.toFixed(1)}m`;
            }
            
            return (
              <Polygon
                key={`vol-${i}`}
                positions={v.coords}
                pathOptions={{ 
                  color: isActive ? '#8b5cf6' : '#94a3b8', 
                  fillColor: isActive ? '#a78bfa' : '#cbd5e1', 
                  fillOpacity: isActive ? 0.4 : 0.15,
                  weight: isActive ? 2 : 1
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} sticky>
                  <div className="text-xs min-w-[160px]">
                    <div className="font-semibold text-purple-600 mb-1">{v.label}</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-gray-500">Start:</span>
                      <span>{timeBegin}</span>
                      <span className="text-gray-500">End:</span>
                      <span>{timeEnd}</span>
                      <span className="text-gray-500">Alt (AGL):</span>
                      <span>{minAlt} - {maxAlt}</span>
                      {dimensions && (
                        <>
                          <span className="text-gray-500">Size:</span>
                          <span>{dimensions}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}
          
          {showLabels && labelLatLon && showVolumes && (
            <Marker
              key={`label-uplan`}
              position={labelLatLon}
              icon={L.divIcon({ className: 'uplan-label', html: '<div></div>' })}
              interactive={false}
            >
              <Tooltip permanent direction="top" className="text-center">
                {name}<br />
                {minHeight !== null && maxHeight !== null ? `Alt: ${typeof minHeight === 'number' ? minHeight.toFixed(2) : minHeight} - ${typeof maxHeight === 'number' ? maxHeight.toFixed(2) : maxHeight} m AGL` : ''}
              </Tooltip>
            </Marker>
          )}
        </MapContainer>
      </div>
      
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-sm">
        {hasWaypoints && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-[var(--text-secondary)]">Takeoff</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-[var(--text-secondary)]">Waypoint</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-[var(--text-secondary)]">Landing</span>
            </div>
          </>
        )}
        {hasVolumes && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500/60 border border-purple-500"></div>
            <span className="text-[var(--text-secondary)]">4D Volume</span>
          </div>
        )}
      </div>
      
      {/* Toggle controls */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-3">
        {hasWaypoints && (
          <button
            className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
              showWaypoints ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-700 text-gray-200 border-gray-500'
            }`}
            onClick={() => setShowWaypoints(w => !w)}
          >
            {showWaypoints ? 'Hide Waypoints' : 'Show Waypoints'}
          </button>
        )}
        {hasVolumes && (
          <>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
                showVolumes ? 'bg-purple-600 text-white border-purple-700' : 'bg-gray-700 text-gray-200 border-gray-500'
              }`}
              onClick={() => setShowVolumes(v => !v)}
            >
              {showVolumes ? 'Hide Volumes' : 'Show Volumes'}
            </button>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
                showLabels ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-700 text-gray-200 border-gray-500'
              }`}
              onClick={() => setShowLabels(l => !l)}
            >
              {showLabels ? 'Hide Labels' : 'Show Labels'}
            </button>
          </>
        )}
      </div>
      
      {/* Time controls - only show if we have volumes */}
      {hasVolumes && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center gap-4 mb-1">
            <div className="text-base text-center text-[var(--text-secondary)] font-semibold">
              {utcTime}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={Math.round(maxT - minT)}
            value={currentTime}
            onChange={e => setCurrentTime(Number(e.target.value))}
            className="w-full"
          />
          <button
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 w-full"
            onClick={() => setPlaying(p => !p)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      )}
      
      {/* Info text */}
      <div className="mt-3 text-center text-xs text-[var(--text-muted)]">
        {hasWaypoints && <span>{waypoints.length} waypoints</span>}
        {hasWaypoints && hasVolumes && <span> • </span>}
        {hasVolumes && <span>{vols.length} operation volumes</span>}
      </div>
    </Modal>
  );
};

export default UplanViewModal; 