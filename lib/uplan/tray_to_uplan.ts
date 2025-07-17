import Papa from "papaparse";
import { generate_bbox, Waypoint } from "./generate_bbox";
import { generateRandomJSON } from "./generate_random_json";
import { generateJSON } from "./generate_json";

export interface TrayToUplanParams {
  scheduledAt: number; // POSIX timestamp (segundos)
  csv: string; // CSV string con columnas: time, lat, lon, h
  compressionFactor?: number;
  TSE_H?: number;
  TSE_V?: number;
  Alpha?: number;
  tbuf?: number;
  uplan?: any; // user-provided uplan details (optional)
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
  compressionFactor = 50,
  TSE_H = 2 * Math.sqrt(0.75 ** 2 + 1 ** 2 + 7.05 ** 2), //TSE_H = 2*sqrt(PDE_H^2+NSE_H^2+FTE_H^2);
  TSE_V = 2 * Math.sqrt(4 ** 2 + 1.5 ** 2 + 1.45 ** 2), //TSE_V = 2*sqrt(PDE_V^2+NSE_V^2+FTE_V^2);
  Alpha = 1,
  tbuf = 5,
  uplan,
}: TrayToUplanParams) {
  // Parse CSV
  const { data } = Papa.parse(csv, { header: true, dynamicTyping: true });
  // Filtra y mapea a waypoints válidos
  const waypoints: Waypoint[] = (data as unknown as {
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
      h: Number(row.Alt),
    }));
  // Compresión
  const wpReduced = waypoints.filter((_, i) => i % compressionFactor === 1);
  // Generar BBOX
  const bbox = generate_bbox(scheduledAt, wpReduced, TSE_H, TSE_V, Alpha, tbuf);
  // Generar JSON final
  if (uplan && typeof uplan === "object") {
    const filledUplan = fillUplan(uplan);
    return generateJSON(bbox, wpReduced, filledUplan);
  }
  return generateRandomJSON(bbox, wpReduced);
}
