// app/components/PlanGenerator.tsx
//
// Plan Definition COMPONENT - Unified API Integration
// =================================================
//
// This component creates individual flight plans using the unified API
// at /api/flightPlans. It demonstrates the individual creation pattern
// that works alongside bulk operations.
//
// UNIFIED API USAGE:
// ------------------
// POST /api/flightPlans
// Body: { customName, status, fileContent, userId, folderId?, uplan?, scheduledAt? }
//
// The unified API automatically detects this as individual creation
// and processes it using createMany internally for consistency.
//
// COMPATIBILITY:
// - Works with both individual and bulk API patterns
// - No changes needed when switching between modes
// - Maintains backward compatibility
//
// BENEFITS:
// - Consistent with bulk operations
// - Same error handling and validation
// - Unified transaction management
// - Better performance through optimized database calls

import React, { useState, useRef, useCallback, useEffect } from "react";
// Note: react-leaflet imports are used by PlanMap component via dynamic import
import "leaflet/dist/leaflet.css";
import { useToast } from "../hooks/useToast";

// Fix for leaflet icons in Next.js
import L from "leaflet";
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

import { useAuth } from "../hooks/useAuth";
import { useRouter } from "next/navigation";
import axios from "axios";

// Helper to get auth headers for API requests
function getAuthHeaders(): { Authorization: string } | Record<string, never> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
import {
  HelpCircle,
  Grid3X3,
  MousePointer2,
  ChevronRight,
  ChevronDown,
  Edit2,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import dynamic from 'next/dynamic';
import { ConfirmDialog } from './ui/confirm-dialog';

const PlanMap = dynamic(() => import('./PlanMap'), { ssr: false });
const UspaceSelector = dynamic(() => import('./plan-definition/UspaceSelector'), { ssr: false });
import ScanPatternGeneratorV2 from './plan-definition/ScanPatternGeneratorV2';
import WaypointList, { type Waypoint } from './plan-definition/WaypointList';
import PlannerSection from './plan-definition/PlannerSection';
import CustomAreaModal from './plan-definition/CustomAreaModal';
import { Point, ScanWaypoint } from '@/lib/scan-generator';
import { buildQgcPlan } from '@/lib/qgc-plan';
import { useUspaces, USpace } from '@/app/hooks/useUspaces';
import { useGeoawarenessWebSocket } from '@/app/hooks/useGeoawarenessWebSocket';

// Plan Definition modes
type GeneratorMode = 'manual' | 'scan';


// FAS Service limits
const SERVICE_LIMITS = [-0.4257, 39.415, -0.280, 39.4988]; // [minLng, minLat, maxLng, maxLat]
const ALT_LIMITS = [0, 200];

// TASK-154: Distance threshold for boundary warning (in meters)
const BOUNDARY_WARNING_DISTANCE = 100;

// TASK-154: Calculate approximate distance from point to service area boundary (in meters)
// TASK-043: Updated to accept limits parameter for U-space support
// Uses Haversine formula approximation for short distances
function distanceToBoundary(lat: number, lng: number, limits: number[]): number {
  const [minLng, minLat, maxLng, maxLat] = limits;
  
  // Approximate meters per degree at this latitude
  const latMetersPerDeg = 111320; // ~111km per degree latitude
  const lngMetersPerDeg = 111320 * Math.cos((lat * Math.PI) / 180);
  
  // Calculate distance to each edge
  const distToNorth = (maxLat - lat) * latMetersPerDeg;
  const distToSouth = (lat - minLat) * latMetersPerDeg;
  const distToEast = (maxLng - lng) * lngMetersPerDeg;
  const distToWest = (lng - minLng) * lngMetersPerDeg;
  
  // Return minimum distance to any edge
  return Math.min(distToNorth, distToSouth, distToEast, distToWest);
}

// TASK-154: Check if any waypoint is approaching the boundary
// TASK-043: Updated to accept limits parameter for U-space support
function getWaypointsNearBoundary(waypoints: Waypoint[], limits: number[]): { index: number; distance: number }[] {
  const nearBoundary: { index: number; distance: number }[] = [];
  
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const dist = distanceToBoundary(wp.lat, wp.lng, limits);
    if (dist < BOUNDARY_WARNING_DISTANCE) {
      nearBoundary.push({ index: i, distance: Math.round(dist) });
    }
  }
  
  return nearBoundary;
}

function clampAltitude(alt: number | string) {
  if (alt === '') return '';
  return Math.max(ALT_LIMITS[0], Math.min(ALT_LIMITS[1], Number(alt)));
}

// Remove all react-leaflet and leaflet imports
// Remove WaypointMarkers and MapClickHandler definitions
// Remove leaflet icon fix
// Only keep dynamic import of PlanMap and pass props to it

function generateQGCPlan(waypoints: Waypoint[]): unknown {
  return buildQgcPlan(
    waypoints.map((wp) => ({
      lat: wp.lat,
      lng: wp.lng,
      alt: Number(wp.altitude) || 0,
      pauseDuration: Number(wp.pauseDuration) || 0,
      speed: Number(wp.speed) || 5,
      flyOverMode: wp.flyOverMode,
    }))
  );
}

// U-spaces offered as shortcuts in step 1 (same boundaries as before)
const DEFAULT_USPACE: USpace = {
  id: 'VLCUspace',
  name: 'VLCUspace',
  boundary: [
    { latitude: 39.4150, longitude: -0.4257 },
    { latitude: 39.4150, longitude: -0.2800 },
    { latitude: 39.4988, longitude: -0.2800 },
    { latitude: 39.4988, longitude: -0.4257 },
    { latitude: 39.4150, longitude: -0.4257 },
  ],
};
const GLOBAL_USPACE: USpace = {
  id: 'GLOBAL_U_SPACE',
  name: 'Global Coverage',
  boundary: [
    { latitude: -90.0000, longitude: -180.0000 },
    { latitude: -90.0000, longitude: 180.0000 },
    { latitude: 90.0000, longitude: 180.0000 },
    { latitude: 90.0000, longitude: -180.0000 },
    { latitude: -90.0000, longitude: -180.0000 },
  ],
};

const secondaryButton = "btn border border-line-2 bg-subtle text-fg-2 hover:bg-hover";
const modeButton = "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";

// Opens in a new tab so the help page never costs the user their waypoints (UI-19).
function HelpLink() {
  return (
    <a
      href="/how-it-works#plan-definition-help"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Help: how Plan Definition works (opens in a new tab)"
      title="Need help with Plan Definition?"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand-text hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      <HelpCircle className="h-5 w-5" aria-hidden="true" />
    </a>
  );
}

export default function PlanGenerator() {
  const [customAreaModalOpen, setCustomAreaModalOpen] = useState(false);
  const [confirmChangeOpen, setConfirmChangeOpen] = useState(false);
  // Set once the plan is saved so the unsaved-waypoints guard stops firing
  const [uploaded, setUploaded] = useState(false);
  const plannerRef = useRef<HTMLDivElement>(null);

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [planName, setPlanName] = useState("");
  const [loading, setLoading] = useState(false);

  const toast = useToast();
  const router = useRouter();
  // Create a wrapper for PlanMap to show toast messages
  const showToast = useCallback((message: string) => {
    // Determine toast type based on message content
    if (message.includes('Selected U-space') || message.includes('has been saved') || message.includes('SCAN pattern applied')) {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, [toast]);
  const { user } = useAuth();
  // TASK-181: Collapsible sidebar for tablet/mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // TASK-043: U-space selection state
  const [selectedUspace, setSelectedUspace] = useState<USpace | null>(null);
  const { getUspaceBounds, getUspaceCenter } = useUspaces();
  
  // TASK-082: Connect to geoawareness WebSocket when U-space is selected
  const {
    status: geozonesStatus,
    data: geozonesWsData,
    error: geozonesError,
    reconnect: reconnectGeozones,
    usingFallback,
  } = useGeoawarenessWebSocket({
    uspaceId: selectedUspace?.id || null,
    enabled: !!selectedUspace,
    enableFallback: false, // Disable fallback to not use deprecated endpoint
  });
  
  // Derive legacy-compatible variables from WebSocket data
  const geozonesData = geozonesWsData?.geozones_data || [];
  const geozonesLoading = geozonesStatus === 'connecting';

  // Log geozone status
  useEffect(() => {
    if (selectedUspace) {
      if (geozonesError) {
        console.error(`[PlanGenerator] Geoawareness error for ${selectedUspace.id}:`, geozonesError.message);
      } else if (!geozonesLoading) {
        // console.log(`[PlanGenerator] Geozones loaded: ${geozonesData.length} zones for ${selectedUspace.id}`);
      }
    }
  }, [selectedUspace, geozonesData.length, geozonesLoading, geozonesError]);
  
  // TASK-052: Geozone visibility toggle state
  const [geozonesVisible, setGeozonesVisible] = useState<boolean>(true);
  
  // Generator mode: manual waypoint placement vs SCAN pattern generation
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('manual');
  
  // TASK-3: Position to fly the map to after sidebar waypoint add
  const [flyToPosition, setFlyToPosition] = useState<[number, number] | null>(null);
  

  
  // SCAN pattern generator V2 state - overlays for the map
  const [scanOverlays, setScanOverlays] = useState<{
    takeoffPoint: Point | null;
    landingPoint: Point | null;
    polygonVertices: Point[];
    polygonClosed: boolean;
    previewWaypoints: ScanWaypoint[];
    scanAngle: number;
  } | null>(null);
  
  // TASK-216: Custom map click handler for SCAN mode using ref for stability
  // Using a ref ensures the handler identity is stable across renders,
  // preventing unnecessary cleanup/re-registration cycles
  const scanMapClickHandlerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  
  // Stable callback for setting the SCAN map click handler
  // This function identity never changes, preventing useEffect cleanup issues
  // PlanMap reads the handler via a ref, so no remount is needed
  const handleSetScanMapClickHandler = useCallback((handler: ((lat: number, lng: number) => void) | null) => {
    scanMapClickHandlerRef.current = handler;
  }, []);

  // TASK-14: Drag handlers from ScanPatternGeneratorV2 for map marker drag events
  const scanDragHandlersRef = useRef<{
    updateTakeoff: (lat: number, lng: number) => void;
    updateLanding: (lat: number, lng: number) => void;
    updateVertex: (index: number, lat: number, lng: number) => void;
  } | null>(null);

  const handleSetScanDragHandlers = useCallback((handlers: {
    updateTakeoff: (lat: number, lng: number) => void;
    updateLanding: (lat: number, lng: number) => void;
    updateVertex: (index: number, lat: number, lng: number) => void;
  } | null) => {
    scanDragHandlersRef.current = handlers;
  }, []);

  // Map bounds and center - TASK-043: Use selected U-space bounds when available
  const bounds: [[number, number], [number, number]] = selectedUspace 
    ? (() => {
        const uspaceBounds = getUspaceBounds(selectedUspace);
        return [
          [uspaceBounds.south, uspaceBounds.west], // SW: [minLat, minLng]
          [uspaceBounds.north, uspaceBounds.east], // NE: [maxLat, maxLng]
        ];
      })()
    : [
        [SERVICE_LIMITS[1], SERVICE_LIMITS[0]], // SW: [minLat, minLng]
        [SERVICE_LIMITS[3], SERVICE_LIMITS[2]], // NE: [maxLat, maxLng]
      ];
  const center: [number, number] = selectedUspace 
    ? (() => {
        const uspaceCenter = getUspaceCenter(selectedUspace);
        return [uspaceCenter.lat, uspaceCenter.lon];
      })()
    : [
        (SERVICE_LIMITS[1] + SERVICE_LIMITS[3]) / 2,
        (SERVICE_LIMITS[0] + SERVICE_LIMITS[2]) / 2,
      ];
      
  // TASK-043: Effective service limits based on selected U-space
  const effectiveServiceLimits = selectedUspace
    ? (() => {
        const uspaceBounds = getUspaceBounds(selectedUspace);
        return [uspaceBounds.west, uspaceBounds.south, uspaceBounds.east, uspaceBounds.north];
      })()
    : SERVICE_LIMITS;
    
  // TASK-043: Handler for U-space selection
  const handleUspaceSelect = (uspace: USpace) => {
    setSelectedUspace(uspace);
    // Clear existing waypoints when changing U-space
    if (waypoints.length > 0) {
      setWaypoints([]);
      setSelectedIdx(null);
    }
    showToast(`Selected U-space: ${uspace.name}`);
  };
  
  // TASK-043: Handler to change U-space (go back to selection)
  const handleChangeUspace = () => {
    if (waypoints.length > 0) {
      setConfirmChangeOpen(true); // ConfirmDialog clears the waypoints and leaves the U-space on confirm
      return;
    }
    setSelectedUspace(null);
  };
  
  // TASK-043: Check if point is within bounds (using effective limits)
  const isWithinEffectiveBounds = (lat: number, lng: number) => {
    const [minLng, minLat, maxLng, maxLat] = effectiveServiceLimits;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  };

  const handleAddWaypoint = (wp: Waypoint) => {
    // TASK-043: Check within selected U-space bounds or default service limits
    if (!isWithinEffectiveBounds(wp.lat, wp.lng)) {
      showToast(selectedUspace 
        ? `Waypoints must be within the ${selectedUspace.name} area.`
        : "Waypoints must be within the FAS service area.");
      return;
    }
    // Ensure pauseDuration and flyOverMode are initialized
    const newWp = { ...wp, pauseDuration: wp.pauseDuration ?? 0, flyOverMode: wp.flyOverMode ?? false };
    setWaypoints((prev) => {
      let newWps = [...prev, newWp];
      // First waypoint is always takeoff
      if (newWps.length === 1) {
        newWps[0].type = "takeoff";
      }
      // If exactly 2, default the second to landing if not set
      if (newWps.length === 2) {
        if (!newWps[1].type || newWps[1].type === "cruise") {
          newWps[1] = { ...newWps[1], type: "landing", altitude: 0 };
        }
      }
      // If 3 or more, only the last is landing, previous last reverts to cruise if it was landing
      if (newWps.length >= 3) {
        newWps = newWps.map((w, i) => {
          if (i === 0) return { ...w, type: "takeoff" };
          if (i === newWps.length - 1) return { ...w, type: "landing", altitude: 0 };
          return { ...w, type: "cruise", altitude: w.altitude === 0 ? 100 : w.altitude };
        });
      }
      return newWps;
    });
  };

  // "Add waypoint" form in the sidebar: validates, adds and flies the map there. Returns false when rejected.
  const handleAddWaypointAt = (lat: number, lng: number): boolean => {
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid latitude and longitude values.');
      return false;
    }
    if (!isWithinEffectiveBounds(lat, lng)) {
      toast.error('Coordinates are outside the service area.');
      return false;
    }
    handleAddWaypoint({
      lat,
      lng,
      type: 'cruise',
      altitude: 100,
      speed: 5,
      pauseDuration: 0,
      flyOverMode: false,
    });
    // TASK-3: Fly map to the newly added waypoint
    setFlyToPosition(null);
    setTimeout(() => setFlyToPosition([lat, lng]), 0);
    return true;
  };

  const handleWaypointChange = (
    idx: number,
    field: keyof Waypoint,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/file objects
    value: any
  ) => {
    setWaypoints((wps) =>
      wps.map((wp, i) => {
        if (i !== idx) return wp;
        if (field === "type" && value === "landing") {
          return { ...wp, type: value, altitude: 0 };
        }
        if (field === "altitude" && wp.type === "landing") {
          // Do not allow changing landing altitude
          return wp;
        }
        if (field === "altitude") {
          if (value === '') return { ...wp, altitude: '' };
          const clamped = clampAltitude(Number(value));
          if (clamped !== Number(value)) {
            showToast(`Altitude must be between ${ALT_LIMITS[0]} and ${ALT_LIMITS[1]} meters.`);
          }
          return { ...wp, altitude: clamped };
        }
        // TASK-124: Validate pause duration (0-3600 seconds)
        if (field === "pauseDuration") {
          if (value === '') return { ...wp, pauseDuration: '' };
          const pauseValue = Math.max(0, Math.min(3600, Math.floor(Number(value))));
          if (pauseValue !== Number(value)) {
            showToast("Pause duration must be between 0 and 3600 seconds (1 hour max).");
          }
          return { ...wp, pauseDuration: pauseValue };
        }
        if (field === "speed") {
          if (value === '') return { ...wp, speed: '' };
          return { ...wp, speed: Number(value) };
        }
        if ((field === "lat" || field === "lng")) {
          // TASK-043: Check within selected U-space bounds
          const newLat = field === "lat" ? Number(value) : wp.lat;
          const newLng = field === "lng" ? Number(value) : wp.lng;
          if (!isWithinEffectiveBounds(newLat, newLng)) {
            showToast(selectedUspace 
              ? `Waypoints must be within the ${selectedUspace.name} area.`
              : "Waypoints must be within the FAS service area.");
            return wp; // revert
          }
          return { ...wp, [field]: Number(value) };
        }
        return { ...wp, [field]: value };
      })
    );
  };

  const handleRemoveWaypoint = (idx: number) => {
    setWaypoints((wps) => {
      let newWps = wps.filter((_, i) => i !== idx);
      // First waypoint is always takeoff
      if (newWps.length > 0) {
        newWps[0].type = "takeoff";
      }
      // If exactly 2, default the second to landing
      if (newWps.length === 2) {
        newWps[1] = { ...newWps[1], type: "landing", altitude: 0 };
      }
      // If 3 or more, only the last is landing, previous last reverts to cruise if it was landing
      if (newWps.length >= 3) {
        newWps = newWps.map((w, i) => {
          if (i === 0) return { ...w, type: "takeoff" };
          if (i === newWps.length - 1)
            return { ...w, type: "landing", altitude: 0 };
          if (w.type === "landing") return { ...w, type: "cruise" };
          return w;
        });
      }
      return newWps;
    });
    setSelectedIdx(null);
  };

  const handleClearAll = () => {
    setWaypoints([]);
    setSelectedIdx(null);
  };

  // For the Polyline
  const polylinePositions: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number]);

  // Reorder (drag and drop or the move up/down buttons)
  const reorderWaypoints = (from: number, to: number) => {
    let newWaypoints = Array.from(waypoints);
    const [removed] = newWaypoints.splice(from, 1);
    newWaypoints.splice(to, 0, removed);
    // First waypoint is always takeoff
    if (newWaypoints.length > 0) {
      newWaypoints[0] = { ...newWaypoints[0], type: "takeoff" };
    }
    // If 3 or more, only the last is landing, previous last reverts to cruise if it was landing
    if (newWaypoints.length >= 3) {
      newWaypoints = newWaypoints.map((w, i) => {
        if (i === 0) return { ...w, type: "takeoff" };
        if (i === newWaypoints.length - 1)
          return { ...w, type: "landing", altitude: 0 };
        if (w.type === "landing") return { ...w, type: "cruise" };
        return w;
      });
    }
    setWaypoints(newWaypoints);
  };

  // Update waypoint position from marker drag
  const handleMarkerDragEnd = (idx: number, lat: number, lng: number) => {
    // TASK-043: Check within selected U-space bounds
    if (!isWithinEffectiveBounds(lat, lng)) {
      showToast(selectedUspace 
        ? `Waypoints must be within the ${selectedUspace.name} area.`
        : "Waypoints must be within the FAS service area.");
      return;
    }
    setWaypoints((wps) =>
      wps.map((wp, i) => (i === idx ? { ...wp, lat, lng } : wp))
    );
  };

  // Handle applying SCAN pattern waypoints
  const handleApplyScanPattern = (scanWaypoints: ScanWaypoint[]) => {
    if (scanWaypoints.length === 0) return;
    
    // Convert SCAN waypoints to our Waypoint format
    const newWaypoints: Waypoint[] = scanWaypoints.map((swp, idx) => {
      let waypointType: 'takeoff' | 'cruise' | 'landing' = 'cruise';
      let altitude = swp.altitude;
      
      if (idx === 0) {
        waypointType = 'takeoff';
      } else if (idx === scanWaypoints.length - 1) {
        waypointType = 'landing';
        altitude = 0;
      }
      
      return {
        lat: swp.lat,
        lng: swp.lng,
        type: waypointType,
        altitude,
        speed: swp.speed || 5,
        pauseDuration: 0,
        flyOverMode: false,
      };
    });
    
    setWaypoints(newWaypoints);
    setGeneratorMode('manual'); // Switch back to manual mode to allow editing
    setScanOverlays(null);
    handleSetScanMapClickHandler(null);
    showToast(`SCAN pattern applied with ${newWaypoints.length} waypoints. You can now edit them.`);
  };

  // Handle canceling SCAN pattern
  const handleCancelScanPattern = () => {
    setGeneratorMode('manual');
    setScanOverlays(null);
    handleSetScanMapClickHandler(null);
  };

  // TASK-14: Handle scan overlay marker drag (takeoff, landing, vertex)
  const handleScanOverlayDragEnd = useCallback((type: 'takeoff' | 'landing' | 'vertex', index: number, lat: number, lng: number) => {
    const handlers = scanDragHandlersRef.current;
    if (!handlers) return;
    if (type === 'takeoff') handlers.updateTakeoff(lat, lng);
    else if (type === 'landing') handlers.updateLanding(lat, lng);
    else if (type === 'vertex') handlers.updateVertex(index, lat, lng);
  }, []);

  // Leaving or reloading the tab with waypoints that were never uploaded would lose them
  const hasUnsavedWaypoints = waypoints.length > 0 && !uploaded;
  useEffect(() => {
    if (!hasUnsavedWaypoints) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedWaypoints]);

  // The planner fills the viewport below the app header: expose that offset to CSS (100dvh - offset)
  useEffect(() => {
    const el = plannerRef.current;
    if (!el) return;
    const measure = () =>
      el.style.setProperty("--planner-top", `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selectedUspace, user]);

  // Upload plan
  const handleUploadPlan = async () => {
    if (!user) {
      showToast("You must be logged in to upload the plan.");
      return;
    }
    if (!planName.trim()) {
      showToast("Please enter a name for the plan.");
      return;
    }
    if (waypoints.length === 0) {
      showToast("The plan must have at least one waypoint.");
      return;
    }
    if (!waypoints.some((wp) => wp.type === "takeoff")) {
      showToast("The plan must have at least one takeoff waypoint.");
      return;
    }
    // Only one takeoff and one landing allowed
    if (waypoints.filter((wp) => wp.type === "takeoff").length > 1) {
      showToast("The plan cannot have more than one takeoff waypoint.");
      return;
    }
    if (waypoints.filter((wp) => wp.type === "landing").length > 1) {
      showToast("The plan cannot have more than one landing waypoint.");
      return;
    }
    if (waypoints.length < 2) {
      showToast("The plan must have at least two waypoints.");
      return;
    }
    
    // Validate that no numeric fields are left empty
    const invalidWaypointIdx = waypoints.findIndex(wp => wp.altitude === '' || wp.speed === '' || wp.pauseDuration === '');
    if (invalidWaypointIdx !== -1) {
      showToast(`Please fill in all empty fields (altitude, speed, pause) for waypoint ${invalidWaypointIdx + 1}.`);
      return;
    }

    setLoading(true);
    try {
      const headers = getAuthHeaders();
      // 1. Find or create "Plan Definition" folder
      let folderId: number | null = null;
      const foldersRes = await axios.get(`/api/folders`, { headers });
      const planGenFolder = foldersRes.data.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/file objects
        (f: any) => f.name === "Plan Definition"
      );
      if (planGenFolder) {
        folderId = planGenFolder.id;
      } else {
        // Create folder
        const folderRes = await axios.post("/api/folders", {
          name: "Plan Definition",
        }, { headers });
        folderId = folderRes.data.id;
      }
      // 2. Create the plan
      const qgcPlan = generateQGCPlan(waypoints);
      // TASK-045: Include geoawarenessData with uspace_identifier
      const geoawarenessData = selectedUspace ? {
        uspace_identifier: selectedUspace.id,
        uspace_name: selectedUspace.name,
      } : null;
      
      // Use the new unified API
      const createRes = await axios.post("/api/flightPlans", {
        customName: planName,
        status: "sin procesar",
        fileContent: JSON.stringify(qgcPlan),
        folderId,
        geoawarenessData,
      }, { headers });
      const createdPlanId = createRes.data?.id;
      setPlanName("");
      setUploaded(true);
      toast.success(`Plan "${planName}" saved. Redirecting to Plan Authorization...`);
      router.push(`/plan-authorization?selectPlan=${createdPlanId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped waypoint/file objects
    } catch (err: any) {
      showToast(
        "Error uploading the plan: " +
          (err?.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // Add login check at the top of the return
  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas p-6">
        <div className="text-center text-2xl font-semibold text-fg">You must be logged in to access the Plan Definition.</div>
      </div>
    );
  }

  // TASK-043: U-space selection step
  if (!selectedUspace) {
    return (
      <div className="flex flex-1 flex-col bg-canvas">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {/* Step Indicator */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <ol className="flex items-center gap-4" aria-label="Plan Definition steps">
              <li className="flex items-center gap-2" aria-current="step">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-fg">1</span>
                <span className="font-medium text-fg">Select U-space</span>
              </li>
              <li aria-hidden="true"><ChevronRight className="h-5 w-5 text-muted" /></li>
              <li className="flex items-center gap-2 text-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle text-sm font-bold">2</span>
                <span className="font-medium">Plan Waypoints</span>
              </li>
            </ol>
            <HelpLink />
          </div>

          {/* Title and Description */}
          <div className="mb-6 max-w-2xl">
            <h1 className="mb-2 text-2xl font-bold text-fg md:text-3xl">Select Flight Area</h1>
            <p className="text-fg-2">
              Choose a U-space to plan your flight. Your waypoints will be restricted to the selected area.
              Click on a polygon on the map or pick one from the list.
            </p>
          </div>

          {/* U-space selector: map + keyboard-accessible list */}
          <UspaceSelector onSelect={handleUspaceSelect} selectedUspaceId={null} />

          {/* Skip to default service area (fallback) */}
          <div className="mt-6">
            <p className="mb-3 text-sm text-muted">Can&apos;t find your area or want to use the default?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleUspaceSelect(DEFAULT_USPACE)} className={secondaryButton}>
                Use Default Service Area
              </button>
              <button type="button" onClick={() => setCustomAreaModalOpen(true)} className={secondaryButton}>
                Define a Custom Area
              </button>
              <button type="button" onClick={() => handleUspaceSelect(GLOBAL_USPACE)} className={secondaryButton}>
                Don&apos;t Use a Pre-Defined Area
              </button>
            </div>
          </div>
          <CustomAreaModal
            open={customAreaModalOpen}
            onClose={() => setCustomAreaModalOpen(false)}
            onCreate={(uspace) => {
              handleUspaceSelect(uspace);
              setCustomAreaModalOpen(false);
            }}
          />
        </div>
      </div>
    );
  }

  // TASK-154: Boundary Warning - TASK-043: Updated to use effective limits
  const nearBoundary = getWaypointsNearBoundary(waypoints, effectiveServiceLimits);
  const areaName = selectedUspace.name;

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <ConfirmDialog
        open={confirmChangeOpen}
        onClose={() => setConfirmChangeOpen(false)}
        onConfirm={() => {
          setConfirmChangeOpen(false);
          setWaypoints([]);
          setSelectedIdx(null);
          setSelectedUspace(null);
        }}
        title="Change U-space?"
        message="Changing U-space will clear your current waypoints. Continue?"
        confirmLabel="Change U-space"
        variant="warning"
      />
      {/* Height = viewport (dvh) minus what sits above the planner (measured, not hard-coded). */}
      <div ref={plannerRef} className="relative h-[calc(100dvh-var(--planner-top,0px))] min-h-[32rem]">
        <div className="absolute inset-0 flex">
          {/* Sidebar on desktop, bottom sheet below 1024px */}
          <aside
            aria-label="Flight plan"
            className={`fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-xl border-t border-line bg-surface shadow-theme-lg lg:static lg:z-auto lg:max-h-none lg:w-[420px] lg:min-w-[320px] lg:max-w-[520px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0 ${
              sidebarOpen ? "max-h-[75dvh]" : ""
            }`}
          >
            <div className="flex items-center border-b border-line">
              <h2 className="hidden flex-1 px-4 py-3 text-xl font-bold text-fg lg:block">Flight Plan</h2>
              <h2 className="flex-1 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-expanded={sidebarOpen}
                  aria-controls="planner-panel"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-lg font-bold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
                >
                  <span>
                    Flight Plan
                    <span className="ml-2 text-sm font-normal text-muted">
                      {waypoints.length} waypoint{waypoints.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronDown className={`h-5 w-5 text-muted transition-transform ${sidebarOpen ? "" : "rotate-180"}`} aria-hidden="true" />
                </button>
              </h2>
              <div className="px-2">
                <HelpLink />
              </div>
            </div>

            <div id="planner-panel" className={`min-h-0 flex-1 flex-col lg:flex ${sidebarOpen ? "flex" : "hidden"}`}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Status banners: always visible, never hidden inside a collapsed section */}
                {(nearBoundary.length > 0 || geozonesStatus === "error" || geozonesLoading || usingFallback) && (
                  <div className="space-y-2 border-b border-line p-4">
                    {nearBoundary.length > 0 && (
                      <div role="alert" className="rounded-md border border-warning-line bg-warning-soft p-3 text-warning-text">
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                          Boundary Warning
                        </div>
                        <div className="text-xs">
                          {nearBoundary.length === 1 ? (
                            <span>Waypoint {nearBoundary[0].index + 1} is {nearBoundary[0].distance}m from the {areaName} boundary.</span>
                          ) : (
                            <span>
                              {nearBoundary.map((w, i) => (
                                <span key={w.index}>
                                  {i > 0 && ", "}
                                  WP{w.index + 1} ({w.distance}m)
                                </span>
                              ))} are near the boundary.
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {geozonesStatus === "error" && (
                      <div role="alert" className="rounded-md border border-danger-line bg-danger-soft p-3 text-danger-text">
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                          Geozones could not be loaded
                        </div>
                        <p className="text-xs">
                          Restrictions for {areaName} are not shown on the map.
                          {geozonesError?.message ? ` (${geozonesError.message})` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={reconnectGeozones}
                          className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                        >
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          Retry
                        </button>
                      </div>
                    )}
                    {geozonesLoading && (
                      <p role="status" className="flex items-center gap-2 text-xs text-muted">
                        <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Loading geozones...
                      </p>
                    )}
                    {usingFallback && (
                      <p role="status" className="rounded-md border border-info-line bg-info-soft p-3 text-xs text-info-text">
                        Showing fallback geozone data; it may be out of date.
                      </p>
                    )}
                  </div>
                )}

                <PlannerSection title="Plan details">
                  <label htmlFor="plan-name" className="mb-1 block text-sm font-medium text-fg-2">
                    Plan name
                  </label>
                  <input
                    id="plan-name"
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="input"
                    placeholder="e.g. Mission 1"
                    disabled={loading}
                  />
                </PlannerSection>

                <PlannerSection title="Mode">
                  <div role="group" aria-label="Generation mode" className="flex gap-2">
                    <button
                      type="button"
                      aria-pressed={generatorMode === "manual"}
                      onClick={() => {
                        setGeneratorMode("manual");
                        setScanOverlays(null);
                        handleSetScanMapClickHandler(null);
                      }}
                      className={`${modeButton} ${generatorMode === "manual" ? "bg-brand text-brand-fg" : "bg-subtle text-fg-2 hover:bg-hover"}`}
                    >
                      <MousePointer2 className="h-4 w-4" aria-hidden="true" />
                      Manual
                    </button>
                    <button
                      type="button"
                      aria-pressed={generatorMode === "scan"}
                      onClick={() => setGeneratorMode("scan")}
                      className={`${modeButton} ${generatorMode === "scan" ? "bg-[var(--color-accent-hover)] text-brand-fg" : "bg-subtle text-fg-2 hover:bg-hover"}`}
                    >
                      <Grid3X3 className="h-4 w-4" aria-hidden="true" />
                      SCAN Pattern
                    </button>
                  </div>
                  {/* SCAN Pattern Generator */}
                  {generatorMode === "scan" && (
                    <div className="mt-3">
                      <ScanPatternGeneratorV2
                        onApply={handleApplyScanPattern}
                        onCancel={handleCancelScanPattern}
                        serviceBounds={effectiveServiceLimits as [number, number, number, number]}
                        onMapClick={handleSetScanMapClickHandler}
                        onOverlaysChange={setScanOverlays}
                        onDragHandlers={handleSetScanDragHandlers}
                        onFlyTo={(lat, lng) => {
                          setFlyToPosition(null);
                          setTimeout(() => setFlyToPosition([lat, lng]), 0);
                        }}
                      />
                    </div>
                  )}
                </PlannerSection>

                {generatorMode === "manual" && (
                  <PlannerSection title="Waypoints" badge={<span className="rounded bg-subtle px-1.5 py-0.5 text-xs font-normal text-fg-2">{waypoints.length}</span>}>
                    {waypoints.length > 0 && (
                      <div className="mb-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="rounded px-1 text-xs font-semibold text-danger-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                        >
                          Clear all waypoints
                        </button>
                      </div>
                    )}
                    <WaypointList
                      waypoints={waypoints}
                      selectedIdx={selectedIdx}
                      onChange={handleWaypointChange}
                      onRemove={handleRemoveWaypoint}
                      onMove={reorderWaypoints}
                      onAddAt={handleAddWaypointAt}
                      center={center}
                    />
                  </PlannerSection>
                )}

                {/* TASK-153 & TASK-043: Service Area / U-space Bounds Panel */}
                <PlannerSection
                  title="Area & geozones"
                  defaultOpen={false}
                  badge={<span className="max-w-[10rem] truncate text-xs font-normal text-muted">{areaName}</span>}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg-2">
                      <span className="h-3 w-3 shrink-0 rounded-sm border-2 border-dashed border-warning" aria-hidden="true" />
                      <span className="truncate">{areaName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleChangeUspace}
                      className="inline-flex shrink-0 items-center gap-1 rounded text-xs text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                    >
                      <Edit2 className="h-3 w-3" aria-hidden="true" />
                      Change U-space
                    </button>
                  </div>

                  {/* TASK-052: Geozone visibility toggle */}
                  {geozonesData.length > 0 && (
                    <label className="mb-3 flex cursor-pointer items-center justify-between gap-2 border-b border-line pb-3">
                      <span className="flex items-center gap-2 text-sm text-fg-2">
                        Show geozones
                        <span className="rounded bg-subtle px-1.5 py-0.5 text-xs text-muted">{geozonesData.length}</span>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={geozonesVisible}
                        onChange={(e) => setGeozonesVisible(e.target.checked)}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                    </label>
                  )}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex justify-between"><dt className="text-muted">Min Lat:</dt><dd className="font-mono text-fg-2">{effectiveServiceLimits[1].toFixed(4)}°</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Max Lat:</dt><dd className="font-mono text-fg-2">{effectiveServiceLimits[3].toFixed(4)}°</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Min Lon:</dt><dd className="font-mono text-fg-2">{effectiveServiceLimits[0].toFixed(4)}°</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Max Lon:</dt><dd className="font-mono text-fg-2">{effectiveServiceLimits[2].toFixed(4)}°</dd></div>
                  </dl>
                  <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
                    Alt: {ALT_LIMITS[0]}-{ALT_LIMITS[1]}m AGL
                  </p>
                </PlannerSection>
              </div>

              {/* Fixed footer: the single primary action */}
              {generatorMode === "manual" && (
                <div className="border-t border-line bg-surface p-4">
                  <button
                    className="btn btn-primary w-full py-2 font-semibold disabled:opacity-60"
                    onClick={handleUploadPlan}
                    type="button"
                    disabled={loading}
                  >
                    {loading ? "Uploading..." : "Upload to Plan Authorization"}
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Map (isolated so Leaflet's internal z-indexes never leave it); bottom padding keeps its controls clear of the sheet header */}
          <div className="isolate min-w-0 flex-1 pb-14 lg:pb-0">
            <PlanMap
              center={center}
              bounds={bounds}
              polylinePositions={polylinePositions}
              handleAddWaypoint={handleAddWaypoint}
              setToast={showToast}
              waypoints={waypoints}
              setSelectedIdx={setSelectedIdx}
              handleMarkerDragEnd={handleMarkerDragEnd}
              onWaypointChange={handleWaypointChange}
              scanMode={generatorMode === 'scan'}
              scanOverlays={scanOverlays || undefined}
              customClickHandler={scanMapClickHandlerRef.current}
              key={`planmap-${selectedUspace?.id || 'default'}`}
              // TASK-051: Pass geozone data to PlanMap
              geozonesData={geozonesData}
              // TASK-052: Control geozone visibility via toggle
              geozonesVisible={geozonesVisible}
              // TASK-054/056: Pass U-space name for display and error messages
              uspaceName={selectedUspace?.name}
              // TASK-089: Pass WebSocket status for connection indicator
              wsStatus={selectedUspace ? geozonesStatus : undefined}
              onReconnect={reconnectGeozones}
              // TASK-14: Scan overlay marker drag
              onScanOverlayDragEnd={generatorMode === 'scan' ? handleScanOverlayDragEnd : undefined}
              // TASK-3: Fly map to manually added waypoint
              flyToPosition={flyToPosition}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
