"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Papa from 'papaparse';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, CircleMarker, useMap, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import dynamic from 'next/dynamic';
const MapModal = dynamic(() => import('./MapModal'), { ssr: false });
const UplanViewModal = dynamic(() => import('./UplanViewModal'), { ssr: false });
const BulkUplanViewModal = dynamic(() => import('./BulkUplanViewModal'), { ssr: false });

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

// Uplan Edit Modal (reusable for both PlanGenerator and FlightPlansUploader)
function UplanEditModal({ open, onClose, uplan, onSave, readOnly = false }: {
  open: boolean;
  onClose: () => void;
  uplan: any;
  onSave: (newUplan: any) => void;
  readOnly?: boolean;
}) {
  // Default structure as in PlanGenerator
  const defaultUplan = {
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

  // Deep merge function
  function deepMerge(target: any, source: any) {
    if (typeof target !== "object" || typeof source !== "object" || !target || !source) return source;
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // Defensive: parse uplan if it's a string (shouldn't be needed, but extra safe)
  let safeUplan = uplan;
  for (let i = 0; i < 2; i++) {
    if (typeof safeUplan === "string") {
      try {
        safeUplan = JSON.parse(safeUplan);
      } catch {
        break;
      }
    }
  }

  const [editUplan, setEditUplan] = useState<any>(deepMerge(defaultUplan, safeUplan || {}));
  useEffect(() => {
    setEditUplan(deepMerge(defaultUplan, safeUplan || {}));
    // eslint-disable-next-line
  }, [uplan, open]);

  if (!open) return null;

  // Option lists (copy from PlanGenerator)
  const FLIGHT_MODES = ["VLOS", "BVLOS"];
  const FLIGHT_CATEGORIES = [
    "OPENA1",
    "OPENA2",
    "OPENA3",
    "LUC",
    "LIMITEDOPEN",
    "CERTIFIED",
    "SPECIFIC",
    "STS",
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

  // Helper for updating nested fields
  function updateNested(path: string[], value: any) {
    setEditUplan((prev: any) => {
      let obj = { ...prev };
      let cur = obj;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur[path[i]] = { ...cur[path[i]] };
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return obj;
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={readOnly ? "View U-plan Info" : "Edit U-plan Info"}>
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        {/* Data Owner Identifier */}
        <div>
          <div className="font-semibold text-zinc-300 mb-1">Data Owner Identifier</div>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={3}
              placeholder="SAC"
              value={editUplan.dataOwnerIdentifier?.sac || ""}
              onChange={e => updateNested(["dataOwnerIdentifier", "sac"], e.target.value.toUpperCase())}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="text"
              maxLength={3}
              placeholder="SIC"
              value={editUplan.dataSourceIdentifier?.sic || ""}
              onChange={e => updateNested(["dataSourceIdentifier", "sic"], e.target.value.toUpperCase())}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
              disabled={readOnly}
            />
          </div>
        </div>
        {/* Data Source Identifier */}
        <div>
          <div className="font-semibold text-zinc-300 mb-1">Data Source Identifier</div>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={3}
              placeholder="SAC"
              value={editUplan.dataSourceIdentifier?.sac || ""}
              onChange={e => updateNested(["dataSourceIdentifier", "sac"], e.target.value.toUpperCase())}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="text"
              maxLength={3}
              placeholder="SIC"
              value={editUplan.dataSourceIdentifier?.sic || ""}
              onChange={e => updateNested(["dataSourceIdentifier", "sic"], e.target.value.toUpperCase())}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-20 text-xs focus:outline-none"
              disabled={readOnly}
            />
          </div>
        </div>
        {/* Contact Details */}
        <div>
          <div className="font-semibold text-zinc-300 mb-1">Contact Details</div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="First Name"
              value={editUplan.contactDetails?.firstName || ""}
              onChange={e => updateNested(["contactDetails", "firstName"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={editUplan.contactDetails?.lastName || ""}
              onChange={e => updateNested(["contactDetails", "lastName"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
              disabled={readOnly}
            />
          </div>
          <div className="mb-2">
            <div className="text-xs text-zinc-400 mb-1">Phones</div>
            {(editUplan.contactDetails?.phones || [""]).map((phone: string, i: number) => (
              <div key={i} className="flex gap-2 mb-1">
                <input
                  type="text"
                  placeholder="Phone"
                  value={phone}
                  onChange={e => {
                    const phones = [...(editUplan.contactDetails?.phones || [""])]
                    phones[i] = e.target.value;
                    updateNested(["contactDetails", "phones"], phones);
                  }}
                  className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-40 text-xs focus:outline-none"
                  disabled={readOnly}
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 text-xs font-bold"
                    onClick={() => {
                      const phones = (editUplan.contactDetails?.phones || [""]).filter((_: any, idx: number) => idx !== i);
                      updateNested(["contactDetails", "phones"], phones.length ? phones : [""]);
                    }}
                  >×</button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                className="text-blue-400 hover:underline text-xs"
                onClick={() => {
                  const phones = [...(editUplan.contactDetails?.phones || [""]), ""];
                  updateNested(["contactDetails", "phones"], phones);
                }}
              >Add phone</button>
            )}
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Emails</div>
            {(editUplan.contactDetails?.emails || [""]).map((email: string, i: number) => (
              <div key={i} className="flex gap-2 mb-1">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => {
                    const emails = [...(editUplan.contactDetails?.emails || [""])]
                    emails[i] = e.target.value;
                    updateNested(["contactDetails", "emails"], emails);
                  }}
                  className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-40 text-xs focus:outline-none"
                  disabled={readOnly}
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 text-xs font-bold"
                    onClick={() => {
                      const emails = (editUplan.contactDetails?.emails || [""]).filter((_: any, idx: number) => idx !== i);
                      updateNested(["contactDetails", "emails"], emails.length ? emails : [""]);
                    }}
                  >×</button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                className="text-blue-400 hover:underline text-xs"
                onClick={() => {
                  const emails = [...(editUplan.contactDetails?.emails || [""]), ""];
                  updateNested(["contactDetails", "emails"], emails);
                }}
              >Add email</button>
            )}
          </div>
        </div>
        {/* Flight Details */}
        <div>
          <div className="font-semibold text-zinc-300 mb-1">Flight Details</div>
          <div className="flex gap-2 mb-2 flex-wrap">
            <select
              value={editUplan.flightDetails?.mode || ""}
              onChange={e => updateNested(["flightDetails", "mode"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">Select mode</option>
              {FLIGHT_MODES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select
              value={editUplan.flightDetails?.category || ""}
              onChange={e => updateNested(["flightDetails", "category"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">Select category</option>
              {FLIGHT_CATEGORIES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={!!editUplan.flightDetails?.privateFlight}
                onChange={e => updateNested(["flightDetails", "privateFlight"], e.target.checked)}
                disabled={readOnly}
              />
              Private flight
            </label>
          </div>
          <div className="mb-2">
            <select
              value={editUplan.flightDetails?.specialOperation || ""}
              onChange={e => updateNested(["flightDetails", "specialOperation"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none w-full"
              disabled={readOnly}
            >
              <option value="">Special operation?</option>
              {SPECIAL_OPERATIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        {/* UAS */}
        <div>
          <div className="font-semibold text-zinc-300 mb-1">UAS</div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Registration number"
              value={editUplan.uas?.registrationNumber || ""}
              onChange={e => updateNested(["uas", "registrationNumber"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="text"
              maxLength={20}
              placeholder="Serial number"
              value={editUplan.uas?.serialNumber || ""}
              onChange={e => updateNested(["uas", "serialNumber"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-32 text-xs focus:outline-none"
              disabled={readOnly}
            />
          </div>
          <div className="font-semibold text-zinc-400 mb-1 mt-2">Flight Characteristics</div>
          <div className="flex gap-2 mb-2 flex-wrap">
            <input
              type="number"
              placeholder="MTOM (kg)"
              value={editUplan.uas?.flightCharacteristics?.uasMTOM || ""}
              onChange={e => updateNested(["uas", "flightCharacteristics", "uasMTOM"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-24 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="number"
              placeholder="Max speed (m/s)"
              value={editUplan.uas?.flightCharacteristics?.uasMaxSpeed || ""}
              onChange={e => updateNested(["uas", "flightCharacteristics", "uasMaxSpeed"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-28 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <select
              value={editUplan.uas?.flightCharacteristics?.connectivity || ""}
              onChange={e => updateNested(["uas", "flightCharacteristics", "connectivity"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">Connectivity</option>
              {CONNECTIVITY.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select
              value={editUplan.uas?.flightCharacteristics?.idTechnology || ""}
              onChange={e => updateNested(["uas", "flightCharacteristics", "idTechnology"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">ID Technology</option>
              {ID_TECHNOLOGY.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <input
              type="number"
              placeholder="Max flight time (min)"
              value={editUplan.uas?.flightCharacteristics?.maxFlightTime || ""}
              onChange={e => updateNested(["uas", "flightCharacteristics", "maxFlightTime"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-40 text-xs focus:outline-none"
              disabled={readOnly}
            />
          </div>
          <div className="font-semibold text-zinc-400 mb-1 mt-2">General Characteristics</div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Brand"
              value={editUplan.uas?.generalCharacteristics?.brand || ""}
              onChange={e => updateNested(["uas", "generalCharacteristics", "brand"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-24 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="text"
              placeholder="Model"
              value={editUplan.uas?.generalCharacteristics?.model || ""}
              onChange={e => updateNested(["uas", "generalCharacteristics", "model"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-24 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <input
              type="text"
              placeholder="Type certificate"
              value={editUplan.uas?.generalCharacteristics?.typeCertificate || ""}
              onChange={e => updateNested(["uas", "generalCharacteristics", "typeCertificate"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-28 text-xs focus:outline-none"
              disabled={readOnly}
            />
            <select
              value={editUplan.uas?.generalCharacteristics?.uasType || ""}
              onChange={e => updateNested(["uas", "generalCharacteristics", "uasType"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">UAS Type</option>
              {UAS_TYPE.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select
              value={editUplan.uas?.generalCharacteristics?.uasClass || ""}
              onChange={e => updateNested(["uas", "generalCharacteristics", "uasClass"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">UAS Class</option>
              {UAS_CLASS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select
              value={editUplan.uas?.generalCharacteristics?.uasDimension || ""}
              onChange={e => updateNested(["uas", "generalCharacteristics", "uasDimension"], e.target.value)}
              className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 text-xs focus:outline-none"
              disabled={readOnly}
            >
              <option value="">UAS Dimension</option>
              {UAS_DIMENSION.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        {/* Operator ID */}
        <div>
          <label className="block mb-1 font-medium text-zinc-200">Operator ID</label>
          <input
            type="text"
            value={editUplan.operatorId || ""}
            onChange={e => updateNested(["operatorId"], e.target.value)}
            className="border border-zinc-700 bg-zinc-900 text-white rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={readOnly}
            placeholder="Operator registration number"
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => onSave(editUplan)}
              type="button"
            >
              Save
            </button>
          )}
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
  // Uplan edit modal state
  const [uplanEditModal, setUplanEditModal] = useState<{ open: boolean, uplan: any, planId: number | null }>({ open: false, uplan: null, planId: null });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
      // const interval = setInterval(fetchData, 5000);
      // return () => clearInterval(interval);
      // Removed periodic refresh to avoid re-render every 5 seconds
      return;
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

  // Limit concurrency to avoid request floods
  async function withConcurrency<T>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) {
    let i = 0;
    const running: Promise<void>[] = [];
    const launch = () => {
      if (i >= items.length) return;
      const idx = i++;
      const p = worker(items[idx], idx).finally(() => {
        const pos = running.indexOf(p);
        if (pos >= 0) running.splice(pos, 1);
      });
      running.push(p);
      if (running.length < limit) launch();
    };
    const parallel = Math.min(limit, items.length);
    for (let k = 0; k < parallel; k++) launch();
    await Promise.all(running);
  }

  // Expand input FileList into a list of virtual files (supporting .zip)
  type VirtualFile = { name: string; getText: () => Promise<string> };
  const expandInputFiles = async (files: FileList | File[]): Promise<VirtualFile[]> => {
    const list: File[] = Array.from(files as unknown as File[]);
    const out: VirtualFile[] = [];
    for (const f of list) {
      const isZip = f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip';
      if (!isZip) {
        out.push({ name: f.name, getText: () => f.text() });
        continue;
      }
      try {
        const zip = await JSZip.loadAsync(await f.arrayBuffer());
        const entries = Object.values(zip.files).filter((e: any) => !e.dir) as unknown as JSZip.JSZipObject[];
        for (const entry of entries) {
          // Read as text; skip binary
          out.push({
            name: entry.name.split('/').pop() || entry.name,
            getText: () => entry.async('text'),
          });
        }
      } catch (e) {
        // If zip parsing fails, skip this file
        // eslint-disable-next-line no-console
        console.error('Failed to parse zip:', f.name, e);
      }
    }
    return out;
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folderId: number
  ) => {
    const files = e.target.files;
    if (files) {
      const virtualFiles = await expandInputFiles(files);
      // If extremely large selection, prefer bulk endpoint in chunks
      const BULK_THRESHOLD = 100; // switch to bulk after this many files
      const BULK_BATCH = 500; // client-side chunk size to keep payloads manageable
      if (virtualFiles.length >= BULK_THRESHOLD) {
        const chunks: VirtualFile[][] = [];
        for (let i = 0; i < virtualFiles.length; i += BULK_BATCH) {
          chunks.push(virtualFiles.slice(i, i + BULK_BATCH));
        }
        const createdItems: any[] = [];
        for (const chunk of chunks) {
          const plansPayload = await Promise.all(
            chunk.map(async (vf) => ({
              customName: vf.name.replace(/\.[^/.]+$/, ""),
              status: "sin procesar",
              fileContent: await vf.getText(),
              userId: user?.id,
              folderId: folderId,
            }))
          );
          // Use the new unified API with items array
          const res = await axios.post("/api/flightPlans", { items: plansPayload });
          if (res?.data?.items) createdItems.push(...res.data.items);
        }
        setFlightPlans([...flightPlans, ...createdItems]);
      } else {
        // Fallback to per-file uploads with limited concurrency
        const created: any[] = [];
        await withConcurrency(virtualFiles, 5, async (vf) => {
          const response = await axios.post("/api/flightPlans", {
            customName: vf.name.replace(/\.[^/.]+$/, ""),
            status: "sin procesar",
            fileContent: await vf.getText(),
            userId: user?.id,
            folderId: folderId,
          });
          created.push({ ...response.data });
        });
        setFlightPlans([...flightPlans, ...created]);
      }
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
    const ids = folderPlans.map(p => p.id);
    // Actualizar estado local inmediatamente para todos los planes de la carpeta
    setFlightPlans(
      flightPlans.map((plan) =>
        plan.folderId === folderId ? { ...plan, status: "en cola" } : plan
      )
    );
    // Procesar todos en una sola llamada usando la API unificada
    try {
      await axios.put(`/api/flightPlans`, { ids, data: { status: "en cola" } });
      fetchData();
    } catch (error) {
      console.error("Error bulk processing folder:", error);
      setFlightPlans(
        flightPlans.map((p) =>
          ids.includes(p.id) ? { ...p, status: "error" } : p
        )
      );
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

    // Use bulk API and split into multiple zips if large
    const ids = folderPlans.map(p => p.id);
    const BATCH = 500; // API batch size
    const ZIP_MAX_FILES = 1000; // files per zip for memory limits
    const usedNames = new Map<string, boolean>();

    for (let i = 0; i < ids.length; i += BATCH) {
      const batchIds = ids.slice(i, i + BATCH);
      try {
        const res = await axios.post(`/api/csvResult/bulk`, { ids: batchIds });
        const items: { id: number, customName: string, csvResult: string }[] = res.data.items || [];
        // Partition into zips of at most ZIP_MAX_FILES
        for (let j = 0; j < items.length; j += ZIP_MAX_FILES) {
          const chunk = items.slice(j, j + ZIP_MAX_FILES);
          const zip = new JSZip();
          chunk.forEach((it) => {
            let baseName = `${it.customName}`;
            let fileName = `${baseName}.csv`;
            let count = 1;
            while (usedNames.has(fileName)) {
              fileName = `${baseName} (${count}).csv`;
              count++;
            }
            usedNames.set(fileName, true);
            zip.file(fileName, it.csvResult);
          });
          const content = await zip.generateAsync({ type: "blob" });
          const zipName = `${folder?.name || "folder"}${ids.length > ZIP_MAX_FILES ? `_${i + j + 1}-${i + j + chunk.length}` : ""}.zip`;
          saveAs(content, zipName);
        }
      } catch (error) {
        console.error("Error bulk downloading CSVs:", error);
      }
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (
      typeof window !== 'undefined' && window.confirm(
        "Are you sure you want to delete this folder and all its plans?"
      )
    ) {
      try {
        // Obtener todos los planes de la carpeta
        const folderPlans = flightPlans.filter((p) => p.folderId === folderId);
        const ids = folderPlans.map(p => p.id);
        if (ids.length > 0) {
          // Use the unified index route for bulk deletion
          await axios.delete(`/api/flightPlans`, { data: { ids } });
        }
        // Eliminar la carpeta usando la API optimizada
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
      await axios.put(`/api/flightPlans`, { id: planId, data: { customName: newName } });
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
      await axios.put(`/api/flightPlans`, { id: planId, data: { scheduledAt: value ? new Date(value).toISOString() : null } });
    } catch (error) {
      console.error("Error updating scheduledAt:", error);
      fetchData();
    }
  };

  const handleProcessTrajectory = async (planId: number) => {
    try {
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, status: "en cola" } : plan
        )
      );
      const response = await axios.put(`/api/flightPlans`, { id: planId, data: { status: "en cola" } });
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, ...response.data } : plan
        )
      );
    } catch (error) {
      console.error("Error processing plan:", error);
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
      await axios.delete(`/api/flightPlans`, { data: { id: planId } });
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
    try {
      await axios.put(`/api/flightPlans`, { ids: selectedPlans, data: { status: "en cola" } });
      fetchData();
    } catch (error) {
      console.error("Error bulk processing selected plans:", error);
      setFlightPlans(
        flightPlans.map((p) =>
          selectedPlans.includes(p.id) ? { ...p, status: "error" } : p
        )
      );
    }
  };

  const handleDownloadSelectedPlans = async () => {
    if (selectedPlans.length === 0) {
      alert("No plans selected to download.");
      return;
    }

    const processedIds = selectedPlans.filter((id) => {
      const p = flightPlans.find(fp => fp.id === id);
      return p?.status === "procesado" && p.csvResult;
    });
    if (processedIds.length === 0) {
      alert("No processed plans selected to download.");
      return;
    }
    const BATCH = 500;
    const ZIP_MAX_FILES = 1000;
    const usedNames = new Map<string, boolean>();
    for (let i = 0; i < processedIds.length; i += BATCH) {
      const batchIds = processedIds.slice(i, i + BATCH);
      try {
        const res = await axios.post(`/api/csvResult/bulk`, { ids: batchIds });
        const items: { id: number, customName: string, csvResult: string }[] = res.data.items || [];
        for (let j = 0; j < items.length; j += ZIP_MAX_FILES) {
          const chunk = items.slice(j, j + ZIP_MAX_FILES);
          const zip = new JSZip();
          chunk.forEach((it) => {
            let baseName = `${it.customName}`;
            let fileName = `${baseName}.csv`;
            let count = 1;
            while (usedNames.has(fileName)) {
              fileName = `${baseName} (${count}).csv`;
              count++;
            }
            usedNames.set(fileName, true);
            zip.file(fileName, it.csvResult);
          });
          const content = await zip.generateAsync({ type: "blob" });
          const zipName = processedIds.length > ZIP_MAX_FILES ? `selected_${i + j + 1}-${i + j + chunk.length}.zip` : `selected_plans.zip`;
          saveAs(content, zipName);
        }
      } catch (error) {
        console.error("Error bulk downloading selected CSVs:", error);
      }
    }
  };

  const handleDeleteSelectedPlans = async () => {
    if (typeof window !== 'undefined' && window.confirm("Are you sure you want to delete the selected plans?")) {
      try {
        const ids = [...selectedPlans];
        if (ids.length > 0) {
          // Use the unified index route for bulk deletion
          await axios.delete(`/api/flightPlans`, { data: { ids } });
        }
        setFlightPlans(flightPlans.filter((p) => !ids.includes(p.id)));
        setSelectedPlans([]);
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
        if (typeof window !== 'undefined') {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.setAttribute("hidden", "");
          a.setAttribute("href", url);
          a.setAttribute("download", fileName);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
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
      const virtualFiles = await expandInputFiles(files);
      const BULK_THRESHOLD = 100;
      const BULK_BATCH = 500;
      if (virtualFiles.length >= BULK_THRESHOLD) {
        const chunks: VirtualFile[][] = [];
        for (let i = 0; i < virtualFiles.length; i += BULK_BATCH) {
          chunks.push(virtualFiles.slice(i, i + BULK_BATCH));
        }
        const createdItems: any[] = [];
        for (const chunk of chunks) {
          const plansPayload = await Promise.all(
            chunk.map(async (vf) => ({
              customName: vf.name.replace(/\.[^/.]+$/, ""),
              status: "sin procesar",
              fileContent: await vf.getText(),
              userId: user?.id,
              folderId: folderId,
            }))
          );
          // Use the new unified API with items array
          const res = await axios.post("/api/flightPlans", { items: plansPayload });
          if (res?.data?.items) createdItems.push(...res.data.items);
        }
        setFlightPlans([...flightPlans, ...createdItems]);
      } else {
        // Fallback to per-file uploads with limited concurrency
        const created: any[] = [];
        await withConcurrency(virtualFiles, 5, async (vf) => {
          const response = await axios.post("/api/flightPlans", {
            customName: vf.name.replace(/\.[^/.]+$/, ""),
            status: "sin procesar",
            fileContent: await vf.getText(),
            userId: user?.id,
            folderId: folderId,
          });
          created.push({ ...response.data });
        });
        setFlightPlans([...flightPlans, ...created]);
      }
    }
  };

  const handleRequestAuthorization = async (planId: number) => {
    setAuthorizationLoading((prev) => ({ ...prev, [planId]: true }));
    setFlightPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? { ...plan, authorizationStatus: "procesando autorización" }
          : plan
      )
    );
    try {
      await axios.put(`/api/flightPlans`, { id: planId, data: { authorizationStatus: "procesando autorización" } });
      await axios.post(`/api/flightPlans/${planId}/uplan`);
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.error || error?.message || "Unknown error";
      console.error("Error requesting authorization:", errorMsg);
    } finally {
      setAuthorizationLoading((prev) => ({ ...prev, [planId]: false }));
    }
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
      const items = folderPlans.map((plan) => {
        const randomTime = new Date(min + Math.random() * (max - min));
        const iso = randomTime.toISOString();
        return { id: plan.id, data: { scheduledAt: iso } };
      });
      await axios.put(`/api/flightPlans`, { items });
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan) => {
          const it = items.find((i) => i.id === plan.id);
          return it ? { ...plan, scheduledAt: (it.data as any).scheduledAt } : plan;
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

  // Handler to open uplan edit modal
  const handleOpenUplanEdit = useCallback((plan: FlightPlan) => {
    let uplanObj = plan.uplan;
    // Defensive: parse up to two times if needed (for double-encoded JSON)
    for (let i = 0; i < 2; i++) {
      if (typeof uplanObj === "string") {
        try {
          uplanObj = JSON.parse(uplanObj);
        } catch {
          break;
        }
      }
    }
    setUplanEditModal({ open: true, uplan: uplanObj || {}, planId: plan.id });
  }, []);

  // Handler to save uplan changes
  const handleSaveUplanEdit = async (newUplan: any) => {
    if (!uplanEditModal.planId) return;
    try {
      await axios.put(`/api/flightPlans`, { id: uplanEditModal.planId, data: { uplan: JSON.stringify(newUplan) } });
      setFlightPlans(flightPlans.map(plan =>
        plan.id === uplanEditModal.planId ? { ...plan, uplan: newUplan } : plan
      ));
      setUplanEditModal({ open: false, uplan: null, planId: null });
    } catch (error) {
      alert("Error saving U-plan info");
    }
  };

  return (
    <div className="bg-gray-900 p-6 pt-8 pb-2">
      {/* Help Button */}
      <a
        href="/how-it-works#trajectory-generator-help"
        target="_self"
        className="fixed top-24 right-8 z-[2000] bg-blue-700 hover:bg-blue-800 text-white rounded-full p-3 shadow-lg flex items-center gap-2 transition-all duration-200"
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
                                  className="border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 shrink-0 hover:border-gray-400 transition-colors h-5 w-5 min-w-[8px] min-h-[8px]"
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
                                {/* Uplan edit button */}
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    if (
                                      plan.authorizationStatus === undefined ||
                                      plan.authorizationStatus === null ||
                                      plan.authorizationStatus === "sin autorización"
                                    ) {
                                      handleOpenUplanEdit(plan);
                                    }
                                  }}
                                  disabled={
                                    !(
                                      plan.authorizationStatus === undefined ||
                                      plan.authorizationStatus === null ||
                                      plan.authorizationStatus === "sin autorización"
                                    )
                                  }
                                  className={`text-yellow-400 hover:bg-yellow-500/90 hover:text-white border-yellow-400/50 hover:border-yellow-500 ml-2 min-w-[120px] h-12 min-h-[48px] flex items-center justify-center ${
                                    plan.authorizationStatus !== undefined &&
                                    plan.authorizationStatus !== null &&
                                    plan.authorizationStatus !== "sin autorización"
                                      ? "opacity-60 cursor-not-allowed"
                                      : ""
                                  }`}
                                  title={
                                    plan.authorizationStatus !== undefined &&
                                    plan.authorizationStatus !== null &&
                                    plan.authorizationStatus !== "sin autorización"
                                      ? "U-plan can only be edited before authorization."
                                      : undefined
                                  }
                                >
                                  Edit U-plan
                                </Button>
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
                                      disabled={authorizationLoading[plan.id] || plan.status !== "procesado" || !plan.scheduledAt}
                                      className={`text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500 min-w-[153px] ml-2 flex items-center justify-center h-12 min-h-[48px]${
                                        (authorizationLoading[plan.id] || plan.status !== "procesado" || !plan.scheduledAt)
                                          ? " opacity-60 cursor-not-allowed"
                                          : ""
                                      }`}
                                      title={
                                        !plan.scheduledAt
                                          ? "You must select a date and hour to send it to the FAS."
                                          : (authorizationLoading[plan.id] || plan.status !== "procesado")
                                          ? undefined
                                          : undefined
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
      <MapModal
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
      {/* Uplan Edit Modal */}
      <UplanEditModal
        open={uplanEditModal.open}
        onClose={() => setUplanEditModal({ open: false, uplan: null, planId: null })}
        uplan={uplanEditModal.uplan}
        onSave={handleSaveUplanEdit}
      />
    </div>
  );
}

export default FlightPlansUploader;
