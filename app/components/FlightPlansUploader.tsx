"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Papa from 'papaparse';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, CircleMarker, useMap, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import {
  UploadIcon,
  Loader2Icon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  DownloadIcon,
  Trash2Icon,
  RotateCwIcon,
  FolderPlusIcon,
  XIcon,
  EyeIcon, // Add EyeIcon for view button
  HelpCircle,
} from "lucide-react";
import { Modal } from "./ui/modal";

interface Folder {
  id: number;
  name: string;
  userId: number;
  flightPlans: FlightPlan[];
  minScheduledAt?: string | null;
  maxScheduledAt?: string | null;
}

interface FlightPlan {
  id: number;
  fileContent: File;
  customName: string;
  status: "sin procesar" | "en cola" | "procesando" | "procesado" | "error";
  csvResult?: number;
  folderId?: number | null;
  authorizationStatus?:
    | "sin autorización"
    | "procesando autorización"
    | "aprobado"
    | "denegado";
  uplan?: any;
  authorizationMessage?: any;
  scheduledAt?: string | null;
}

const PLANS_PER_FOLDER_PAGE = 25;

type TrajectoryRow = {
  SimTime: string;
  Lat: number;
  Lon: number;
  Alt: number;
  qw: string;
  qx: string;
  qy: string;
  qz: string;
  Vx: string;
  Vy: string;
  Vz: string;
};

function parseTrajectoryCsv(csv: string): TrajectoryRow[] {
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return (parsed.data as any[]).map((row: any) => ({
    SimTime: row.SimTime,
    Lat: parseFloat(row.Lat),
    Lon: parseFloat(row.Lon),
    Alt: parseFloat(row.Alt),
    qw: row.qw, qx: row.qx, qy: row.qy, qz: row.qz,
    Vx: row.Vx, Vy: row.Vy, Vz: row.Vz
  })).filter((row: any) => !isNaN(row.Lat) && !isNaN(row.Lon));
}

// Helper to fit bounds only when trajectory set changes
function FitBoundsHandler({ bounds, names }: { bounds: [[number, number], [number, number]], names: string[] }) {
  const map = useMap();
  const lastNamesRef = useRef<string[]>([]);
  useEffect(() => {
    const namesStr = names.join(',');
    if (namesStr !== lastNamesRef.current.join(',')) {
      if (bounds && bounds[0] && bounds[1]) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
      lastNamesRef.current = names;
    }
    // eslint-disable-next-line
  }, [bounds, names, map]);
  return null;
}

// TrajectoryViewerModal component
function TrajectoryViewerModal({ open, onClose, title, trajectories, currentIdxs, setCurrentIdxs, names }:{
  open: boolean;
  onClose: () => void;
  title: string;
  trajectories: TrajectoryRow[][];
  currentIdxs: number[];
  setCurrentIdxs: (idxs: number[] | ((prev: number[]) => number[])) => void;
  names: string[];
}) {
  if (!open || !trajectories || trajectories.length === 0 || trajectories[0].length === 0) return null;
  const colors = ["#3b82f6", "#22d3ee", "#f59e42", "#ef4444", "#a78bfa", "#10b981", "#f472b6", "#facc15"];
  const polylines = trajectories.map(traj => traj.map(row => [row.Lat, row.Lon] as [number, number]));
  const currentMarkers = trajectories.map((traj, i) => traj[currentIdxs[i]] || traj[0]);
  const center = polylines[0][0];
  const [playing, setPlaying] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  // ESC key closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  // Play/pause effect
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentIdxs((prev: number[]) => {
        const max = Math.max(...trajectories.map(t => t.length - 1));
        return prev.map(idx => (idx < max ? idx + 1 : 0));
      });
    }, 60);
    return () => clearInterval(interval);
  }, [playing, trajectories, setCurrentIdxs]);
  // Only one slider: use the min length of all trajectories
  const minLen = Math.min(...trajectories.map(t => t.length));
  const globalIdx = currentIdxs[0] || 0;
  // When slider moves, update all indices to the same value
  const handleSlider = (val: number) => setCurrentIdxs(currentIdxs.map(() => val));
  // Compute minSimTime as the minimum SimTime across all points in all trajectories
  const minSimTime = Math.min(
    ...trajectories
      .map(traj => Math.min(...traj.map(row => parseFloat((row.SimTime || '').trim())).filter(t => !isNaN(t))))
      .filter(t => !isNaN(t))
  );
  // Compute baseSimTime as the SimTime at the first index of the first trajectory
  const baseSimTime = parseFloat(trajectories[0][0]?.SimTime) || 0;
  const currentSimTime = parseFloat(trajectories[0][globalIdx]?.SimTime) || 0;
  const relTime = Math.round(currentSimTime - baseSimTime);

  // Compute bounds for all first points only
  const lats = trajectories.map(traj => traj[0]?.Lat).filter(v => typeof v === 'number' && !isNaN(v));
  const lons = trajectories.map(traj => traj[0]?.Lon).filter(v => typeof v === 'number' && !isNaN(v));
  const hasPoints = lats.length > 0 && lons.length > 0;
  const minLat = hasPoints ? Math.min(...lats) : 0;
  const maxLat = hasPoints ? Math.max(...lats) : 0;
  const minLon = hasPoints ? Math.min(...lons) : 0;
  const maxLon = hasPoints ? Math.max(...lons) : 0;
  const bounds: [[number, number], [number, number]] = [[minLat, minLon], [maxLat, maxLon]];

  return (
    <Modal open={open} onClose={onClose} title={title}>
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
          {polylines.map((polyline, i) => (
            <Polyline key={i} positions={polyline} color={colors[i % colors.length]} />
          ))}
          {currentMarkers.map((current, i) => (
            <CircleMarker
              key={i}
              center={[current.Lat, current.Lon]}
              radius={10}
              pathOptions={{ color: colors[i % colors.length], fillColor: colors[i % colors.length], fillOpacity: 0.6 }}
            >
              {showLabels && (
                <Tooltip permanent direction="top" className="text-center">
                  {names[i]}<br />Alt: {typeof current.Alt === 'number' ? current.Alt.toFixed(2) : current.Alt} m
                </Tooltip>
              )}
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-4 mb-1">
          <div className="text-base text-center text-blue-200 font-semibold">
            Time: {relTime} s
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
          max={minLen - 1}
          value={globalIdx}
          onChange={e => handleSlider(Number(e.target.value))}
          className="w-full"
        />
        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setPlaying(p => !p)}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </Modal>
  );
}

// Uplan Error Modal
function UplanErrorModal({ open, onClose, message }: { open: boolean, onClose: () => void, message: any }) {
  if (!open) return null;
  let displayMsg = '';
  let isObject = false;
  if (typeof message === 'string') displayMsg = message;
  else if (typeof message === 'object') {
    displayMsg = JSON.stringify(message, null, 2);
    isObject = true;
  } else displayMsg = String(message);
  return (
    <Modal open={open} onClose={onClose} title="U-plan Denied">
      <pre className={
        `whitespace-pre-wrap text-xs max-h-[60vh] overflow-auto rounded-lg border p-4 text-left ` +
        (isObject
          ? 'bg-gray-900 border-gray-700 text-gray-100'
          : 'bg-red-950 border-red-700 text-red-200 font-semibold text-center')
      }>
        {displayMsg}
      </pre>
    </Modal>
  );
}
// Uplan Visualization Modal
function UplanViewModal({ open, onClose, uplan, name }: { open: boolean, onClose: () => void, uplan: any, name: string }) {
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
    // Use top-level extractAlt function
    if (origVol && origVol.minAltitude && origVol.maxAltitude) {
      minHeight = extractAlt(origVol.minAltitude);
      maxHeight = extractAlt(origVol.maxAltitude);
    } else if (origVol && origVol.elevation) {
      minHeight = extractAlt(origVol.elevation.min);
      maxHeight = extractAlt(origVol.elevation.max);
    }
    // Remove Math.round, keep as number
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
  // Center for map
  const center: [number, number] = hasPoints ? [(minLat + maxLat) / 2, (minLon + maxLon) / 2] : [0, 0];
  // Compute the current POSIX time
  const posixTime = Math.round(minT + currentTime);
  // Format as UTC: DAY, HOUR, MINUTE, SECOND
  function formatUtcTime(posix: number) {
    const date = new Date(posix * 1000);
    const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const hour = date.getUTCHours().toString().padStart(2, '0');
    const min = date.getUTCMinutes().toString().padStart(2, '0');
    const sec = date.getUTCSeconds().toString().padStart(2, '0');
    return `${day}, ${hour}:${min}:${sec} UTC`;
  }
  const utcTime = formatUtcTime(posixTime);
  return (
    <Modal open={open} onClose={onClose} title={`U-plan: ${name}`}>
      <div className="w-[400px] h-[400px] mb-4 relative">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <FitBoundsHandler bounds={bounds} names={[name]} />
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
              icon={L.divIcon({ className: 'uplan-label', html: '<div></div>' })} // invisible icon
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
}

// Move these to the top level, outside FlightPlansUploader
function extractAlt(val: any): number | string | null {
  if (val == null) return null;
  let num: number | null = null;
  if (typeof val === 'number') num = val;
  else if (typeof val === 'string' && !isNaN(Number(val))) num = Number(val);
  else if (typeof val === 'object') {
    if ('value' in val && typeof val.value === 'number') num = val.value;
    else if ('meters' in val && typeof val.meters === 'number') num = val.meters;
    else if ('feet' in val && typeof val.feet === 'number') num = val.feet;
    else {
      const found = Object.values(val).find(v => typeof v === 'number');
      if (typeof found === 'number') num = found;
    }
  }
  if (num !== null) return Number(num.toFixed(2));
  return val;
}

function BulkUplanViewModal({ open, onClose, uplans, names }: { open: boolean, onClose: () => void, uplans: any[], names: string[] }) {
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
  // Compute the current POSIX time
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
            // Remove Math.round, keep as number
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
}

function BulkErrorViewModal({ open, onClose, errors, idx, setIdx }: { open: boolean, onClose: () => void, errors: {name: string, message: any}[], idx: number, setIdx: (i: number) => void }) {
  if (!open || !errors || errors.length === 0) return null;
  const error = errors[idx];
  let displayMsg = '';
  let isObject = false;
  if (typeof error.message === 'string') displayMsg = error.message;
  else if (typeof error.message === 'object') {
    displayMsg = JSON.stringify(error.message, null, 2);
    isObject = true;
  } else displayMsg = String(error.message);
  return (
    <Modal open={open} onClose={onClose} title={`Error for: ${error.name} (${idx + 1}/${errors.length})`}>
      <div className="flex flex-col gap-4 items-center">
        <pre className={
          `whitespace-pre-wrap text-xs max-h-[60vh] overflow-auto rounded-lg border p-4 text-left ` +
          (isObject
            ? 'bg-gray-900 border-gray-700 text-gray-100'
            : 'bg-red-950 border-red-700 text-red-200 font-semibold text-center')
        }>
          {displayMsg}
        </pre>
        <div className="flex gap-4 items-center">
          <button
            className="px-3 py-1 rounded bg-gray-700 text-white border border-gray-500 disabled:opacity-50"
            onClick={() => setIdx(idx - 1)}
            disabled={idx === 0}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 rounded bg-gray-700 text-white border border-gray-500 disabled:opacity-50"
            onClick={() => setIdx(idx + 1)}
            disabled={idx === errors.length - 1}
          >
            Next
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function FlightPlansUploader() {
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<number[]>([]);
  const { user } = useAuth();
  const [folderFilters, setFolderFilters] = useState<{ [key: number]: string }>(
    {}
  );
  const [isDragging, setIsDragging] = useState(false);
  const [authorizationLoading, setAuthorizationLoading] = useState<{
    [planId: number]: boolean;
  }>({});
  const [folderSelectStatus, setFolderSelectStatus] = useState<{
    [key: number]: string;
  }>({});
  const [folderPages, setFolderPages] = useState<{
    [folderId: number]: number;
  }>({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalContent, setViewModalContent] = useState<string>("");
  const [viewModalTitle, setViewModalTitle] = useState<string>("");
  const [trajectoryModalOpen, setTrajectoryModalOpen] = useState(false);
  const [trajectoryModalTitle, setTrajectoryModalTitle] = useState('');
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryRow[][]>([]);
  const [trajectoryIdxs, setTrajectoryIdxs] = useState<number[]>([]);
  const [trajectoryNames, setTrajectoryNames] = useState<string[]>([]);
  // Add state for U-plan modals
  const [uplanErrorModal, setUplanErrorModal] = useState<{ open: boolean, message: string }>({ open: false, message: '' });
  const [uplanViewModal, setUplanViewModal] = useState<{ open: boolean, uplan: any, name: string }>({ open: false, uplan: null, name: '' });
  const [bulkUplanViewModal, setBulkUplanViewModal] = useState<{ open: boolean, uplans: any[], names: string[] }>({ open: false, uplans: [], names: [] });
  const [bulkErrorViewModal, setBulkErrorViewModal] = useState<{ open: boolean, errors: {name: string, message: any}[], idx: number }>({ open: false, errors: [], idx: 0 });
  const [bulkErrorIdx, setBulkErrorIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [plansResponse, foldersResponse] = await Promise.all([
        axios.get(`/api/flightPlans?userId=${user?.id}`),
        axios.get(`/api/folders?userId=${user?.id}`),
      ]);
      setFlightPlans(plansResponse.data);
      setFolders(foldersResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folderId: number
  ) => {
    const files = e.target.files;
    if (files) {
      const newPlans = await Promise.all(
        Array.from(files).map(async (file) => {
          const response = await axios.post("/api/flightPlans", {
            customName: file.name.replace(/\.[^/.]+$/, ""),
            status: "sin procesar",
            fileContent: await file.text(),
            userId: user?.id,
            folderId: folderId,
          });
          return { ...response.data, file };
        })
      );
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    folderId: number
  ) => {
    handleFileUpload(e, folderId);
  };

  const createFileInput = (folderId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const event = e as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileInputChange(event, folderId);
    };
    return input;
  };

  const handleFolderExpand = (folderId: number) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlans((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  const handleDeselectFolderPlans = (folderId: number) => {
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    const folderPlanIds = folderPlans.map((plan) => plan.id);
    setSelectedPlans((prev) =>
      prev.filter((id) => !folderPlanIds.includes(id))
    );
  };

  const handleProcessFolder = async (folderId: number) => {
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    // Actualizar estado local inmediatamente para todos los planes de la carpeta
    setFlightPlans(
      flightPlans.map((plan) =>
        plan.folderId === folderId ? { ...plan, status: "en cola" } : plan
      )
    );
    // Procesar cada plan
    for (const plan of folderPlans) {
      try {
        const response = await axios.put(`/api/flightPlans/${plan.id}`, {
          status: "en cola",
        });
        // Actualizar el estado con la respuesta del servidor
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === plan.id ? { ...p, ...response.data } : p
          )
        );
      } catch (error) {
        console.error(`Error processing plan ${plan.id}:`, error);
        // Actualizar el estado del plan específico a error
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === plan.id ? { ...p, status: "error" } : p
          )
        );
      }
    }
  };

  const handleDownloadFolder = async (folderId: number) => {
    const folder = folders.find((f) => f.id === folderId);
    const folderPlans = flightPlans.filter(
      (p) => p.folderId === folderId && p.status === "procesado"
    );

    if (folderPlans.length === 0) {
      alert("No plans processed in this folder to download.");
      return;
    }

    const zip = new JSZip();
    const usedNames = new Map();
    await Promise.all(
      folderPlans.map(async (plan) => {
        try {
          const response = await axios.get(`/api/csvResult/${plan.id}`);
          if (response.status === 200) {
            let baseName = `${plan.customName}`;
            let fileName = `${baseName}.csv`;
            let count = 1;
            while (usedNames.has(fileName)) {
              fileName = `${baseName} (${count}).csv`;
              count++;
            }
            usedNames.set(fileName, true);
            zip.file(fileName, response.data.csvResult);
          }
        } catch (error) {
          console.error(`Error downloading CSV for plan ${plan.id}:`, error);
        }
      })
    );

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, `${folder?.name || "folder"}.zip`);
    });
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this folder and all its plans?"
      )
    ) {
      try {
        // Obtener todos los planes de la carpeta
        const folderPlans = flightPlans.filter((p) => p.folderId === folderId);

        // Eliminar primero todos los planes de la carpeta
        await Promise.all(
          folderPlans.map((plan) => axios.delete(`/api/flightPlans/${plan.id}`))
        );

        // Eliminar la carpeta
        await axios.delete(`/api/folders/${folderId}`);

        // Actualizar estado local después de que todo se haya eliminado correctamente
        setFolders((prevFolders) =>
          prevFolders.filter((f) => f.id !== folderId)
        );
        setFlightPlans((prevPlans) =>
          prevPlans.filter((p) => p.folderId !== folderId)
        );
      } catch (error) {
        console.error("Error deleting folder:", error);
        // Recargar los datos en caso de error
        fetchData();
      }
    }
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim() && user?.id) {
      const tempId = Date.now();
      try {
        // Actualizar estado local inmediatamente con una carpeta temporal
        const tempFolder: Folder = {
          id: tempId,
          name: newFolderName,
          userId: user.id,
          flightPlans: [],
        };
        // Añadir la carpeta temporal al estado
        setFolders((prevFolders) => [...prevFolders, tempFolder]);
        setNewFolderName("");

        // Realizar la petición al servidor
        const response = await axios.post("/api/folders", {
          name: newFolderName,
          userId: user.id,
        });

        // Actualizar la carpeta temporal con los datos reales del servidor
        setFolders((prevFolders) =>
          prevFolders.map((f) => (f.id === tempId ? response.data : f))
        );
      } catch (error) {
        console.error("Error creating folder:", error);
        // Eliminar la carpeta temporal en caso de error
        setFolders((prevFolders) => prevFolders.filter((f) => f.id !== tempId));
      }
    }
  };

  const handleCustomNameChange = async (planId: number, newName: string) => {
    try {
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, customName: newName } : plan
        )
      );
      await axios.put(`/api/flightPlans/${planId}`, {
        customName: newName,
      });
    } catch (error) {
      console.error("Error updating plan name:", error);
      fetchData();
    }
  };

  // Utilidad para guardar correctamente en UTC
  const toUTCISOString = (value: string) => (value ? value + ":00Z" : null);

  const handleScheduledAtChange = async (planId: number, value: string) => {
    try {
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                scheduledAt: value ? new Date(value).toISOString() : null,
              }
            : plan
        )
      );
      await axios.put(`/api/flightPlans/${planId}`, {
        scheduledAt: value ? new Date(value).toISOString() : null,
      });
    } catch (error) {
      console.error("Error updating scheduledAt:", error);
      fetchData();
    }
  };

  const handleProcessTrajectory = async (planId: number) => {
    try {
      // Actualizar estado local inmediatamente
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, status: "en cola" } : plan
        )
      );

      // Realizar la petición al servidor
      const response = await axios.put(`/api/flightPlans/${planId}`, {
        status: "en cola",
      });

      // Actualizar el estado con la respuesta del servidor
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, ...response.data } : plan
        )
      );
    } catch (error) {
      console.error("Error processing plan:", error);
      // Revertir el estado en caso de error
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, status: "error" } : plan
        )
      );
    }
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      setFlightPlans(flightPlans.filter((p) => p.id !== planId));
      setSelectedPlans(selectedPlans.filter((id) => id !== planId));
      await axios.delete(`/api/flightPlans/${planId}`);
    } catch (error) {
      console.error("Error deleting plan:", error);
      fetchData();
    }
  };

  const handleProcessSelectedPlans = async () => {
    // Actualizar estado local inmediatamente para todos los planes seleccionados
    setFlightPlans(
      flightPlans.map((plan) =>
        selectedPlans.includes(plan.id) ? { ...plan, status: "en cola" } : plan
      )
    );
    // Procesar cada plan seleccionado
    for (const planId of selectedPlans) {
      try {
        const response = await axios.put(`/api/flightPlans/${planId}`, {
          status: "en cola",
        });
        // Actualizar el estado con la respuesta del servidor
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === planId ? { ...p, ...response.data } : p
          )
        );
      } catch (error) {
        console.error(`Error processing plan ${planId}:`, error);
        // Actualizar el estado del plan específico a error
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === planId ? { ...p, status: "error" } : p
          )
        );
      }
    }
  };

  const handleDownloadSelectedPlans = async () => {
    if (selectedPlans.length === 0) {
      alert("No plans selected to download.");
      return;
    }

    const zip = new JSZip();
    const usedNames = new Map();
    await Promise.all(
      selectedPlans.map(async (id) => {
        const plan = flightPlans.find((p) => p.id === id);
        if (plan?.status === "procesado" && plan.csvResult) {
          try {
            const response = await axios.get(`/api/csvResult/${id}`);
            if (response.status === 200) {
              let baseName = `${plan.customName}`;
              let fileName = `${baseName}.csv`;
              let count = 1;
              while (usedNames.has(fileName)) {
                fileName = `${baseName} (${count}).csv`;
                count++;
              }
              usedNames.set(fileName, true);
              zip.file(fileName, response.data.csvResult);
            }
          } catch (error) {
            console.error(`Error downloading CSV for plan ${id}:`, error);
          }
        }
      })
    );

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "selected_plans.zip");
    });
  };

  const handleDeleteSelectedPlans = async () => {
    if (window.confirm("Are you sure you want to delete the selected plans?")) {
      try {
        setFlightPlans(
          flightPlans.filter((p) => !selectedPlans.includes(p.id))
        );
        setSelectedPlans([]);
        await Promise.all(
          selectedPlans.map((planId) =>
            axios.delete(`/api/flightPlans/${planId}`)
          )
        );
      } catch (error) {
        console.error("Error deleting selected plans:", error);
        fetchData();
      }
    }
  };

  const downloadCsv = async (planId: number, fileName: string) => {
    try {
      const response = await axios.get(`/api/csvResult/${planId}`);
      if (response.status === 200) {
        const csvData = response.data.csvResult;
        const blob = new Blob([csvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.setAttribute("hidden", "");
        a.setAttribute("href", url);
        a.setAttribute("download", fileName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error in CSV download:", error);
    }
  };

  const countByStatus = (status: string) =>
    flightPlans.filter((plan) => plan.status === status).length;

  const getFolderStatusCounts = (folderId: number) => {
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    return {
      sinProcesar: folderPlans.filter((plan) => plan.status === "sin procesar")
        .length,
      enCola: folderPlans.filter((plan) => plan.status === "en cola").length,
      procesando: folderPlans.filter((plan) => plan.status === "procesando")
        .length,
      procesado: folderPlans.filter((plan) => plan.status === "procesado")
        .length,
      error: folderPlans.filter((plan) => plan.status === "error").length,
    };
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "sin procesar":
        return "bg-gray-500";
      case "en cola":
        return "bg-yellow-500";
      case "procesando":
        return "bg-blue-500";
      case "procesado":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleFolderFilterChange = (folderId: number, value: string) => {
    setFolderFilters((prev) => ({
      ...prev,
      [folderId]: value,
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent, folderId?: number) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files) {
      const newPlans = await Promise.all(
        Array.from(files).map(async (file) => {
          const response = await axios.post("/api/flightPlans", {
            customName: file.name.replace(/\.[^/.]+$/, ""),
            status: "sin procesar",
            fileContent: await file.text(),
            userId: user?.id,
            folderId: folderId || null,
          });
          return { ...response.data, file };
        })
      );
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };

  const handleRequestAuthorization = async (planId: number) => {
    setAuthorizationLoading((prev) => ({ ...prev, [planId]: true }));
    // Cambiar estado localmente a "procesando autorización"
    setFlightPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? { ...plan, authorizationStatus: "procesando autorización" }
          : plan
      )
    );
    try {
      // Actualizar el estado en la base de datos
      await axios.put(`/api/flightPlans/${planId}`, {
        authorizationStatus: "procesando autorización",
      });
      // Llamar al endpoint de generación de U-Plan
      await axios.post(`/api/flightPlans/${planId}/uplan`);
      // No actualizamos el estado local a aprobado o denegado aquí, dejamos que fetchData lo haga
    } catch (error: any) {
      // Error de red o del backend
      const errorMsg =
        error?.response?.data?.error || error?.message || "Unknown error";
      // Opcional: podrías mostrar un toast o alerta, pero no cambies el estado local a denegado
      console.error("Error requesting authorization:", errorMsg);
    } finally {
      setAuthorizationLoading((prev) => ({ ...prev, [planId]: false }));
    }
  };

  const downloadUplan = (plan: FlightPlan) => {
    if (!plan.uplan) return;
    const blob = new Blob([JSON.stringify(plan.uplan, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.customName}_uplan.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAuthorizationMessage = (plan: FlightPlan) => {
    if (!plan.authorizationMessage) return;
    const blob = new Blob(
      [
        typeof plan.authorizationMessage === "string"
          ? plan.authorizationMessage
          : JSON.stringify(plan.authorizationMessage, null, 2),
      ],
      { type: "application/json" }
    );
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.customName}_authorization_error.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFolderScheduledAtChange = async (
    folderId: number,
    field: "minScheduledAt" | "maxScheduledAt",
    value: string
  ) => {
    try {
      setFolders(
        folders.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                [field]: value ? new Date(value).toISOString() : null,
              }
            : folder
        )
      );
      await axios.put(`/api/folders/${folderId}`, {
        [field]: value ? new Date(value).toISOString() : null,
      });
    } catch (error) {
      console.error(`Error updating ${field} for folder:`, error);
      fetchData();
    }
  };

  const handleRandomizeScheduledAt = async (folderId: number) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder || !folder.minScheduledAt || !folder.maxScheduledAt) return;
    const min = new Date(folder.minScheduledAt).getTime();
    const max = new Date(folder.maxScheduledAt).getTime();
    if (isNaN(min) || isNaN(max) || min >= max) return;
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    try {
      // Generar y enviar todas las actualizaciones en paralelo
      const updates = await Promise.all(
        folderPlans.map(async (plan) => {
          const randomTime = new Date(min + Math.random() * (max - min));
          const iso = randomTime.toISOString();
          await axios.put(`/api/flightPlans/${plan.id}`, { scheduledAt: iso });
          return { ...plan, scheduledAt: iso };
        })
      );
      // Actualizar el estado local solo después de que todas las peticiones hayan sido exitosas
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan) => {
          const updated = updates.find((u) => u.id === plan.id);
          return updated ? updated : plan;
        })
      );
    } catch (error) {
      console.error("Error randomizing times:", error);
      fetchData();
    }
  };

  const handleSelectFolderPlansByStatus = (
    folderId: number,
    status: string
  ) => {
    const folderPlans = flightPlans.filter((plan) => {
      if (status === "Todos") return plan.folderId === folderId;
      if (
        [
          "sin procesar",
          "en cola",
          "procesando",
          "procesado",
          "error",
        ].includes(status)
      ) {
        return plan.folderId === folderId && plan.status === status;
      }
      if (["sin autorización", "aprobado", "denegado"].includes(status)) {
        return (
          plan.folderId === folderId && plan.authorizationStatus === status
        );
      }
      return false;
    });
    const folderPlanIds = folderPlans.map((plan) => plan.id);
    setSelectedPlans((prev) => [
      ...prev,
      ...folderPlanIds.filter((id) => !prev.includes(id)),
    ]);
  };

  const handleFolderPageChange = (
    folderId: number,
    newPage: number,
    total: number
  ) => {
    setFolderPages((prev) => ({
      ...prev,
      [folderId]: Math.max(1, Math.min(newPage, total)),
    }));
  };

  const handleRequestAuthorizationSelected = async () => {
    for (const planId of selectedPlans) {
      const plan = flightPlans.find((p) => p.id === planId);
      if (
        plan &&
        plan.status === "procesado" &&
        (!plan.authorizationStatus ||
          plan.authorizationStatus === "sin autorización")
      ) {
        await handleRequestAuthorization(planId);
      }
    }
  };
  // 1. Cambiar los handlers para recibir folderId y descargar todos los autorizados/denegados de la carpeta
  const handleDownloadUplansFolder = async (folderId: number) => {
    const plans = flightPlans.filter(
      (p) =>
        p.folderId === folderId &&
        p.authorizationStatus === "aprobado" &&
        p.uplan
    );
    if (plans.length === 0) {
      alert("No authorized U-Plans in this folder.");
      return;
    }
    const zip = new JSZip();
    plans.forEach((plan) => {
      zip.file(
        `${plan.customName}_uplan.json`,
        JSON.stringify(plan.uplan, null, 2)
      );
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `uplans_authorized_${folderId}.zip`);
  };
  const handleDownloadDenegationMessagesFolder = async (folderId: number) => {
    const plans = flightPlans.filter(
      (p) =>
        p.folderId === folderId &&
        p.authorizationStatus === "denegado" &&
        p.authorizationMessage
    );
    if (plans.length === 0) {
      alert("No denial messages in this folder.");
      return;
    }
    const zip = new JSZip();
    plans.forEach((plan) => {
      zip.file(
        `${plan.customName}_authorization_error.json`,
        typeof plan.authorizationMessage === "string"
          ? plan.authorizationMessage
          : JSON.stringify(plan.authorizationMessage, null, 2)
      );
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `denial_messages_${folderId}.zip`);
  };

  // Function to fetch and show CSV content in modal
  const handleViewCsv = async (planId: number, customName: string) => {
    try {
      const response = await axios.get(`/api/csvResult/${planId}`);
      if (response.status === 200) {
        const traj = parseTrajectoryCsv(response.data.csvResult);
        setTrajectoryData([traj]);
        setTrajectoryIdxs([0]);
        setTrajectoryNames([customName]);
        setTrajectoryModalTitle(`${customName} Trajectory`);
        setTrajectoryModalOpen(true);
      }
    } catch (error) {
      setTrajectoryData([]);
      setTrajectoryIdxs([]);
      setTrajectoryNames([]);
      setTrajectoryModalTitle('Error loading trajectory');
      setTrajectoryModalOpen(true);
    }
  };

  // Function to view all selected plans as CSV (concatenated)
  const handleViewSelectedPlans = async () => {
    if (selectedPlans.length === 0) {
      alert("No plans selected to view.");
      return;
    }
    const trajs: TrajectoryRow[][] = [];
    const names: string[] = [];
    for (const id of selectedPlans) {
      const plan = flightPlans.find((p) => p.id === id);
      if (plan && plan.status === "procesado" && plan.csvResult) {
        try {
          const response = await axios.get(`/api/csvResult/${id}`);
          if (response.status === 200) {
            const traj = parseTrajectoryCsv(response.data.csvResult);
            trajs.push(traj);
            names.push(plan.customName);
          }
        } catch (error) {
          // skip
        }
      }
    }
    if (trajs.length === 0) {
      setTrajectoryData([]);
      setTrajectoryIdxs([]);
      setTrajectoryNames([]);
      setTrajectoryModalTitle('No processed plans selected.');
      setTrajectoryModalOpen(true);
      return;
    }
    setTrajectoryData(trajs);
    setTrajectoryIdxs(trajs.map(() => 0));
    setTrajectoryNames(names);
    setTrajectoryModalTitle('Selected Trajectories');
    setTrajectoryModalOpen(true);
  };

  const handleViewFolderProcessedPlans = async (folderId: number) => {
    const folder = folders.find(f => f.id === folderId);
    const folderPlans = flightPlans.filter(
      (p) => p.folderId === folderId && p.status === "procesado"
    );
    if (folderPlans.length === 0) {
      alert("No processed plans in this folder to view.");
      return;
    }
    const trajs: TrajectoryRow[][] = [];
    const names: string[] = [];
    for (const plan of folderPlans) {
      try {
        const response = await axios.get(`/api/csvResult/${plan.id}`);
        if (response.status === 200) {
          const traj = parseTrajectoryCsv(response.data.csvResult);
          trajs.push(traj);
          names.push(plan.customName);
        }
      } catch (error) {
        // skip
      }
    }
    if (trajs.length === 0) {
      setTrajectoryData([]);
      setTrajectoryIdxs([]);
      setTrajectoryNames([]);
      setTrajectoryModalTitle('No processed plans in this folder.');
      setTrajectoryModalOpen(true);
      return;
    }
    setTrajectoryData(trajs);
    setTrajectoryIdxs(trajs.map(() => 0));
    setTrajectoryNames(names);
    setTrajectoryModalTitle(`Folder ${folder?.name || ''} trajectories`);
    setTrajectoryModalOpen(true);
  };

  const handleViewBulkUplansFolder = (folderId: number) => {
    const plans = flightPlans.filter(
      (p) => p.folderId === folderId && p.authorizationStatus === "aprobado" && p.uplan
    );
    if (plans.length === 0) {
      alert("No authorized U-Plans in this folder.");
      return;
    }
    setBulkUplanViewModal({
      open: true,
      uplans: plans.map(p => p.uplan),
      names: plans.map(p => p.customName)
    });
  };

  const handleViewSelectedErrors = () => {
    const errors = selectedPlans
      .map(id => {
        const plan = flightPlans.find(p => p.id === id);
        if (plan && plan.authorizationStatus === 'denegado' && plan.authorizationMessage) {
          return { name: plan.customName, message: plan.authorizationMessage };
        }
        return null;
      })
      .filter(Boolean) as { name: string, message: any }[];
    if (errors.length === 0) {
      alert('No selected errors to view.');
      return;
    }
    setBulkErrorViewModal({ open: true, errors, idx: 0 });
  };

  // Function to view only selected authorized U-Plans
  const handleViewSelectedAuthorizedUplans = () => {
    const plans = selectedPlans
      .map(id => flightPlans.find(p => p.id === id))
      .filter(p => p && p.authorizationStatus === "aprobado" && p.uplan);
    if (plans.length === 0) {
      alert("No selected authorized U-Plans to view.");
      return;
    }
    setBulkUplanViewModal({
      open: true,
      uplans: plans.map(p => p?.uplan ?? {}),
      names: plans.map(p => p?.customName ?? "")
    });
  };

  return (
    <div className="bg-gray-900 p-6 pt-8 pb-2">
      {/* Help Button */}
      <a
        href="/how-it-works#trajectory-generator-help"
        target="_self"
        className="fixed top-24 right-8 z-50 bg-blue-700 hover:bg-blue-800 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
        title="Need help with Trajectory Generator?"
      >
        <HelpCircle className="w-6 h-6" />
      </a>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">
          Flight Plan Manager
        </h1>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Unprocessed</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("sin procesar")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Queued</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("en cola")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Processing</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("procesando")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Processed</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("procesado")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Error</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("error")}
              </div>
            </div>
          </div>
        </div>

        {user ? (
          <>
            <div className="mb-6 flex gap-4">
              <Input
                placeholder="New folder"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 bg-gray-700 text-white text-base"
              />
              <Button
                variant="outline"
                onClick={handleCreateFolder}
                className="text-blue-400/80 hover:bg-blue-500/80 hover:text-white border-blue-400/30 hover:border-blue-500 transition-all duration-200 text-base h-[60px] px-6 whitespace-normal"
              >
                <div className="flex items-center">
                  <FolderPlusIcon className="h-4 w-4 mr-2" />
                  Create Folder
                </div>
              </Button>
            </div>

            {/* Render folders */}
            {folders.map((folder) => {
              const folderPlans = flightPlans.filter(
                (p) => p.folderId === folder.id
              );
              const isExpanded = expandedFolders.includes(folder.id);
              const statusCounts = getFolderStatusCounts(folder.id);
              const filteredPlans = folderPlans.filter((plan) =>
                plan.customName
                  .toLowerCase()
                  .includes((folderFilters[folder.id] || "").toLowerCase())
              );

              const page = folderPages[folder.id] || 1;
              const plansPerPage = PLANS_PER_FOLDER_PAGE;
              const totalFolderPages = Math.max(
                1,
                Math.ceil(filteredPlans.length / plansPerPage)
              );
              const paginatedPlans = filteredPlans.slice(
                (page - 1) * plansPerPage,
                page * plansPerPage
              );

              return (
                <div
                  key={folder.id}
                  className="mb-6 border border-gray-700 rounded-lg overflow-hidden shadow-lg"
                >
                  <div
                    className="flex items-center justify-between p-4 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors"
                    onClick={() => handleFolderExpand(folder.id)}
                  >
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-semibold text-white">
                        {folder.name}
                      </h2>
                      <div className="flex gap-2">
                        <Badge className="bg-gray-700/90 text-white">
                          Unprocessed: {statusCounts.sinProcesar}
                        </Badge>
                        <Badge className="bg-yellow-500/90 text-white">
                          Queued: {statusCounts.enCola}
                        </Badge>
                        <Badge className="bg-violet-500/90 text-white">
                          Processing: {statusCounts.procesando}
                        </Badge>
                        <Badge className="bg-green-500/90 text-white">
                          Processed: {statusCounts.procesado}
                        </Badge>
                        <Badge className="bg-red-500/90 text-white">
                          Error: {statusCounts.error}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessFolder(folder.id);
                        }}
                        className="text-violet-400 hover:bg-violet-500/90 hover:text-white border-violet-400/50 hover:border-violet-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <RotateCwIcon className="h-4 w-4 mr-2" />
                          Process
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewFolderProcessedPlans(folder.id);
                        }}
                        className="text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <EyeIcon className="h-5 w-5 mr-2" />
                          View
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFolder(folder.id);
                        }}
                        className="text-green-400 hover:bg-green-500/80 hover:text-white border-green-400/50 hover:border-green-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Download
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="text-rose-400 hover:bg-rose-500/90 hover:text-white border-rose-400/50 hover:border-rose-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <Trash2Icon className="h-4 w-4 mr-2" />
                          Delete
                        </div>
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-gray-900">
                      <div className="mb-4">
                        <div
                          className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
                            isDragging
                              ? "border-blue-500 bg-blue-900/20"
                              : "border-gray-700 hover:border-blue-500 hover:bg-blue-900/10"
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, folder.id)}
                          onClick={() => {
                            const input = createFileInput(folder.id);
                            input.click();
                          }}
                        >
                          <div className="flex flex-col items-center justify-center text-center">
                            <UploadIcon className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-gray-400">
                              Drag and drop files here or click to select
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 flex flex-col gap-4">
                        <div className="flex justify-between">
                          <div className="flex-1 flex gap-2 pr-16">
                            {folderPlans.some((plan) =>
                              selectedPlans.includes(plan.id)
                            ) && (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => handleProcessSelectedPlans()}
                                  className="text-violet-400/80 hover:bg-violet-500/80 hover:text-white border-violet-400/30 hover:border-violet-500 transition-all duration-200 text-sm h-[36px] px-3 whitespace-normal flex items-center justify-center"
                                >
                                  <RotateCwIcon className="h-3.5 w-3.5 mr-1.5" />
                                  Process selected
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleViewSelectedPlans()}
                                  className="text-blue-400/80 hover:bg-blue-500/80 hover:text-white border-blue-400/30 hover:border-blue-500 transition-all duration-200 text-sm h-[36px] px-3 whitespace-normal flex items-center justify-center"
                                >
                                  <EyeIcon className="h-4 w-4 mr-1.5" />
                                  View selected
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDownloadSelectedPlans()}
                                  className="text-green-500 hover:bg-green-500/80 hover:text-white border-green-300/30 hover:border-green-500 transition-all duration-200 text-sm h-[36px] px-3 whitespace-normal flex items-center justify-center"
                                >
                                  <DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
                                  Download selected
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDeleteSelectedPlans()}
                                  className="text-rose-400/80 hover:bg-rose-500/80 hover:text-white border-rose-400/30 hover:border-rose-500 transition-all duration-200 text-sm h-[36px] px-3 whitespace-normal flex items-center justify-center"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5 mr-1.5" />
                                  Delete selected
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="flex-none flex gap-2 pl-16 items-center">
                            <a className="mr-2">Select:</a>
                            <select
                              value={folderSelectStatus[folder.id] || "Todos"}
                              onChange={(e) => {
                                setFolderSelectStatus((prev) => ({
                                  ...prev,
                                  [folder.id]: e.target.value,
                                }));
                                handleSelectFolderPlansByStatus(
                                  folder.id,
                                  e.target.value
                                );
                              }}
                              className="bg-gray-700 text-white border border-gray-500 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="Todos">All</option>
                              <option value="sin procesar">Unprocessed</option>
                              <option value="en cola">Queued</option>
                              <option value="procesando">Processing</option>
                              <option value="procesado">Processed</option>
                              <option value="error">Error</option>
                              <option value="sin autorización">
                                No authorization
                              </option>
                              <option value="aprobado">Authorized</option>
                              <option value="denegado">Denied</option>
                            </select>
                            <Button
                              variant="outline"
                              onClick={() =>
                                handleDeselectFolderPlans(folder.id)
                              }
                              className="text-gray-400/80 hover:bg-gray-500/80 hover:text-white border-gray-400/30 hover:border-gray-500 transition-all duration-200 text-sm h-[36px] px-3 whitespace-normal"
                            >
                              <div className="flex items-center">
                                <XIcon className="h-3.5 w-3.5 mr-1.5" />
                                Deselect
                              </div>
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center w-full py-2 border-b border-gray-700 mb-2">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="text-violet-400/80 hover:bg-violet-500/80 hover:text-white border-violet-400/30 hover:border-violet-500 transition-all duration-200 text-sm h-[60px] min-h-[60px] px-3 whitespace-normal flex items-center justify-center"
                              onClick={handleRequestAuthorizationSelected}
                              disabled={selectedPlans.length === 0}
                            >
                              Request Auth for selected
                            </Button>
                            <Button
                              variant="outline"
                              className="text-green-400/80 hover:bg-green-500/80 hover:text-white border-green-400/30 hover:border-green-500 transition-all duration-200 text-sm h-[60px] min-h-[60px] px-3 whitespace-normal flex items-center justify-center"
                              onClick={handleViewSelectedAuthorizedUplans}
                              disabled={
                                !selectedPlans.some(
                                  id => {
                                    const plan = flightPlans.find(p => p.id === id);
                                    return plan && plan.authorizationStatus === "aprobado" && plan.uplan;
                                  }
                                )
                              }
                            >
                              View selected U-Plans
                            </Button>
                            <Button
                              variant="outline"
                              className="text-rose-400/80 hover:bg-rose-500/80 hover:text-white border-rose-400/50 hover:border-rose-500 transition-all duration-200 text-sm h-[60px] min-h-[60px] px-3 whitespace-normal flex items-center justify-center"
                              onClick={handleViewSelectedErrors}
                              disabled={
                                !selectedPlans.some(
                                  id => {
                                    const plan = flightPlans.find(p => p.id === id);
                                    return plan && plan.authorizationStatus === "denegado" && plan.authorizationMessage;
                                  }
                                )
                              }
                            >
                              View selected errors
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-gray-300 text-sm">
                              Min:
                            </label>
                            <input
                              type="datetime-local"
                              value={
                                folder.minScheduledAt
                                  ? new Date(folder.minScheduledAt)
                                      .toISOString()
                                      .slice(0, 16)
                                  : ""
                              }
                              onChange={(e) =>
                                handleFolderScheduledAtChange(
                                  folder.id,
                                  "minScheduledAt",
                                  e.target.value
                                )
                              }
                              className="bg-gray-700/50 border border-gray-600 rounded-md px-2 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 w-[180px]"
                              placeholder="Minimum time"
                            />
                            <label className="text-gray-300 text-sm">
                              Max:
                            </label>
                            <input
                              type="datetime-local"
                              value={
                                folder.maxScheduledAt
                                  ? new Date(folder.maxScheduledAt)
                                      .toISOString()
                                      .slice(0, 16)
                                  : ""
                              }
                              onChange={(e) =>
                                handleFolderScheduledAtChange(
                                  folder.id,
                                  "maxScheduledAt",
                                  e.target.value
                                )
                              }
                              className="bg-gray-700/50 border border-gray-600 rounded-md px-2 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 w-[180px]"
                              placeholder="Maximum time"
                            />
                            <Button
                              variant="outline"
                              className="text-blue-400/80 min-h-[60px] hover:bg-blue-500/80 hover:text-white border-blue-400/30 hover:border-blue-500 transition-all duration-200 text-sm h-[48px] px-3 whitespace-normal"
                              onClick={() =>
                                handleRandomizeScheduledAt(folder.id)
                              }
                              disabled={
                                !folder.minScheduledAt || !folder.maxScheduledAt
                              }
                            >
                              Randomize times
                            </Button>
                          </div>
                        </div>
                      </div>

                      {filteredPlans.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">
                          This folder is empty
                        </p>
                      ) : (
                        <>
                          {paginatedPlans.map((plan) => (
                            <div
                              key={plan.id}
                              className="bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 p-4 border border-gray-700/50 hover:border-gray-600/50"
                            >
                              <div className="flex items-center gap-4 h-12 min-h-[48px]">
                                <Checkbox
                                  checked={selectedPlans.includes(plan.id)}
                                  onCheckedChange={(checked) =>
                                    handleSelectPlan(plan.id)
                                  }
                                  className="border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 shrink-0 hover:border-blue-400 transition-colors h-5 w-5 min-w-[8px] min-h-[8px]"
                                />
                                <input
                                  type="text"
                                  value={plan.customName}
                                  onChange={(e) =>
                                    handleCustomNameChange(
                                      plan.id,
                                      e.target.value
                                    )
                                  }
                                  className="flex-1 bg-gray-700/50 border border-gray-600 rounded-md px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 h-12 min-h-[48px]"
                                  placeholder="Plan name"
                                />
                                <input
                                  type="datetime-local"
                                  value={plan.scheduledAt ? new Date(plan.scheduledAt).toISOString().slice(0, 16) : ""}
                                  onChange={(e) => handleScheduledAtChange(plan.id, e.target.value)}
                                  className="ml-2 bg-gray-700/50 border border-gray-600 rounded-md px-2 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 w-[210px] h-12 min-h-[48px]"
                                  placeholder="Flight date and time"
                                />
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    plan.status === "procesado"
                                      ? downloadCsv(
                                          plan.id,
                                          `${plan.customName}.csv`
                                        )
                                      : handleProcessTrajectory(plan.id)
                                  }
                                  disabled={plan.status === "en cola" || plan.status === "procesando"}
                                  className={`
                                    ${plan.status === "procesado" ? "min-w-[56px] max-w-[56px] h-12 min-h-[48px]" : "min-w-[140px] max-w-[140px] h-12 min-h-[48px]"} items-center justify-center transition-all duration-200"
                                    ${
                                      plan.status === "sin procesar"
                                        ? "text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500"
                                        : ""
                                    }
                                    ${
                                      plan.status === "en cola"
                                        ? "text-amber-500 border-amber-500 hover:text-yellow-400 hover:border-yellow-400"
                                        : ""
                                    }
                                    ${
                                      plan.status === "procesando"
                                        ? "text-violet-400 hover:bg-violet-500/90 hover:text-white border-violet-400/50 hover:border-violet-500"
                                        : ""
                                    }
                                    ${
                                      plan.status === "procesado"
                                        ? "ml-[4px] text-green-400 hover:bg-green-500/80 hover:text-white border-green-400/50 hover:border-green-500 transition-all duration-200"
                                        : ""
                                    }
                                    disabled:opacity-75 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current
                                  `}
                                >
                                  {plan.status === "en cola" && (
                                    <div className="flex items-center text-amber-400">
                                      <ClockIcon className="h-4 w-4 mr-2 text-amber-400" />
                                      Queued
                                    </div>
                                  )}
                                  {plan.status === "procesando" && (
                                    <div className="flex items-center">
                                      <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                                      Processing
                                    </div>
                                  )}
                                  {plan.status === "procesado" && <DownloadIcon className="h-5 w-5" />}
                                  {plan.status === "sin procesar" && (
                                    <div className="flex items-center">
                                      <PlayIcon className="h-4 w-4 mr-2" />
                                      Process
                                    </div>
                                  )}
                                  <span className="sr-only">
                                    {plan.status === "procesado" ? "Download" : plan.status === "sin procesar" ? "Process" : plan.status}
                                  </span>
                                </Button>
                                {plan.status === "procesado" && (
                                  <Button
                                    variant="outline"
                                    onClick={() => handleViewCsv(plan.id, plan.customName)}
                                    className="ml-8px min-w-[56px] max-w-[56px] items-center justify-center ml-2 text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500 h-12 min-h-[48px]"
                                  >
                                    <EyeIcon className="h-5 w-5" />
                                    <span className="sr-only">View</span>
                                  </Button>
                                )}
                                <div>
                                  {(
                                    plan.authorizationStatus === undefined ||
                                    plan.authorizationStatus === null ||
                                    plan.authorizationStatus === "sin autorización"
                                  ) ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => handleRequestAuthorization(plan.id)}
                                      disabled={authorizationLoading[plan.id] || plan.status !== "procesado"}
                                      className={
                                        `text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500 min-w-[153px] ml-2 flex items-center justify-center h-12 min-h-[48px]` +
                                        (authorizationLoading[plan.id] || plan.status !== "procesado"
                                          ? " opacity-50 cursor-not-allowed"
                                          : "")
                                      }
                                    >
                                      <div className="flex items-center justify-center">
                                        {authorizationLoading[plan.id] ? (
                                          <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                          <PlayIcon className="h-4 w-4 mr-2" />
                                        )}
                                        Request Auth
                                      </div>
                                    </Button>
                                  ) : plan.authorizationStatus === "procesando autorización" ? (
                                    <Button
                                      variant="outline"
                                      disabled
                                      className="text-violet-400 border-violet-400/50 min-w-[153px] ml-2 flex items-center justify-center h-12 min-h-[48px]"
                                    >
                                      <div className="flex items-center justify-center">
                                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                                        Request Auth
                                      </div>
                                    </Button>
                                  ) : plan.authorizationStatus === "denegado" ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => setUplanErrorModal({ open: true, message: plan.authorizationMessage || 'No message' })}
                                      className="text-rose-400 hover:bg-rose-500/90 hover:text-white border-rose-400/50 hover:border-rose-500 min-w-[153px] ml-2 flex items-center justify-center h-12 min-h-[48px]"
                                    >
                                      <div className="flex items-center justify-center">
                                        <XIcon className="h-4 w-4 mr-2" />
                                        View error
                                      </div>
                                    </Button>
                                  ) : plan.authorizationStatus === "aprobado" ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => setUplanViewModal({ open: true, uplan: plan.uplan, name: plan.customName })}
                                      className="text-green-400 hover:bg-green-500/90 hover:text-white border-green-400/50 hover:border-green-500 min-w-[153px] ml-2 flex items-center justify-center h-12 min-h-[48px]"
                                    >
                                      <div className="flex items-center justify-center">
                                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                                        View U-plan
                                      </div>
                                    </Button>
                                  ) : null}
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDeletePlan(plan.id)}
                                  className="text-rose-400 hover:bg-rose-500/90 hover:text-white border-rose-400/50 hover:border-rose-500 transition-all duration-200 p-2 shrink-0 h-10 min-h-[48px] flex items-center justify-center ml-2"
                                >
                                  <Trash2Icon className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {totalFolderPages > 1 && (
                            <div className="flex justify-between items-center mt-2">
                              <Button
                                onClick={() =>
                                  handleFolderPageChange(
                                    folder.id,
                                    page - 1,
                                    totalFolderPages
                                  )
                                }
                                disabled={page === 1}
                                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
                              >
                                Anterior
                              </Button>
                              <span className="text-white">
                                Page {page} of {totalFolderPages}
                              </span>
                              <Button
                                onClick={() =>
                                  handleFolderPageChange(
                                    folder.id,
                                    page + 1,
                                    totalFolderPages
                                  )
                                }
                                disabled={page === totalFolderPages}
                                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
                              >
                                Siguiente
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-between mt-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
              >
                Anterior
              </Button>
              <span className="text-white">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
              >
                Siguiente
              </Button>
            </div>
          </>
        ) : (
          <p className="text-center text-red-500">You must be logged in</p>
        )}
      </div>
      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} title={viewModalTitle}>
        <pre className="whitespace-pre-wrap text-xs max-h-[60vh] overflow-auto bg-gray-800 p-4 rounded-lg border border-gray-700 text-gray-100">{viewModalContent}</pre>
      </Modal>
      <TrajectoryViewerModal
        open={trajectoryModalOpen}
        onClose={() => setTrajectoryModalOpen(false)}
        title={trajectoryModalTitle}
        trajectories={trajectoryData}
        currentIdxs={trajectoryIdxs}
        setCurrentIdxs={setTrajectoryIdxs}
        names={trajectoryNames}
      />
      <UplanErrorModal
        open={uplanErrorModal.open}
        onClose={() => setUplanErrorModal({ open: false, message: '' })}
        message={uplanErrorModal.message}
      />
      <UplanViewModal
        open={uplanViewModal.open}
        onClose={() => setUplanViewModal({ open: false, uplan: null, name: '' })}
        uplan={uplanViewModal.uplan}
        name={uplanViewModal.name}
      />
      {/* Bulk Uplan Modal placeholder */}
      <Modal open={bulkUplanViewModal.open} onClose={() => setBulkUplanViewModal({ open: false, uplans: [], names: [] })} title="Bulk U-Plan Viewer">
        <div className="p-4 text-white">Bulk U-Plan visualization coming soon.</div>
        <Button onClick={() => setBulkUplanViewModal({ open: false, uplans: [], names: [] })} className="mt-4">Close</Button>
      </Modal>
      {/* Bulk Error Modal placeholder */}
      <Modal open={bulkErrorViewModal.open} onClose={() => setBulkErrorViewModal({ open: false, errors: [], idx: 0 })} title="Bulk Error Viewer">
        <div className="p-4 text-white">Bulk error viewing coming soon.</div>
        <Button onClick={() => setBulkErrorViewModal({ open: false, errors: [], idx: 0 })} className="mt-4">Close</Button>
      </Modal>
      <BulkUplanViewModal
        open={bulkUplanViewModal.open}
        onClose={() => setBulkUplanViewModal({ open: false, uplans: [], names: [] })}
        uplans={bulkUplanViewModal.uplans}
        names={bulkUplanViewModal.names}
      />
      <BulkErrorViewModal
        open={bulkErrorViewModal.open}
        onClose={() => setBulkErrorViewModal({ open: false, errors: [], idx: 0 })}
        errors={bulkErrorViewModal.errors}
        idx={bulkErrorIdx}
        setIdx={setBulkErrorIdx}
      />
    </div>
  );
}

export default FlightPlansUploader;
