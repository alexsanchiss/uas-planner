// To use this component, install the dependencies with:
// npm install react-leaflet@4 leaflet
// For TypeScript types, also install:
// npm install --save-dev @types/leaflet
// For waypoint drag and drop:
// npm install @hello-pangea/dnd

"use client";
import React, { useRef, useLayoutEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  Rectangle, // <-- add Rectangle
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { HelpCircle } from "lucide-react";
import dynamic from 'next/dynamic';

const PlanMap = dynamic(() => import('./PlanMap'), { ssr: false });

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

// Helper to check if a point is inside the limits
function isWithinServiceLimits(lat: number, lng: number) {
  return (
    lat >= SERVICE_LIMITS[1] && lat <= SERVICE_LIMITS[3] &&
    lng >= SERVICE_LIMITS[0] && lng <= SERVICE_LIMITS[2]
  );
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
  const first = waypoints[0];
  items.push({
    AMSLAltAboveTerrain: null,
    Altitude: first.altitude,
    AltitudeMode: 1,
    autoContinue: true,
    command: 22,
    doJumpId: doJumpId++,
    frame: 3,
    params: [0, 0, 0, null, first.lat, first.lng, first.altitude],
    type: "SimpleItem",
  });

  // Cruise (16) for intermediate waypoints (excluding first and last)
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i];
    items.push({
      AMSLAltAboveTerrain: null,
      Altitude: wp.altitude,
      AltitudeMode: 1,
      autoContinue: true,
      command: 16,
      doJumpId: doJumpId++,
      frame: 3,
      params: [0, 0, 0, null, wp.lat, wp.lng, wp.altitude],
      type: "SimpleItem",
    });
  }

  // Landing (21) for the last waypoint
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
      params: [0, 0, 0, null, last.lat, last.lng, 0],
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
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const [flightPlanDetails, setFlightPlanDetails] = useState(
    initialFlightPlanDetails
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Map bounds and center
  const bounds = [
    [SERVICE_LIMITS[1], SERVICE_LIMITS[0]], // SW: [minLat, minLng]
    [SERVICE_LIMITS[3], SERVICE_LIMITS[2]], // NE: [maxLat, maxLng]
  ];
  const center = [
    (SERVICE_LIMITS[1] + SERVICE_LIMITS[3]) / 2,
    (SERVICE_LIMITS[0] + SERVICE_LIMITS[2]) / 2,
  ];

  const handleAddWaypoint = (wp: Waypoint) => {
    // Only add if within limits
    if (!isWithinServiceLimits(wp.lat, wp.lng)) {
      setToast("Waypoints must be within the FAS service area.");
      return;
    }
    setWaypoints((prev) => {
      let newWps = [...prev, wp];
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
            setToast(`Altitude must be between ${ALT_LIMITS[0]} and ${ALT_LIMITS[1]} meters.`);
            return { ...wp, altitude: clamped };
          }
          return { ...wp, altitude: clamped };
        }
        if ((field === "lat" || field === "lng")) {
          // Only allow if within limits
          const newLat = field === "lat" ? Number(value) : wp.lat;
          const newLng = field === "lng" ? Number(value) : wp.lng;
          if (!isWithinServiceLimits(newLat, newLng)) {
            setToast("Waypoints must be within the FAS service area.");
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
  const polylinePositions = waypoints.map((wp) => [wp.lat, wp.lng]);

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
    // Only allow if within limits
    if (!isWithinServiceLimits(lat, lng)) {
      setToast("Waypoints must be within the FAS service area.");
      return;
    }
    setWaypoints((wps) =>
      wps.map((wp, i) => (i === idx ? { ...wp, lat, lng } : wp))
    );
  };

  // Upload plan
  const handleUploadPlan = async () => {
    if (!user) {
      setToast("You must be logged in to upload the plan.");
      return;
    }
    if (!planName.trim()) {
      setToast("Please enter a name for the plan.");
      return;
    }
    if (waypoints.length === 0) {
      setToast("The plan must have at least one waypoint.");
      return;
    }
    if (!waypoints.some((wp) => wp.type === "takeoff")) {
      setToast("The plan must have at least one takeoff waypoint.");
      return;
    }
    // Only one takeoff and one landing allowed
    if (waypoints.filter((wp) => wp.type === "takeoff").length > 1) {
      setToast("The plan cannot have more than one takeoff waypoint.");
      return;
    }
    if (waypoints.filter((wp) => wp.type === "landing").length > 1) {
      setToast("The plan cannot have more than one landing waypoint.");
      return;
    }
    if (waypoints.length === 10) {
      setToast("The plan must have at least two waypoints.");
      return;
    }
    setLoading(true);
    try {
      // 1. Find or create "Plan Generator" folder
      let folderId: number | null = null;
      const foldersRes = await axios.get(`/api/folders?userId=${user.id}`);
      const planGenFolder = foldersRes.data.find(
        (f: any) => f.name === "Plan Generator"
      );
      if (planGenFolder) {
        folderId = planGenFolder.id;
      } else {
        // Create folder
        const folderRes = await axios.post("/api/folders", {
          name: "Plan Generator",
          userId: user.id,
        });
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
      // Use the new unified API
      const createRes = await axios.post("/api/flightPlans", {
        customName: planName,
        status: "sin procesar",
        fileContent: JSON.stringify(qgcPlan),
        userId: user.id,
        folderId,
        uplan: JSON.stringify(uplanDetails),
        scheduledAt,
      });
      setToast(
        `The plan "${planName}" has been saved in the Plan Generator folder in Trajectory Generator.`
      );
      setPlanName("");
    } catch (err: any) {
      setToast(
        "Error uploading the plan: " +
          (err?.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // Toast auto-hide
  React.useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Header height: 56px (py-3 on header)
  const HEADER_HEIGHT = 120.67;
  // Add login check at the top of the return
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="text-2xl text-white font-semibold">You must be logged in to access the Plan Generator.</div>
      </div>
    );
  }
  return (
    <div className="w-full bg-zinc-900 overflow-x-hidden">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[2000] px-6 py-3 rounded shadow-lg text-base font-semibold animate-fade-in ${
            toast.includes('has been saved in the Plan Generator folder in Trajectory Generator.')
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast}
        </div>
      )}
      {/* Help Button */}
      <a
        href="/how-it-works#plan-generator-help"
        target="_self"
        className="fixed top-24 right-8 z-[2000] bg-blue-700 hover:bg-blue-800 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
        title="Need help with Plan Generator?"
      >
        <HelpCircle className="w-6 h-6" />
      </a>
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
      `}</style>
      <div className="plan-gen-main">
        {/* Sidebar */}
        <aside className="plan-gen-sidebar relative z-10 flex flex-col w-[420px] min-w-[320px] max-w-[520px] bg-app-sidebar border-r border-zinc-800 shadow-lg">
          <div className="flex flex-col h-full w-full">
            {/* Scrollable content: header, plan details, waypoint list, and bottom buttons */}
            <div>
              <div className="p-6 pb-0">
                <h2 className="text-2xl font-bold mb-4 text-white">
                  Flight Plan
                </h2>
                <button
                  className="w-full flex items-center justify-between bg-zinc-800 text-white px-4 py-2 rounded-t-md border border-zinc-700 font-semibold focus:outline-none"
                  onClick={() => setDetailsOpen((o) => !o)}
                  type="button"
                >
                  Flight Plan Details
                  <span className="ml-2">{detailsOpen ? "▲" : "▼"}</span>
                </button>
                {detailsOpen && (
                  <div className="bg-zinc-800 border-x border-b border-zinc-700 rounded-b-md p-4 space-y-4 mt-0">
                    {/* Date/Time */}
                    <div>
                      <label className="block mb-1 font-medium text-zinc-200">
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
                        className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                    {/* Data Owner Identifier */}
                    <div className="border-b border-zinc-700 pb-2 mb-2">
                      <div className="font-semibold text-zinc-300 mb-1">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    {/* Data Source Identifier */}
                    <div className="border-b border-zinc-700 pb-2 mb-2">
                      <div className="font-semibold text-zinc-300 mb-1">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    {/* Contact Details */}
                    <div className="border-b border-zinc-700 pb-2 mb-2">
                      <div className="font-semibold text-zinc-300 mb-1">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="mb-2">
                        <div className="text-xs text-zinc-400 mb-1">Phones</div>
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
                                className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-40 text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                className="text-red-400 hover:text-red-600 text-xs font-bold"
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
                          className="text-blue-400 hover:underline text-xs"
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
                        <div className="text-xs text-zinc-400 mb-1">Emails</div>
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
                                className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-40 text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                className="text-red-400 hover:text-red-600 text-xs font-bold"
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
                          className="text-blue-400 hover:underline text-xs"
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
                    <div className="border-b border-zinc-700 pb-2 mb-2">
                      <div className="font-semibold text-zinc-300 mb-1">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
                        >
                          <option value="">Select category</option>
                          {FLIGHT_CATEGORIES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-zinc-400">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none w-full"
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
                    <div className="border-b border-zinc-700 pb-2 mb-2">
                      <div className="font-semibold text-zinc-300 mb-1">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="font-semibold text-zinc-400 mb-1 mt-2">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-24 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-28 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-40 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="font-semibold text-zinc-400 mb-1 mt-2">
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-24 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-24 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-28 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
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
                          className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
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
                      <label className="block mb-1 font-medium text-zinc-200">
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
                        className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Operator registration number"
                      />
                    </div>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block mb-1 font-medium text-zinc-200">
                    Plan name
                  </label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="border border-zinc-700 bg-zinc-800 text-white rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Mission 1"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="p-6 pt-2">
                <h3 className="font-semibold mb-2 text-zinc-200">Waypoints</h3>
                {waypoints.length === 0 && (
                  <div className="text-zinc-400 text-sm">
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
                                    ? "bg-blue-900 border-blue-400"
                                    : "bg-zinc-800 border-zinc-700"
                                } ${
                                  dragSnapshot.isDragging
                                    ? "ring-2 ring-blue-400"
                                    : ""
                                }`}
                              >
                                {/* Remove button top right */}
                                <button
                                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-lg font-bold p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-red-400"
                                  onClick={() => handleRemoveWaypoint(idx)}
                                  type="button"
                                  aria-label="Remove waypoint"
                                >
                                  ×
                                </button>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-zinc-400 font-mono">
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
                                    className="border border-zinc-700 bg-zinc-900 text-white rounded px-1 py-0.5 text-xs focus:outline-none"
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
                                      className="border border-zinc-700 bg-zinc-900 text-white rounded px-1 py-0.5 w-20 text-xs focus:outline-none"
                                      placeholder="Altitude (m)"
                                      disabled={wp.type === "landing"}
                                    />
                                    <span className="text-xs text-zinc-400 ml-1">
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
                                      className="border border-zinc-700 bg-zinc-900 text-white rounded px-1 py-0.5 w-16 text-xs focus:outline-none"
                                      placeholder="Speed (m/s)"
                                    />
                                    <span className="text-xs text-zinc-400 ml-1">
                                      m/s
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <label className="text-xs text-zinc-400">
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
                                    className="border border-zinc-700 bg-zinc-900 text-white rounded px-1 py-0.5 w-28 text-xs focus:outline-none"
                                  />
                                  <label className="text-xs text-zinc-400">
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
                                    className="border border-zinc-700 bg-zinc-900 text-white rounded px-1 py-0.5 w-28 text-xs focus:outline-none"
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
              {/* Bottom buttons (now scroll with sidebar) */}
              <div className="bg-app-sidebar pt-4 pb-2 flex flex-col gap-2 px-6">
                <button
                  className="w-full bg-blue-700 text-white rounded py-2 font-semibold hover:bg-blue-800 transition border border-blue-900 disabled:opacity-60"
                  onClick={handleUploadPlan}
                  type="button"
                  disabled={loading}
                >
                  {loading ? "Uploading..." : "Upload to Trajectory Generator"}
                </button>
                <button
                  className="w-full bg-red-900 text-red-200 rounded py-2 font-semibold hover:bg-red-800 transition border border-red-800"
                  onClick={handleClearAll}
                  type="button"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>
        </aside>
        {/* Map on the right */}
        <main className="plan-gen-map flex-1">
          {/* The MapContainer and its logic have been moved to PlanMap.tsx */}
          {/* The PlanMap component will be rendered here */}
          <PlanMap center={center} bounds={bounds} polylinePositions={polylinePositions} handleAddWaypoint={handleAddWaypoint} setToast={setToast} waypoints={waypoints} setSelectedIdx={setSelectedIdx} handleMarkerDragEnd={handleMarkerDragEnd} />
        </main>
      </div>
    </div>
  );
}
