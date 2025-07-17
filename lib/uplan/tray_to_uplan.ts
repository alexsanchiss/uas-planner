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
  const waypoints: Waypoint[] = (data as any[])
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
    return generateJSON(bbox, wpReduced, uplan);
  }
  return generateRandomJSON(bbox, wpReduced);
}
