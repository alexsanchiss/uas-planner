import React, { useState, useEffect } from "react";
import { Modal } from "./ui/modal";
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, Info } from 'lucide-react';

// Geozone type colors (matching GeoawarenessModal)
const GEOZONE_COLORS: { [key: string]: string } = {
  'U-SPACE': '#e41a1c',
  'PROHIBITED': '#4daf4a',
  'REQ_AUTHORIZATION': '#ff7f00',
  'CONDITIONAL': '#a65628',
  'NO_RESTRICTION': '#999999',
};

// Custom info icon for geozone markers
const geozoneInfoIcon = new L.DivIcon({
  className: 'geozone-info-marker',
  html: `<div style="
    background: white;
    border: 2px solid #2c3e50;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  ">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2c3e50" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Get centroid of polygon
function getPolygonCentroid(coordinates: number[][]): [number, number] {
  let latSum = 0, lonSum = 0;
  coordinates.forEach(coord => {
    lonSum += coord[0];
    latSum += coord[1];
  });
  return [latSum / coordinates.length, lonSum / coordinates.length];
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

function extractAlt(val: any): number | string | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  }
  return null;
}

interface GeoawarenessData {
  geozones?: {
    features: Array<{
      id: number | string;
      type: string;
      geometry: {
        type: string;
        coordinates: number[][][] | number[][];
        verticalReference?: {
          uom: string;
          lower: number;
          upper: number;
          lowerReference: string;
          upperReference: string;
        };
      };
      properties: {
        identifier: string;
        name: string;
        type: string;
        country?: string;
        region?: string;
        restrictionConditions?: any;
        zoneAuthority?: any;
      };
    }>;
  };
  trajectory?: [number, number][];
  hasConflicts?: boolean;
  checkedAt?: string;
}

interface UplanViewModalProps {
  open: boolean;
  onClose: () => void;
  uplan: any;
  name: string;
  geoawarenessData?: GeoawarenessData | null;
}

const UplanViewModal = ({ open, onClose, uplan, name, geoawarenessData }: UplanViewModalProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showGeozones, setShowGeozones] = useState(true);
  
  // Check if we have geozone data to display
  const hasGeozones = geoawarenessData?.geozones?.features && geoawarenessData.geozones.features.length > 0;
  const geozoneFeatures = hasGeozones ? geoawarenessData!.geozones!.features : [];
  const trajectory = geoawarenessData?.trajectory || [];
  
  // Parse operationVolumes (must be before useEffect)
  const vols = uplan && uplan.operationVolumes ? uplan.operationVolumes.map((vol: any, idx: number) => {
    const coords = vol.geometry.coordinates[0].map(([lon, lat]: [number, number]) => [lat, lon]);
    const t0 = new Date(vol.timeBegin).getTime() / 1000;
    const t1 = new Date(vol.timeEnd).getTime() / 1000;
    return { coords, t0, t1, idx, label: vol.name || `Volume ${idx + 1}` };
  }) : [];
  const minT = vols.length > 0 ? Math.min(...vols.map((v: any) => v.t0)) : 0;
  const maxT = vols.length > 0 ? Math.max(...vols.map((v: any) => v.t1)) : 0;
  // Play/pause effect
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev < Math.round(maxT - minT)) return prev + 1;
        return 0;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [playing, maxT, minT]);
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
  // All hooks above, now check for early return
  if (!open || !uplan || !uplan.operationVolumes) return null;
  // Show only active polygons
  const activeVols = vols.filter((v: any) => currentTime + minT >= v.t0 && currentTime + minT <= v.t1);
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
  // Compute bounds from all coords
  const allCoords = vols.flatMap((v: any) => v.coords);
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
  const utcTime = formatUtcTime(posixTime);

  // Render geozone info popup content
  const renderGeozonePopup = (feature: any) => {
    const { properties: p } = feature;
    const color = GEOZONE_COLORS[p.type] || GEOZONE_COLORS['CONDITIONAL'];
    
    return (
      <div style={{ maxWidth: '280px', fontSize: '11px' }}>
        <div style={{ 
          backgroundColor: color, 
          padding: '6px 10px', 
          borderRadius: '4px 4px 0 0',
          marginBottom: '8px'
        }}>
          <h4 style={{ margin: 0, color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
            {p.identifier || p.name}
          </h4>
          {p.name && p.identifier && (
            <div style={{ color: 'white', fontSize: '10px', marginTop: '2px' }}>{p.name}</div>
          )}
        </div>
        <div style={{ padding: '0 4px' }}>
          <p style={{ margin: '3px 0', color: '#34495e' }}><strong>Type:</strong> {p.type}</p>
          {p.country && <p style={{ margin: '3px 0', color: '#34495e' }}><strong>Country:</strong> {p.country}</p>}
          {p.region && <p style={{ margin: '3px 0', color: '#34495e' }}><strong>Region:</strong> {p.region}</p>}
          {feature.geometry.verticalReference && (
            <p style={{ margin: '3px 0', color: '#34495e' }}>
              <strong>Alt:</strong> {feature.geometry.verticalReference.lower} - {feature.geometry.verticalReference.upper} {feature.geometry.verticalReference.uom}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Determine modal width based on geozone availability
  const modalWidth = hasGeozones ? 'w-[700px]' : 'w-[400px]';
  const mapHeight = hasGeozones ? 'h-[450px]' : 'h-[400px]';

  return (
    <Modal open={open} onClose={onClose} title={`U-plan: ${name}`}>
      <div className={`${modalWidth} max-w-[90vw]`}>
        {/* Geozone conflict warning banner */}
        {hasGeozones && geoawarenessData?.hasConflicts && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
            <AlertTriangle size={18} className="text-yellow-500" />
            <span className="text-yellow-300 text-sm">
              {geozoneFeatures.length} geozona(s) detectada(s) en esta trayectoria
            </span>
          </div>
        )}
        
        {hasGeozones && !geoawarenessData?.hasConflicts && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-green-900/30 border border-green-600/50 rounded-lg">
            <Info size={18} className="text-green-500" />
            <span className="text-green-300 text-sm">
              Sin conflictos de geozonas detectados
            </span>
          </div>
        )}

        <div className={`${mapHeight} mb-4 relative rounded-lg overflow-hidden`}>
          <MapContainer
            center={center}
            zoom={hasGeozones ? 13 : 16}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <FitBoundsHandler bounds={bounds} names={[name]} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            
            {/* Render geozones if available and enabled */}
            {showGeozones && geozoneFeatures.map((feature: any, idx: number) => {
              if (feature.geometry.type !== 'Polygon') return null;
              
              const coords = feature.geometry.coordinates[0] as number[][];
              // Convert [lon, lat] to [lat, lon] for Leaflet
              const positions: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
              const color = GEOZONE_COLORS[feature.properties.type] || GEOZONE_COLORS['CONDITIONAL'];
              const centroid = getPolygonCentroid(coords);
              
              return (
                <React.Fragment key={`geozone-${idx}`}>
                  <Polygon
                    positions={positions}
                    pathOptions={{
                      color: 'black',
                      fillColor: color,
                      fillOpacity: 0.35,
                      weight: 2,
                      opacity: 0.7
                    }}
                  />
                  <Marker 
                    position={[centroid[0], centroid[1]]}
                    icon={geozoneInfoIcon}
                  >
                    <Popup maxWidth={300}>
                      {renderGeozonePopup(feature)}
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* Render trajectory if available */}
            {showGeozones && trajectory.length > 1 && (
              <Polyline
                positions={trajectory}
                pathOptions={{ 
                  color: '#2196F3', 
                  weight: 3,
                  opacity: 0.8,
                  dashArray: '5, 10'
                }}
              />
            )}
            
            {/* U-Plan operation volumes */}
            {activeVols.map((v: any, i: number) => (
              <Polygon
                key={`vol-${i}`}
                positions={v.coords}
                pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.4 }}
              />
            ))}
            {showLabels && labelLatLon && (
              <Marker
                key={`label-uplan`}
                position={labelLatLon}
                icon={L.divIcon({ className: 'uplan-label', html: '<div></div>' })}
                interactive={false}
              >
                <Tooltip permanent direction="top" className="text-center">
                  {name}<br />
                  {minHeight !== null && maxHeight !== null ? `Alt: ${typeof minHeight === 'number' ? minHeight.toFixed(2) : minHeight} - ${typeof maxHeight === 'number' ? maxHeight.toFixed(2) : maxHeight} m` : ''}
                </Tooltip>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Geozone legend when geozones are present */}
        {hasGeozones && (
          <div className="mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Leyenda:</div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60a5fa', border: '1px solid #2563eb' }}></div>
                <span className="text-gray-300">U-Plan</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5" style={{ backgroundColor: '#2196F3' }}></div>
                <span className="text-gray-300">Trayectoria</span>
              </div>
              {Object.entries(GEOZONE_COLORS).filter(([type]) => 
                geozoneFeatures.some((f: any) => f.properties.type === type)
              ).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }}></div>
                  <span className="text-gray-300">{type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
            <div className="text-base text-center text-blue-200 font-semibold">
              {utcTime}
            </div>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold border ${showLabels ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-700 text-gray-200 border-gray-500'} transition-all`}
              onClick={() => setShowLabels(l => !l)}
            >
              {showLabels ? 'Hide Labels' : 'Show Labels'}
            </button>
            {hasGeozones && (
              <button
                className={`px-3 py-1 rounded text-xs font-semibold border ${showGeozones ? 'bg-orange-600 text-white border-orange-700' : 'bg-gray-700 text-gray-200 border-gray-500'} transition-all`}
                onClick={() => setShowGeozones(g => !g)}
              >
                {showGeozones ? 'Hide Geozones' : 'Show Geozones'}
              </button>
            )}
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
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
            onClick={() => setPlaying(p => !p)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UplanViewModal; 