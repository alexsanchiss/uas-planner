import { useState, useEffect } from "react";
import { Modal } from "./ui/modal";
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

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

const UplanViewModal = ({ open, onClose, uplan, name }: { open: boolean, onClose: () => void, uplan: any, name: string }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
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
  return (
    <Modal open={open} onClose={onClose} title={`U-plan: ${name}`}>
      <div className="w-full max-w-[95vw] md:max-w-[600px] h-[50vh] md:h-[400px] max-h-[70vh] min-h-[200px] mb-4 relative overflow-hidden rounded-lg">
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
          {activeVols.map((v: any, i: number) => (
            <Polygon
              key={i}
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-4 mb-1">
          <div className="text-base text-center text-blue-200 font-semibold">
            {utcTime}
          </div>
          <button
            className={`px-3 py-1 rounded text-xs font-semibold border ${showLabels ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-700 text-gray-200 border-gray-500'} transition-all`}
            onClick={() => setShowLabels(l => !l)}
          >
            {showLabels ? 'Hide Labels' : 'Show Labels'}
          </button>
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
    </Modal>
  );
};

export default UplanViewModal; 