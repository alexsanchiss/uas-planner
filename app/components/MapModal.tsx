"use client";
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Tooltip, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from "./ui/modal";

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
  const [playing, setPlaying] = useState(false);
  
  // ESC key to close modal
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  
  // Animation playback effect
  useEffect(() => {
    if (!playing || !trajectories || trajectories.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIdxs((prev: number[]) => {
        const max = Math.max(...trajectories.map(t => t.length - 1));
        return prev.map(idx => (idx < max ? idx + 1 : 0));
      });
    }, 60);
    return () => clearInterval(interval);
  }, [playing, trajectories, setCurrentIdxs]);
  
  // Early return after hooks
  if (!open || !trajectories || trajectories.length === 0 || trajectories[0].length === 0) return null;
  
  const polylines = trajectories.map(traj => traj.map(row => [row.Lat, row.Lon] as [number, number]));
  const currentMarkers = trajectories.map((traj, i) => traj[currentIdxs[i]] || traj[0]);
  const center = polylines[0][0];
  const minLen = Math.min(...trajectories.map(t => t.length));
  const globalIdx = currentIdxs[0] || 0;
  const handleSlider = (val: number) => setCurrentIdxs(currentIdxs.map(() => val));
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="w-full max-w-[95vw] md:max-w-[600px] h-[50vh] md:h-[400px] max-h-[70vh] min-h-[200px] mb-4 relative overflow-hidden rounded-lg">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%' }}
        >
          <MapResizeHandler />
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
        {/* Legend - responsive positioning */}
        <div className="absolute top-2 right-2 bg-gray-900/80 rounded p-1.5 sm:p-2 max-h-[40%] sm:max-h-[90%] overflow-y-auto flex flex-col gap-1 sm:gap-2 min-w-[80px] sm:min-w-[120px]">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs whitespace-nowrap">
              <span style={{ background: colors[i % colors.length], width: 10, height: 10, display: 'inline-block', borderRadius: 5 }} className="sm:w-3 sm:h-3 sm:rounded-md"></span>
              <span className="font-semibold truncate max-w-[60px] sm:max-w-none">{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm sm:text-base text-center text-blue-200 font-semibold mb-1">
          Time: {trajectories[0][globalIdx]?.SimTime}
        </div>
        <input
          type="range"
          min={0}
          max={minLen - 1}
          value={globalIdx}
          onChange={e => handleSlider(Number(e.target.value))}
          className="w-full h-2 sm:h-auto"
        />
        <button
          className="mt-2 px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base font-medium"
          onClick={() => setPlaying(p => !p)}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </Modal>
  );
};

export default MapModal; 