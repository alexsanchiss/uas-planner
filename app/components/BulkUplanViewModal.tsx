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

function extractAlt(val: any): number | string | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  }
  return null;
}

const BulkUplanViewModal = ({ open, onClose, uplans, names }: { open: boolean, onClose: () => void, uplans: any[], names: string[] }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  // Parse all operationVolumes
  const allVols = uplans.flatMap((uplan, planIdx) =>
    (uplan.operationVolumes || []).map((vol: any, idx: number) => {
      const coords = vol.geometry.coordinates[0].map(([lon, lat]: [number, number]) => [lat, lon]);
      const t0 = new Date(vol.timeBegin).getTime() / 1000;
      const t1 = new Date(vol.timeEnd).getTime() / 1000;
      return {
        coords,
        t0,
        t1,
        planIdx,
        planName: names[planIdx],
        idx,
        origVol: vol
      };
    })
  );
  const minT = allVols.length > 0 ? Math.min(...allVols.map((v: any) => v.t0)) : 0;
  const maxT = allVols.length > 0 ? Math.max(...allVols.map((v: any) => v.t1)) : 0;
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
  if (!open || !uplans || uplans.length === 0) return null;
  // Show only active polygons at current time
  const activeVols = allVols.filter((v: any) => currentTime + minT >= v.t0 && currentTime + minT <= v.t1);
  // Compute bounds from all coords
  const allCoords = allVols.flatMap((v: any) => v.coords);
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
    <Modal open={open} onClose={onClose} title={`Bulk U-plan Viewer`}>
      <div className="w-[400px] h-[400px] mb-4 relative">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <FitBoundsHandler bounds={bounds} names={names} />
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
          {showLabels && activeVols.map((v: any, i: number) => {
            const labelLatLon = v.coords[0];
            let minHeight = null, maxHeight = null;
            if (v.origVol && v.origVol.minAltitude && v.origVol.maxAltitude) {
              minHeight = extractAlt(v.origVol.minAltitude);
              maxHeight = extractAlt(v.origVol.maxAltitude);
            } else if (v.origVol && v.origVol.elevation) {
              minHeight = extractAlt(v.origVol.elevation.min);
              maxHeight = extractAlt(v.origVol.elevation.max);
            }
            return (
              <Marker
                key={`label-uplan-${i}`}
                position={labelLatLon}
                icon={L.divIcon({ className: 'uplan-label', html: '<div></div>' })}
                interactive={false}
              >
                <Tooltip permanent direction="top" className="text-center">
                  {v.planName}<br />
                  {minHeight !== null && maxHeight !== null ? `Alt: ${typeof minHeight === 'number' ? minHeight.toFixed(2) : minHeight} - ${typeof maxHeight === 'number' ? maxHeight.toFixed(2) : maxHeight} m` : ''}
                </Tooltip>
              </Marker>
            );
          })}
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

export default BulkUplanViewModal; 