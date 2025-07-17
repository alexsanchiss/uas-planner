"use client";
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from "./ui/modal";

// TrajectoryViewerModal moved from FlightPlansUploader
export type TrajectoryRow = {
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

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  trajectories: TrajectoryRow[][];
  currentIdxs: number[];
  setCurrentIdxs: (idxs: number[] | ((prev: number[]) => number[])) => void;
  names: string[];
}

const colors = ["#3b82f6", "#22d3ee", "#f59e42", "#ef4444", "#a78bfa", "#10b981", "#f472b6", "#facc15"];

const MapModal: React.FC<MapModalProps> = ({ open, onClose, title, trajectories, currentIdxs, setCurrentIdxs, names }) => {
  if (!open || !trajectories || trajectories.length === 0 || trajectories[0].length === 0) return null;
  const polylines = trajectories.map(traj => traj.map(row => [row.Lat, row.Lon] as [number, number]));
  const currentMarkers = trajectories.map((traj, i) => traj[currentIdxs[i]] || traj[0]);
  const center = polylines[0][0];
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
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
  const minLen = Math.min(...trajectories.map(t => t.length));
  const globalIdx = currentIdxs[0] || 0;
  const handleSlider = (val: number) => setCurrentIdxs(currentIdxs.map(() => val));
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="w-[400px] h-[400px] mb-4 relative">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
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
              pathOptions={{ color: colors[i % colors.length], fillColor: colors[i % colors.length], fillOpacity: 0.8 }}
            >
              <Tooltip permanent direction="top">
                ALT: {current.Alt}
              </Tooltip>
              <Tooltip>
                {names[i]}<br />
                Alt: {current.Alt}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="absolute top-2 right-2 bg-gray-900/80 rounded p-2 max-h-[90%] overflow-y-auto flex flex-col gap-2 min-w-[120px]">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span style={{ background: colors[i % colors.length], width: 12, height: 12, display: 'inline-block', borderRadius: 6 }}></span>
              <span className="font-semibold">{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-base text-center text-blue-200 font-semibold mb-1">
          Time: {trajectories[0][globalIdx]?.SimTime}
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
};

export default MapModal; 