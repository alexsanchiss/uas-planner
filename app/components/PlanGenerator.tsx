// app/components/PlanGenerator.tsx
//
// PLAN GENERATOR COMPONENT - Unified API Integration
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

import React, { useState, useRef, useCallback } from "react";
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
import axios from "axios";

// Helper to get auth headers for API requests
function getAuthHeaders(): { Authorization: string } | Record<string, never> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { HelpCircle, Grid3X3, MousePointer2, ChevronRight, Edit2 } from "lucide-react";
import dynamic from 'next/dynamic';

const PlanMap = dynamic(() => import('./PlanMap'), { ssr: false });
const UspaceSelector = dynamic(() => import('./plan-generator/UspaceSelector'), { ssr: false });
import ScanPatternGeneratorV2 from './plan-generator/ScanPatternGeneratorV2';
import { Point, ScanWaypoint } from '@/lib/scan-generator';
import { useUspaces, USpace } from '@/app/hooks/useUspaces';
import { useGeoawarenessWebSocket } from '@/app/hooks/useGeoawarenessWebSocket';
import type { GeozoneData } from '@/app/hooks/useGeoawarenessWebSocket';

// Plan generator modes
type GeneratorMode = 'manual' | 'scan';

const waypointTypes = [
  { value: "takeoff", label: "Takeoff" },
  { value: "cruise", label: "Cruise" },
  { value: "landing", label: "Landing" },
];

// TypeScript types
interface Waypoint {
  lat: number;
  lng: number;
  type: "takeoff" | "cruise" | "landing";
  altitude: number;
  speed: number;
  pauseDuration: number; // TASK-121: Hold time in seconds (0-3600)
  flyOverMode: boolean; // TASK-126: true = fly-over (pass directly over), false = fly-by (smooth curve)
}

interface PlanInfo {
  date: string;
  time: string;
}

const FLIGHT_MODES = ["VLOS", "BVLOS"];
const FLIGHT_CATEGORIES = [
  "OPENA1",
  "OPENA2",
  "OPENA3", 'SAIL_I-II', 'SAIL_III-IV', 'SAIL_V-VI', 'Certi_No_Pass', 'Certi_Pass',
];
const SPECIAL_OPERATIONS = [
  "POLICE_AND_CUSTOMS",
  "TRAFFIC_SURVEILLANCE_AND_PURSUIT",
  "ENVIRONMENTAL_CONTROL",
  "SEARCH_AND_RESCUE",
  "MEDICAL",
  "EVACUATIONS",
  "FIREFIGHTING",
  "STATE_OFFICIALS",
];
const CONNECTIVITY = ["RF", "LTE", "SAT", "5G"];
const ID_TECHNOLOGY = ["NRID", "ADSB", "OTHER"];
const UAS_TYPE = ["NONE_NOT_DECLARED", "MULTIROTOR", "FIXED_WING"];
const UAS_CLASS = ["NONE", "C0", "C1", "C2", "C3", "C4", "C5", "C6"];
const UAS_DIMENSION = ["LT_1", "LT_3", "LT_8", "GTE_8"];

const initialFlightPlanDetails = {
  datetime: "",
  dataOwnerIdentifier: { sac: "", sic: "" },
  dataSourceIdentifier: { sac: "", sic: "" },
  contactDetails: { firstName: "", lastName: "", phones: [""], emails: [""] },
  flightDetails: {
    mode: "",
    category: "",
    specialOperation: "",
    privateFlight: false,
  },
  uas: {
    registrationNumber: "",
    serialNumber: "",
    flightCharacteristics: {
      uasMTOM: "",
      uasMaxSpeed: "",
      connectivity: "",
      idTechnology: "",
      maxFlightTime: "",
    },
    generalCharacteristics: {
      brand: "",
      model: "",
      typeCertificate: "",
      uasType: "",
      uasClass: "",
      uasDimension: "",
    },
  },
  operatorId: "",
};

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

function clampAltitude(alt: number) {
  return Math.max(ALT_LIMITS[0], Math.min(ALT_LIMITS[1], alt));
}

// Remove all react-leaflet and leaflet imports
// Remove WaypointMarkers and MapClickHandler definitions
// Remove leaflet icon fix
// Only keep dynamic import of PlanMap and pass props to it

function generateQGCPlan(waypoints: Waypoint[]): any {
  if (waypoints.length === 0) return {};
  const items = [];
  let doJumpId = 1;

  // Add set speed (178) as the first item, using the speed of the first waypoint
  items.push({
    autoContinue: true,
    command: 178,
    doJumpId: doJumpId++,
    frame: 2,
    params: [1, waypoints[0].speed, -1, 0, 0, 0, 0],
    type: "SimpleItem",
  });

  // Takeoff (22) for the first waypoint
  // TASK-123: params[0] is hold time in seconds
  const first = waypoints[0];
  items.push({
    AMSLAltAboveTerrain: null,
    Altitude: first.altitude,
    AltitudeMode: 1,
    autoContinue: true,
    command: 22,
    doJumpId: doJumpId++,
    frame: 3,
    params: [first.pauseDuration || 0, 0, 0, null, first.lat, first.lng, first.altitude],
    type: "SimpleItem",
  });

  // Cruise (16) for intermediate waypoints (excluding first and last)
  // TASK-123: params[0] is hold time in seconds
  // TASK-128: params[1] is acceptance radius - set to 0.1m for fly-over mode, 0 for fly-by (smooth curve)
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i];
    // For NAV_WAYPOINT (cmd 16): params = [Hold, Accept_Radius, Pass_Radius, Yaw, Lat, Lon, Alt]
    // Accept_Radius = 0.1m forces drone to pass directly over (fly-over)
    // Accept_Radius = 0 allows smooth curving (fly-by, default)
    const acceptRadius = wp.flyOverMode ? 0.1 : 0;
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: wp.altitude,
      AltitudeMode: 1,
      autoContinue: true,
      command: 16,
      doJumpId: doJumpId++,
      frame: 3,
      params: [wp.pauseDuration || 0, acceptRadius, 0, null, wp.lat, wp.lng, wp.altitude],
      type: "SimpleItem",
    });
  }

  // Landing (21) for the last waypoint
  // TASK-123: params[0] is hold time in seconds (typically 0 for landing)
  if (waypoints.length > 1) {
    const last = waypoints[waypoints.length - 1];
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: 0,
      AltitudeMode: 1,
      autoContinue: true,
      command: 21,
      doJumpId: doJumpId++,
      frame: 3,
      params: [last.pauseDuration || 0, 0, 0, null, last.lat, last.lng, 0],
      type: "SimpleItem",
    });
  }

  const plannedHome = waypoints[0];
  return {
    fileType: "Plan",
    geoFence: { circles: [], polygons: [], version: 2 },
    groundStation: "QGroundControl",
    mission: {
      cruiseSpeed: 15,
      firmwareType: 12,
      globalPlanAltitudeMode: 1,
      hoverSpeed: 5,
      items,
      plannedHomePosition: [plannedHome.lat, plannedHome.lng, 15],
      vehicleType: 2,
      version: 2,
    },
    rallyPoints: { points: [], version: 2 },
    version: 1,
  };
}

export default function PlanGenerator() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo>({ date: "", time: "" });
  const [planName, setPlanName] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
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
  const [flightPlanDetails, setFlightPlanDetails] = useState(
    initialFlightPlanDetails
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  // TASK-181: Collapsible sidebar for tablet/mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // TASK-043: U-space selection state
  const [selectedUspace, setSelectedUspace] = useState<USpace | null>(null);
  const { getUspaceBounds, getUspaceCenter } = useUspaces();
  
  // TASK-051: Connect to geoawareness WebSocket when U-space is selected
  const {
    data: geoawarenessData,
    reconnect: reconnectWs,
  } = useGeoawarenessWebSocket({
    uspaceId: selectedUspace?.id || null,
    enabled: !!selectedUspace, // Enable WebSocket for all selected U-spaces
  });
  
  // For future use: expose reconnectWs for manual retry
  void reconnectWs;
  
  // TASK-051: Extract geozones from WebSocket data
  const geozonesData: GeozoneData[] = geoawarenessData?.geozones_data || [];
  
  // TASK-052: Geozone visibility toggle state
  const [geozonesVisible, setGeozonesVisible] = useState<boolean>(true);
  
  // Generator mode: manual waypoint placement vs SCAN pattern generation
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('manual');
  
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
  
  // State to trigger re-render when handler changes (for PlanMap to pick up changes)
  const [scanHandlerVersion, setScanHandlerVersion] = useState(0);
  
  // Stable callback for setting the SCAN map click handler
  // This function identity never changes, preventing useEffect cleanup issues
  const handleSetScanMapClickHandler = useCallback((handler: ((lat: number, lng: number) => void) | null) => {
    scanMapClickHandlerRef.current = handler;
    // Increment version to force PlanMap to see the change
    setScanHandlerVersion(v => v + 1);
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
      if (!window.confirm('Changing U-space will clear your current waypoints. Continue?')) {
        return;
      }
      setWaypoints([]);
      setSelectedIdx(null);
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

  const handleWaypointChange = (
    idx: number,
    field: keyof Waypoint,
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
          const clamped = clampAltitude(Number(value));
          if (clamped !== Number(value)) {
            showToast(`Altitude must be between ${ALT_LIMITS[0]} and ${ALT_LIMITS[1]} meters.`);
            return { ...wp, altitude: clamped };
          }
          return { ...wp, altitude: clamped };
        }
        // TASK-124: Validate pause duration (0-3600 seconds)
        if (field === "pauseDuration") {
          const pauseValue = Math.max(0, Math.min(3600, Math.floor(Number(value))));
          if (pauseValue !== Number(value)) {
            showToast("Pause duration must be between 0 and 3600 seconds (1 hour max).");
          }
          return { ...wp, pauseDuration: pauseValue };
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

  const handlePlanInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlanInfo({ ...planInfo, [e.target.name]: e.target.value });
  };

  const handleClearAll = () => {
    setWaypoints([]);
    setSelectedIdx(null);
    setPlanInfo({ date: "", time: "" });
  };

  // For the Polyline
  const polylinePositions: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number]);

  // QGC Plan generated
  const qgcPlan = generateQGCPlan(waypoints);

  // Drag and drop reorder
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    let newWaypoints = Array.from(waypoints);
    const [removed] = newWaypoints.splice(result.source.index, 1);
    newWaypoints.splice(result.destination.index, 0, removed);
    // First waypoint is always takeoff
    if (newWaypoints.length > 0) {
      newWaypoints[0].type = "takeoff";
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
    if (waypoints.length === 10) {
      showToast("The plan must have at least two waypoints.");
      return;
    }
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      // 1. Find or create "Plan Generator" folder
      let folderId: number | null = null;
      const foldersRes = await axios.get(`/api/folders`, { headers });
      const planGenFolder = foldersRes.data.find(
        (f: any) => f.name === "Plan Generator"
      );
      if (planGenFolder) {
        folderId = planGenFolder.id;
      } else {
        // Create folder
        const folderRes = await axios.post("/api/folders", {
          name: "Plan Generator",
        }, { headers });
        folderId = folderRes.data.id;
      }
      // 2. Create the plan
      const qgcPlan = generateQGCPlan(waypoints);
      // Prepare uplan details (omit datetime)
      const { datetime, ...uplanDetails } = flightPlanDetails;
      // Convert datetime to ISO string if present
      let scheduledAt = null;
      if (flightPlanDetails.datetime) {
        const d = new Date(flightPlanDetails.datetime);
        if (!isNaN(d.getTime())) scheduledAt = d.toISOString();
      }
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
        uplan: JSON.stringify(uplanDetails),
        scheduledAt,
        geoawarenessData,
      }, { headers });
      showToast(
        `The plan "${planName}" has been saved in the Plan Generator folder in Trajectory Generator.`
      );
      setPlanName("");
    } catch (err: any) {
      showToast(
        "Error uploading the plan: " +
          (err?.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // Header height: 56px (py-3 on header)
  const HEADER_HEIGHT = 120.67;
  // Add login check at the top of the return
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="text-2xl text-[var(--text-primary)] font-semibold">You must be logged in to access the Plan Generator.</div>
      </div>
    );
  }
  
  // TASK-043: U-space selection step
  if (!selectedUspace) {
    return (
      <div className="w-full bg-[var(--bg-primary)] overflow-x-hidden min-h-screen">
        {/* Help Button */}
        <a
          href="/how-it-works#plan-generator-help"
          target="_self"
          className="fixed top-24 right-4 sm:right-8 z-[9999] bg-blue-700 hover:bg-blue-800 text-white rounded-full p-2 sm:p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
          title="Need help with Plan Generator?"
        >
          <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        </a>
        
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <span className="text-[var(--text-primary)] font-medium">Select U-space</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] flex items-center justify-center font-bold text-sm">
                2
              </div>
              <span className="text-[var(--text-tertiary)] font-medium">Plan Waypoints</span>
            </div>
          </div>
          
          {/* Title and Description */}
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              Select Flight Area
            </h1>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
              Choose a U-space to plan your flight. Your waypoints will be restricted to the selected area.
              Click on a polygon to select it.
            </p>
          </div>
          
          {/* U-space Selector Map */}
          <div className="rounded-lg overflow-hidden shadow-lg border border-[var(--border-primary)]">
            <UspaceSelector
              onSelect={handleUspaceSelect}
              selectedUspaceId={null}
              className="h-[500px]"
            />
          </div>
          
          {/* Skip to default service area (fallback) */}
          <div className="mt-6 text-center">
            <p className="text-[var(--text-tertiary)] text-sm mb-3">
              Can&apos;t find your area or want to use the default?
            </p>
            <button
              onClick={() => {
                // Create a U-space for VLCUspace (default area)
                const defaultUspace: USpace = {
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
                handleUspaceSelect(defaultUspace);
              }}
              className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium"
            >
              Use Default Service Area
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full bg-[var(--bg-primary)] overflow-x-hidden">
      {/* Help Button */}
      <a
        href="/how-it-works#plan-generator-help"
        target="_self"
        className="fixed top-24 right-4 sm:right-8 z-[9999] bg-blue-700 hover:bg-blue-800 text-white rounded-full p-2 sm:p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
        title="Need help with Plan Generator?"
      >
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
      </a>
      
      {/* TASK-181: Mobile sidebar toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-4 left-4 z-[9999] bg-blue-700 hover:bg-blue-800 text-white rounded-full p-3 shadow-lg flex items-center justify-center transition-all duration-200"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      
      <style>{`
        :root {
          --header-height: ${HEADER_HEIGHT}px;
        }
        .plan-gen-main {
          height: calc(100vh - var(--header-height));
          min-height: 400px;
          display: flex;
          flex-direction: row;
        }
        .plan-gen-sidebar {
          height: 100%;
          min-height: 400px;
          max-height: 100%;
          overflow-y: auto;
        }
        .plan-gen-map {
          height: 100%;
          min-height: 400px;
        }
        .leaflet-container {
          height: 100% !important;
          min-height: 400px;
        }
        /* TASK-181: Mobile sidebar styles */
        @media (max-width: 1023px) {
          .plan-gen-sidebar {
            position: fixed;
            top: var(--header-height);
            left: 0;
            width: 100%;
            max-width: 420px;
            height: calc(100vh - var(--header-height));
            z-index: 1500;
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
          }
          .plan-gen-sidebar.sidebar-open {
            transform: translateX(0);
          }
          .plan-gen-map {
            width: 100%;
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .plan-gen-sidebar {
            max-width: 380px;
          }
        }
      `}</style>
      <div className="plan-gen-main">
        {/* TASK-181: Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-[1400]" 
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        
        {/* Sidebar */}
        <aside className={`plan-gen-sidebar relative z-10 flex flex-col w-full lg:w-[420px] lg:min-w-[320px] lg:max-w-[520px] bg-[var(--surface-primary)] border-r border-[var(--border-primary)] shadow-lg ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="flex flex-col h-full w-full">
            {/* Scrollable content: header, plan details, waypoint list, and bottom buttons */}
            <div>
              <div className="p-6 pb-0">
                <h2 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">
                  Flight Plan
                </h2>
                
                {/* Mode Toggle: Manual vs SCAN Pattern */}
                <div className="mb-4 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md">
                  <div className="text-xs text-[var(--text-tertiary)] mb-2 font-medium">Generation Mode</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setGeneratorMode('manual')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        generatorMode === 'manual'
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <MousePointer2 className="w-4 h-4" />
                      Manual
                    </button>
                    <button
                      onClick={() => setGeneratorMode('scan')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        generatorMode === 'scan'
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                      SCAN Pattern
                    </button>
                  </div>
                </div>
                
                {/* SCAN Pattern Generator */}
                {generatorMode === 'scan' && (
                  <div className="mb-4">
                    <ScanPatternGeneratorV2
                      onApply={handleApplyScanPattern}
                      onCancel={handleCancelScanPattern}
                      serviceBounds={[SERVICE_LIMITS[0], SERVICE_LIMITS[1], SERVICE_LIMITS[2], SERVICE_LIMITS[3]]}
                      onMapClick={handleSetScanMapClickHandler}
                      onOverlaysChange={setScanOverlays}
                    />
                  </div>
                )}
                
                {/* Manual mode: Flight Plan Details */}
                {generatorMode === 'manual' && (
                    <button
                      className="w-full flex items-center justify-between bg-[var(--bg-secondary)] text-[var(--text-primary)] px-4 py-2 rounded-t-md border border-[var(--border-primary)] font-semibold focus:outline-none"
                      onClick={() => setDetailsOpen((o) => !o)}
                      type="button"
                    >
                      Flight Plan Details
                      <span className="ml-2">{detailsOpen ? "▲" : "▼"}</span>
                    </button>
                )}
                {generatorMode === 'manual' && detailsOpen && (
                  <div className="bg-[var(--bg-secondary)] border-x border-b border-[var(--border-primary)] rounded-b-md p-4 space-y-4 mt-0">
                    {/* Date/Time */}
                    <div>
                      <label className="block mb-1 font-medium text-[var(--text-secondary)]">
                        Flight date & time
                      </label>
                      <input
                        type="datetime-local"
                        value={flightPlanDetails.datetime}
                        onChange={(e) =>
                          setFlightPlanDetails((d) => ({
                            ...d,
                            datetime: e.target.value,
                          }))
                        }
                        className="input w-full"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                    {/* Data Owner Identifier */}
                    <div className="border-b border-[var(--border-primary)] pb-2 mb-2">
                      <div className="font-semibold text-[var(--text-secondary)] mb-1">
                        Data Owner Identifier
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={3}
                          placeholder="SAC"
                          value={flightPlanDetails.dataOwnerIdentifier.sac}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              dataOwnerIdentifier: {
                                ...d.dataOwnerIdentifier,
                                sac: e.target.value.toUpperCase(),
                              },
                            }))
                          }
                          className="input w-20 text-xs"
                        />
                        <input
                          type="text"
                          maxLength={3}
                          placeholder="SIC"
                          value={flightPlanDetails.dataOwnerIdentifier.sic}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              dataOwnerIdentifier: {
                                ...d.dataOwnerIdentifier,
                                sic: e.target.value.toUpperCase(),
                              },
                            }))
                          }
                          className="input w-20 text-xs"
                        />
                      </div>
                    </div>
                    {/* Data Source Identifier */}
                    <div className="border-b border-[var(--border-primary)] pb-2 mb-2">
                      <div className="font-semibold text-[var(--text-secondary)] mb-1">
                        Data Source Identifier
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={3}
                          placeholder="SAC"
                          value={flightPlanDetails.dataSourceIdentifier.sac}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              dataSourceIdentifier: {
                                ...d.dataSourceIdentifier,
                                sac: e.target.value.toUpperCase(),
                              },
                            }))
                          }
                          className="input w-20 text-xs"
                        />
                        <input
                          type="text"
                          maxLength={3}
                          placeholder="SIC"
                          value={flightPlanDetails.dataSourceIdentifier.sic}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              dataSourceIdentifier: {
                                ...d.dataSourceIdentifier,
                                sic: e.target.value.toUpperCase(),
                              },
                            }))
                          }
                          className="input w-20 text-xs"
                        />
                      </div>
                    </div>
                    {/* Contact Details */}
                    <div className="border-b border-[var(--border-primary)] pb-2 mb-2">
                      <div className="font-semibold text-[var(--text-secondary)] mb-1">
                        Contact Details
                      </div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={flightPlanDetails.contactDetails.firstName}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              contactDetails: {
                                ...d.contactDetails,
                                firstName: e.target.value,
                              },
                            }))
                          }
                          className="input w-32 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={flightPlanDetails.contactDetails.lastName}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              contactDetails: {
                                ...d.contactDetails,
                                lastName: e.target.value,
                              },
                            }))
                          }
                          className="input w-32 text-xs"
                        />
                      </div>
                      <div className="mb-2">
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">Phones</div>
                        {flightPlanDetails.contactDetails.phones.map(
                          (phone, i) => (
                            <div key={i} className="flex gap-2 mb-1">
                              <input
                                type="text"
                                placeholder="Phone"
                                value={phone}
                                onChange={(e) =>
                                  setFlightPlanDetails((d) => {
                                    const phones = [...d.contactDetails.phones];
                                    phones[i] = e.target.value;
                                    return {
                                      ...d,
                                      contactDetails: {
                                        ...d.contactDetails,
                                        phones,
                                      },
                                    };
                                  })
                                }
                                className="input w-40 text-xs"
                              />
                              <button
                                type="button"
                                className="text-[var(--status-error)] hover:text-[var(--status-error-hover)] text-xs font-bold"
                                onClick={() =>
                                  setFlightPlanDetails((d) => {
                                    const phones =
                                      d.contactDetails.phones.filter(
                                        (_, idx) => idx !== i
                                      );
                                    return {
                                      ...d,
                                      contactDetails: {
                                        ...d.contactDetails,
                                        phones: phones.length ? phones : [""],
                                      },
                                    };
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          )
                        )}
                        <button
                          type="button"
                          className="text-[var(--color-primary)] hover:underline text-xs"
                          onClick={() =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              contactDetails: {
                                ...d.contactDetails,
                                phones: [...d.contactDetails.phones, ""],
                              },
                            }))
                          }
                        >
                          Add phone
                        </button>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">Emails</div>
                        {flightPlanDetails.contactDetails.emails.map(
                          (email, i) => (
                            <div key={i} className="flex gap-2 mb-1">
                              <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) =>
                                  setFlightPlanDetails((d) => {
                                    const emails = [...d.contactDetails.emails];
                                    emails[i] = e.target.value;
                                    return {
                                      ...d,
                                      contactDetails: {
                                        ...d.contactDetails,
                                        emails,
                                      },
                                    };
                                  })
                                }
                                className="input w-40 text-xs"
                              />
                              <button
                                type="button"
                                className="text-[var(--status-error)] hover:text-[var(--status-error-hover)] text-xs font-bold"
                                onClick={() =>
                                  setFlightPlanDetails((d) => {
                                    const emails =
                                      d.contactDetails.emails.filter(
                                        (_, idx) => idx !== i
                                      );
                                    return {
                                      ...d,
                                      contactDetails: {
                                        ...d.contactDetails,
                                        emails: emails.length ? emails : [""],
                                      },
                                    };
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          )
                        )}
                        <button
                          type="button"
                          className="text-[var(--color-primary)] hover:underline text-xs"
                          onClick={() =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              contactDetails: {
                                ...d.contactDetails,
                                emails: [...d.contactDetails.emails, ""],
                              },
                            }))
                          }
                        >
                          Add email
                        </button>
                      </div>
                    </div>
                    {/* Flight Details */}
                    <div className="border-b border-[var(--border-primary)] pb-2 mb-2">
                      <div className="font-semibold text-[var(--text-secondary)] mb-1">
                        Flight Details
                      </div>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <select
                          value={flightPlanDetails.flightDetails.mode}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              flightDetails: {
                                ...d.flightDetails,
                                mode: e.target.value,
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">Select mode</option>
                          {FLIGHT_MODES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <select
                          value={flightPlanDetails.flightDetails.category}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              flightDetails: {
                                ...d.flightDetails,
                                category: e.target.value,
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">Select category</option>
                          {FLIGHT_CATEGORIES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                          <input
                            type="checkbox"
                            checked={
                              flightPlanDetails.flightDetails.privateFlight
                            }
                            onChange={(e) =>
                              setFlightPlanDetails((d) => ({
                                ...d,
                                flightDetails: {
                                  ...d.flightDetails,
                                  privateFlight: e.target.checked,
                                },
                              }))
                            }
                          />
                          Private flight
                        </label>
                      </div>
                      <div className="mb-2">
                        <select
                          value={
                            flightPlanDetails.flightDetails.specialOperation
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              flightDetails: {
                                ...d.flightDetails,
                                specialOperation: e.target.value,
                              },
                            }))
                          }
                          className="input select text-xs py-1 w-full"
                        >
                          <option value="">Special operation?</option>
                          {SPECIAL_OPERATIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* UAS */}
                    <div className="border-b border-[var(--border-primary)] pb-2 mb-2">
                      <div className="font-semibold text-[var(--text-secondary)] mb-1">
                        UAS
                      </div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Registration number"
                          value={flightPlanDetails.uas.registrationNumber}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                registrationNumber: e.target.value,
                              },
                            }))
                          }
                          className="input w-32 text-xs"
                        />
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Serial number"
                          value={flightPlanDetails.uas.serialNumber}
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: { ...d.uas, serialNumber: e.target.value },
                            }))
                          }
                          className="input w-32 text-xs"
                        />
                      </div>
                      <div className="font-semibold text-[var(--text-tertiary)] mb-1 mt-2">
                        Flight Characteristics
                      </div>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <input
                          type="number"
                          placeholder="MTOM (kg)"
                          value={
                            flightPlanDetails.uas.flightCharacteristics.uasMTOM
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                flightCharacteristics: {
                                  ...d.uas.flightCharacteristics,
                                  uasMTOM: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input w-24 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Max speed (m/s)"
                          value={
                            flightPlanDetails.uas.flightCharacteristics
                              .uasMaxSpeed
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                flightCharacteristics: {
                                  ...d.uas.flightCharacteristics,
                                  uasMaxSpeed: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input w-28 text-xs"
                        />
                        <select
                          value={
                            flightPlanDetails.uas.flightCharacteristics
                              .connectivity
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                flightCharacteristics: {
                                  ...d.uas.flightCharacteristics,
                                  connectivity: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">Connectivity</option>
                          {CONNECTIVITY.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <select
                          value={
                            flightPlanDetails.uas.flightCharacteristics
                              .idTechnology
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                flightCharacteristics: {
                                  ...d.uas.flightCharacteristics,
                                  idTechnology: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">ID Technology</option>
                          {ID_TECHNOLOGY.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Max flight time (min)"
                          value={
                            flightPlanDetails.uas.flightCharacteristics
                              .maxFlightTime
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                flightCharacteristics: {
                                  ...d.uas.flightCharacteristics,
                                  maxFlightTime: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input w-40 text-xs"
                        />
                      </div>
                      <div className="font-semibold text-[var(--text-tertiary)] mb-1 mt-2">
                        General Characteristics
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="Brand"
                          value={
                            flightPlanDetails.uas.generalCharacteristics.brand
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                generalCharacteristics: {
                                  ...d.uas.generalCharacteristics,
                                  brand: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input w-24 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Model"
                          value={
                            flightPlanDetails.uas.generalCharacteristics.model
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                generalCharacteristics: {
                                  ...d.uas.generalCharacteristics,
                                  model: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input w-24 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Type certificate"
                          value={
                            flightPlanDetails.uas.generalCharacteristics
                              .typeCertificate
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                generalCharacteristics: {
                                  ...d.uas.generalCharacteristics,
                                  typeCertificate: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input w-28 text-xs"
                        />
                        <select
                          value={
                            flightPlanDetails.uas.generalCharacteristics.uasType
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                generalCharacteristics: {
                                  ...d.uas.generalCharacteristics,
                                  uasType: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">UAS Type</option>
                          {UAS_TYPE.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <select
                          value={
                            flightPlanDetails.uas.generalCharacteristics
                              .uasClass
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                generalCharacteristics: {
                                  ...d.uas.generalCharacteristics,
                                  uasClass: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">UAS Class</option>
                          {UAS_CLASS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <select
                          value={
                            flightPlanDetails.uas.generalCharacteristics
                              .uasDimension
                          }
                          onChange={(e) =>
                            setFlightPlanDetails((d) => ({
                              ...d,
                              uas: {
                                ...d.uas,
                                generalCharacteristics: {
                                  ...d.uas.generalCharacteristics,
                                  uasDimension: e.target.value,
                                },
                              },
                            }))
                          }
                          className="input select text-xs py-1"
                        >
                          <option value="">UAS Dimension</option>
                          {UAS_DIMENSION.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Operator ID */}
                    <div>
                      <label className="block mb-1 font-medium text-[var(--text-secondary)]">
                        Operator ID
                      </label>
                      <input
                        type="text"
                        value={flightPlanDetails.operatorId}
                        onChange={(e) =>
                          setFlightPlanDetails((d) => ({
                            ...d,
                            operatorId: e.target.value,
                          }))
                        }
                        className="input w-full"
                        placeholder="Operator registration number"
                      />
                    </div>
                  </div>
                )}
                {generatorMode === 'manual' && (
                <div className="mb-4">
                  <label className="block mb-1 font-medium text-[var(--text-secondary)]">
                    Plan name
                  </label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g. Mission 1"
                    disabled={loading}
                  />
                </div>
                )}
                
                {/* TASK-153 & TASK-043: Service Area / U-space Bounds Panel */}
                <div className="mb-4 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-orange-400 border-dashed rounded-sm" />
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">
                        {selectedUspace ? selectedUspace.name : 'FAS Service Area'}
                      </span>
                    </div>
                    {selectedUspace && (
                      <button
                        onClick={handleChangeUspace}
                        className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                        title="Change U-space"
                      >
                        <Edit2 className="w-3 h-3" />
                        Change
                      </button>
                    )}
                  </div>
                  
                  {/* TASK-052: Geozone visibility toggle */}
                  {geozonesData.length > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500" />
                        <span className="text-sm text-[var(--text-secondary)]">
                          Geozones
                        </span>
                        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                          {geozonesData.length}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer" title={geozonesVisible ? 'Hide geozones' : 'Show geozones'}>
                        <input
                          type="checkbox"
                          checked={geozonesVisible}
                          onChange={(e) => setGeozonesVisible(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                        <span className="ml-2 text-xs text-[var(--text-muted)]">
                          {geozonesVisible ? 'On' : 'Off'}
                        </span>
                      </label>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--text-tertiary)]">
                    <div className="flex justify-between">
                      <span>Min Lat:</span>
                      <span className="text-[var(--text-secondary)] font-mono">{effectiveServiceLimits[1].toFixed(4)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Lat:</span>
                      <span className="text-[var(--text-secondary)] font-mono">{effectiveServiceLimits[3].toFixed(4)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Lon:</span>
                      <span className="text-[var(--text-secondary)] font-mono">{effectiveServiceLimits[0].toFixed(4)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Lon:</span>
                      <span className="text-[var(--text-secondary)] font-mono">{effectiveServiceLimits[2].toFixed(4)}°</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[var(--border-primary)] text-xs text-[var(--text-muted)]">
                    Alt: {ALT_LIMITS[0]}-{ALT_LIMITS[1]}m AGL
                  </div>
                </div>
                
                {/* TASK-154: Boundary Warning - TASK-043: Updated to use effective limits */}
                {(() => {
                  const nearBoundary = getWaypointsNearBoundary(waypoints, effectiveServiceLimits);
                  if (nearBoundary.length === 0) return null;
                  return (
                    <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm font-semibold text-yellow-400">Boundary Warning</span>
                      </div>
                      <div className="text-xs text-yellow-300/80">
                        {nearBoundary.length === 1 ? (
                          <span>Waypoint {nearBoundary[0].index + 1} is {nearBoundary[0].distance}m from the {selectedUspace ? selectedUspace.name : 'service area'} boundary.</span>
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
                  );
                })()}
              </div>
              {generatorMode === 'manual' && (
              <div className="p-6 pt-2">
                <h3 className="font-semibold mb-2 text-[var(--text-secondary)]">Waypoints</h3>
                {waypoints.length === 0 && (
                  <div className="text-[var(--text-tertiary)] text-sm">
                    Click on the map to add waypoints.
                  </div>
                )}
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="waypoints-droppable">
                    {(provided) => (
                      <ul
                        className="space-y-2"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {waypoints.map((wp, idx) => (
                          <Draggable
                            key={idx}
                            draggableId={String(idx)}
                            index={idx}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <li
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`relative flex flex-col gap-1 p-2 rounded border ${
                                  selectedIdx === idx
                                    ? "bg-[var(--color-primary-light)] border-[var(--color-primary)]"
                                    : "bg-[var(--bg-secondary)] border-[var(--border-primary)]"
                                } ${
                                  dragSnapshot.isDragging
                                    ? "ring-2 ring-[var(--color-primary)]"
                                    : ""
                                }`}
                              >
                                {/* Remove button top right */}
                                <button
                                  className="absolute top-2 right-2 text-[var(--status-error)] hover:text-[var(--status-error-hover)] text-lg font-bold p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-[var(--status-error)]"
                                  onClick={() => handleRemoveWaypoint(idx)}
                                  type="button"
                                  aria-label="Remove waypoint"
                                >
                                  ×
                                </button>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-[var(--text-tertiary)] font-mono">
                                    {idx + 1}
                                  </span>
                                  <select
                                    value={wp.type}
                                    onChange={(e) =>
                                      handleWaypointChange(
                                        idx,
                                        "type",
                                        e.target.value
                                      )
                                    }
                                    className="input select text-xs py-0.5"
                                  >
                                    {waypointTypes.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={wp.altitude}
                                      onChange={(e) =>
                                        handleWaypointChange(
                                          idx,
                                          "altitude",
                                          Number(e.target.value)
                                        )
                                      }
                                      className="input w-20 text-xs py-0.5"
                                      placeholder="Altitude (m)"
                                      disabled={wp.type === "landing"}
                                    />
                                    <span className="text-xs text-[var(--text-tertiary)] ml-1">
                                      m
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={wp.speed}
                                      onChange={(e) =>
                                        handleWaypointChange(
                                          idx,
                                          "speed",
                                          Number(e.target.value)
                                        )
                                      }
                                      className="input w-16 text-xs py-0.5"
                                      placeholder="Speed (m/s)"
                                    />
                                    <span className="text-xs text-[var(--text-tertiary)] ml-1">
                                      m/s
                                    </span>
                                  </div>
                                  {/* TASK-122: Pause duration input */}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={3600}
                                      value={wp.pauseDuration || 0}
                                      onChange={(e) =>
                                        handleWaypointChange(
                                          idx,
                                          "pauseDuration",
                                          Number(e.target.value)
                                        )
                                      }
                                      className="input w-16 text-xs py-0.5"
                                      placeholder="Pause"
                                      title="Hold time at waypoint (0-3600 seconds)"
                                    />
                                    <span className="text-xs text-[var(--text-tertiary)] ml-1">
                                      s ⏱️
                                    </span>
                                  </div>
                                  {/* TASK-127 & TASK-130: Fly-by/Fly-over toggle with tooltip */}
                                  {wp.type === "cruise" && (
                                    <div className="flex items-center gap-1 ml-2" title="Fly-by: drone smoothly curves past the waypoint. Fly-over: drone must pass directly over the waypoint (more precise but slower).">
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={wp.flyOverMode || false}
                                          onChange={(e) =>
                                            handleWaypointChange(
                                              idx,
                                              "flyOverMode",
                                              e.target.checked
                                            )
                                          }
                                          className="sr-only peer"
                                        />
                                        <div className="w-8 h-4 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                                      </label>
                                      <span className={`text-xs font-medium ${wp.flyOverMode ? 'text-[var(--color-accent)]' : 'text-[var(--text-tertiary)]'}`}>
                                        {wp.flyOverMode ? '⎯○⎯' : '⌒'}
                                      </span>
                                      <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline" title="Fly-by: smooth curve past waypoint. Fly-over: pass directly over waypoint.">
                                        {wp.flyOverMode ? 'Over' : 'By'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <label className="text-xs text-[var(--text-tertiary)]">
                                    Lat:
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={Number(wp.lat).toFixed(7)}
                                    onChange={(e) =>
                                      handleWaypointChange(
                                        idx,
                                        "lat",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="input w-28 text-xs py-0.5"
                                  />
                                  <label className="text-xs text-[var(--text-tertiary)]">
                                    Lon:
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={Number(wp.lng).toFixed(7)}
                                    onChange={(e) =>
                                      handleWaypointChange(
                                        idx,
                                        "lng",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="input w-28 text-xs py-0.5"
                                  />
                                </div>
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
              )}
              {/* Bottom buttons (now scroll with sidebar) */}
              {generatorMode === 'manual' && (
              <div className="bg-[var(--surface-primary)] pt-4 pb-2 flex flex-col gap-2 px-6">
                <button
                  className="btn btn-primary w-full py-2 font-semibold disabled:opacity-60"
                  onClick={handleUploadPlan}
                  type="button"
                  disabled={loading}
                >
                  {loading ? "Uploading..." : "Upload to Trajectory Generator"}
                </button>
                <button
                  className="btn btn-danger w-full py-2 font-semibold"
                  onClick={handleClearAll}
                  type="button"
                >
                  Clear all
                </button>
              </div>
              )}
            </div>
          </div>
        </aside>
        {/* Map on the right */}
        <main className="plan-gen-map flex-1">
          {/* The MapContainer and its logic have been moved to PlanMap.tsx */}
          {/* The PlanMap component will be rendered here */}
          {/* TASK-216: Use ref-based handler for stable click handling in SCAN mode */}
          <PlanMap 
            center={center} 
            bounds={bounds} 
            polylinePositions={polylinePositions} 
            handleAddWaypoint={handleAddWaypoint} 
            setToast={showToast} 
            waypoints={waypoints} 
            setSelectedIdx={setSelectedIdx} 
            handleMarkerDragEnd={handleMarkerDragEnd}
            scanMode={generatorMode === 'scan'}
            scanOverlays={scanOverlays || undefined}
            customClickHandler={scanMapClickHandlerRef.current}
            key={`planmap-${scanHandlerVersion}`} // Force re-render when handler changes
            // TASK-051: Pass geozone data to PlanMap
            geozonesData={geozonesData}
            // TASK-052: Control geozone visibility via toggle
            geozonesVisible={geozonesVisible}
            // TASK-054/056: Pass U-space name for display and error messages
            uspaceName={selectedUspace?.name}
          />
        </main>
      </div>
    </div>
  );
}
