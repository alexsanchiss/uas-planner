import Papa from "papaparse";
import { generateOrientedBBox, Waypoint, DEFAULT_UPLAN_CONFIG, UplanConfig } from "./generate_oriented_volumes";
import { generateRandomJSON } from "./generate_random_json";
import { generateJSON } from "./generate_json";

// Environment variable to control random data generation
// When true (default): generates complete U-Plan with random placeholder data
// When false: generates only operation volumes, user must fill other fields
const GENERATE_RANDOM_UPLAN_DATA = process.env.NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA !== 'false';

export interface TrayToUplanParams {
  scheduledAt: number; // POSIX timestamp (segundos)
  csv: string; // CSV string con columnas: time, lat, lon, h
  compressionFactor?: number; // Default: 20 (was 50 in old implementation)
  TSE_H?: number; // Default: 15.0m (was ~14.3m in old implementation)
  TSE_V?: number; // Default: 10.0m (was ~9.1m in old implementation)
  Alpha_H?: number; // Default: 7.0 (new: horizontal dominance threshold)
  Alpha_V?: number; // Default: 1.0 (new: vertical dominance threshold)
  tbuf?: number; // Default: 5.0s (time buffer)
  uplan?: any; // user-provided uplan details (optional)
  groundElevation?: number; // AMSL ground elevation (m) to subtract from trajectory altitudes for AGL normalization. Default: 0
}

// Helper functions for filling uplan fields
function randomFrom(arr: any[]): any { return arr[Math.floor(Math.random() * arr.length)]; }
function fillUplan(u: any): any {
  const accepted = {
    flightDetails: {
      mode: ["VLOS", "BVLOS"],
      category: ["OPENA1", "OPENA2", "OPENA3", 'SAIL_I-II', 'SAIL_III-IV', 'SAIL_V-VI', 'Certi_No_Pass', 'Certi_Pass'],
      specialOperation: [
        "POLICE_AND_CUSTOMS",
        "TRAFFIC_SURVEILLANCE_AND_PURSUIT",
        "ENVIRONMENTAL_CONTROL",
        "SEARCH_AND_RESCUE",
        "MEDICAL",
        "EVACUATIONS",
        "FIREFIGHTING",
        "STATE_OFFICIALS",
      ],
    },
    uas: {
      flightCharacteristics: {
        connectivity: ["RF", "LTE", "SAT", "5G"],
        idTechnology: ["NRID", "ADSB", "OTHER"],
      },
      generalCharacteristics: {
        uasType: ["NONE_NOT_DECLARED", "MULTIROTOR", "FIXED_WING"],
        uasClass: ["NONE", "C0", "C1", "C2", "C3", "C4", "C5", "C6"],
        uasDimension: ["LT_1", "LT_3", "LT_8", "GTE_8"],
      },
    },
  };
  const filled = { ...u };
  // Data owner/source
  if (!filled.dataOwnerIdentifier) filled.dataOwnerIdentifier = { sac: "AAA", sic: "BBB" };
  if (!filled.dataOwnerIdentifier.sac) filled.dataOwnerIdentifier.sac = "AAA";
  if (!filled.dataOwnerIdentifier.sic) filled.dataOwnerIdentifier.sic = "BBB";
  if (!filled.dataSourceIdentifier) filled.dataSourceIdentifier = { sac: "CCC", sic: "DDD" };
  if (!filled.dataSourceIdentifier.sac) filled.dataSourceIdentifier.sac = "CCC";
  if (!filled.dataSourceIdentifier.sic) filled.dataSourceIdentifier.sic = "DDD";
  // Contact
  if (!filled.contactDetails) filled.contactDetails = { firstName: "John", lastName: "Doe", phones: ["123456789"], emails: ["john@doe.com"] };
  if (!filled.contactDetails.firstName) filled.contactDetails.firstName = "John";
  if (!filled.contactDetails.lastName) filled.contactDetails.lastName = "Doe";
  if (!filled.contactDetails.phones || !Array.isArray(filled.contactDetails.phones) || !filled.contactDetails.phones[0]) filled.contactDetails.phones = ["123456789"];
  if (!filled.contactDetails.emails || !Array.isArray(filled.contactDetails.emails) || !filled.contactDetails.emails[0]) filled.contactDetails.emails = ["john@doe.com"];
  // Flight details
  if (!filled.flightDetails) filled.flightDetails = {};
  if (!filled.flightDetails.mode) filled.flightDetails.mode = randomFrom(accepted.flightDetails.mode);
  if (!filled.flightDetails.category) filled.flightDetails.category = randomFrom(accepted.flightDetails.category);
  if (!filled.flightDetails.specialOperation) filled.flightDetails.specialOperation = randomFrom(accepted.flightDetails.specialOperation);
  if (typeof filled.flightDetails.privateFlight !== "boolean") filled.flightDetails.privateFlight = false;
  // UAS
  if (!filled.uas) filled.uas = {};
  if (!filled.uas.registrationNumber) filled.uas.registrationNumber = "REG123";
  if (!filled.uas.serialNumber) filled.uas.serialNumber = "SERIAL123";
  if (!filled.uas.flightCharacteristics) filled.uas.flightCharacteristics = {};
  if (!filled.uas.flightCharacteristics.uasMTOM) filled.uas.flightCharacteristics.uasMTOM = "10";
  if (!filled.uas.flightCharacteristics.uasMaxSpeed) filled.uas.flightCharacteristics.uasMaxSpeed = "15";
  if (!filled.uas.flightCharacteristics.connectivity) filled.uas.flightCharacteristics.connectivity = randomFrom(accepted.uas.flightCharacteristics.connectivity);
  if (!filled.uas.flightCharacteristics.idTechnology) filled.uas.flightCharacteristics.idTechnology = randomFrom(accepted.uas.flightCharacteristics.idTechnology);
  if (!filled.uas.flightCharacteristics.maxFlightTime) filled.uas.flightCharacteristics.maxFlightTime = "30";
  if (!filled.uas.generalCharacteristics) filled.uas.generalCharacteristics = {};
  if (!filled.uas.generalCharacteristics.brand) filled.uas.generalCharacteristics.brand = "BrandX";
  if (!filled.uas.generalCharacteristics.model) filled.uas.generalCharacteristics.model = "ModelY";
  if (!filled.uas.generalCharacteristics.typeCertificate) filled.uas.generalCharacteristics.typeCertificate = "CERT123";
  if (!filled.uas.generalCharacteristics.uasType) filled.uas.generalCharacteristics.uasType = randomFrom(accepted.uas.generalCharacteristics.uasType);
  if (!filled.uas.generalCharacteristics.uasClass) filled.uas.generalCharacteristics.uasClass = randomFrom(accepted.uas.generalCharacteristics.uasClass);
  if (!filled.uas.generalCharacteristics.uasDimension) filled.uas.generalCharacteristics.uasDimension = randomFrom(accepted.uas.generalCharacteristics.uasDimension);
  if (!filled.operatorId) filled.operatorId = "OPID123";
  return filled;
}

export function trayToUplan({
  scheduledAt,
  csv,
  compressionFactor = DEFAULT_UPLAN_CONFIG.compressionFactor, // 20 (was 50)
  TSE_H = DEFAULT_UPLAN_CONFIG.TSE_H, // 15.0m (was ~14.3m)
  TSE_V = DEFAULT_UPLAN_CONFIG.TSE_V, // 10.0m (was ~9.1m)
  Alpha_H = DEFAULT_UPLAN_CONFIG.Alpha_H, // 7.0 (new parameter)
  Alpha_V = DEFAULT_UPLAN_CONFIG.Alpha_V, // 1.0 (new parameter)
  tbuf = DEFAULT_UPLAN_CONFIG.tbuf, // 5.0s
  uplan,
  groundElevation = 0,
}: TrayToUplanParams) {
  // Parse CSV
  const { data } = Papa.parse(csv, { header: true, dynamicTyping: true });
  // Filtra y mapea a waypoints válidos
  // Subtract groundElevation (AMSL) from altitude so all values become AGL
  const rawWaypoints: Waypoint[] = (data as unknown as {
    SimTime: string;
    Lat: string;
    Lon: string;
    Alt: string;
  }[])
    .filter(
      (row) =>
        row.SimTime !== undefined &&
        row.Lat !== undefined &&
        row.Lon !== undefined &&
        row.Alt !== undefined
    )
    .map((row) => ({
      time: Number(row.SimTime),
      lat: Number(row.Lat),
      lon: Number(row.Lon),
      h: Number(row.Alt) - groundElevation,
    }));
  
  // Normalize times to start at 0 - subtract the initial time offset
  // This ensures volumes start at scheduledAt + 0s instead of scheduledAt + 80s
  const initialTime = rawWaypoints.length > 0 ? rawWaypoints[0].time : 0;
  const waypoints: Waypoint[] = rawWaypoints.map(wp => ({
    ...wp,
    time: wp.time - initialTime,
  }));
  
  // Compresión - keep every Nth waypoint (start from index 0 for new algorithm)
  const wpReduced = waypoints.filter((_, i) => i % compressionFactor === 0);
  
  // Build config for oriented volume generation
  const volumeConfig: UplanConfig = {
    TSE_H,
    TSE_V,
    Alpha_H,
    Alpha_V,
    tbuf,
    compressionFactor,
  };
  
  // Generate oriented volumes (replaces axis-aligned bbox)
  const bbox = generateOrientedBBox(scheduledAt, wpReduced, volumeConfig);
  // Generar JSON final
  if (uplan && typeof uplan === "object") {
    // If GENERATE_RANDOM_UPLAN_DATA is enabled, fill missing fields with random data
    // Otherwise, only use the provided uplan data (user must fill fields manually)
    const processedUplan = GENERATE_RANDOM_UPLAN_DATA ? fillUplan(uplan) : uplan;
    return generateJSON(bbox, wpReduced, processedUplan);
  }
  // No uplan provided - generate with random data if enabled, otherwise empty structure
  if (GENERATE_RANDOM_UPLAN_DATA) {
    return generateRandomJSON(bbox, wpReduced);
  }
  // Generate with empty uplan fields - user must fill through form
  return generateJSON(bbox, wpReduced, {});
}
