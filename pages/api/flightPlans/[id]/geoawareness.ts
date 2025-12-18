// pages/api/flightPlans/[id]/geoawareness.ts
//
// GEOAWARENESS CHECK ENDPOINT
// ===========================
//
// This endpoint checks for geozone conflicts before sending a flight plan to FAS.
// It queries the geoawareness service with the U-Plan operation volumes and returns
// any intersecting geozones for user review.
//
// USAGE:
// POST /api/flightPlans/{id}/geoawareness
//
// WORKFLOW:
// 1. Validate flight plan and CSV existence
// 2. Generate U-Plan from CSV trajectory
// 3. Send to geoawareness service
// 4. If service unavailable, return mock response
// 5. Return geozones + trajectory data for map visualization
//
// RESPONSE FORMAT:
// {
//   geozones: GeoJSON FeatureCollection,
//   trajectory: [[lat, lon], ...],
//   uplan: generated U-Plan object,
//   hasConflicts: boolean
// }

import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../../lib/prisma";
import { trayToUplan } from "../../../../lib/uplan/tray_to_uplan";
import axios from "axios";

// Mock response when geoawareness service is unavailable
const MOCK_GEOAWARENESS_RESPONSE = {
  bbox: [-0.3178864800022792, 39.419915453549059, -0.3178864800022792, 39.462786471496045],
  name: "prototipo_v1",
  type: "FeatureCollection",
  features: [
    {
      id: 2,
      type: "Feature",
      geometry: {
        bbox: [-0.3178864800022792, 39.419915453549059, -0.3178864800022792, 39.462786471496045],
        type: "Polygon",
        coordinates: [
          [
            [-0.3178864800022792, 39.419915453549059],
            [-0.31254964157412274, 39.423234585913811],
            [-0.30910652000757005, 39.4297396268423],
            [-0.30273674510944776, 39.433323777667155],
            [-0.29154660001815186, 39.443544232147389],
            [-0.28603760551166768, 39.454559406201646],
            [-0.30876220785091479, 39.462653784609842],
            [-0.31995235294221075, 39.462786471496045],
            [-0.32993740548521328, 39.461592280413456],
            [-0.33303621489511059, 39.460265377401221],
            [-0.33028171764186853, 39.45548831710655],
            [-0.32821584470193693, 39.454559406201646],
            [-0.32873231293691979, 39.450976348035709],
            [-0.32632212784033304, 39.449649242660549],
            [-0.32580565960535018, 39.444075123873482],
            [-0.32752722038862642, 39.442216985126954],
            [-0.33131465411183431, 39.441818806088655],
            [-0.33406915136507637, 39.438633291833618],
            [-0.33837305332326711, 39.4383678257363],
            [-0.34181617488981969, 39.428943123843091],
            [-0.3178864800022792, 39.419915453549059]
          ]
        ],
        verticalReference: {
          uom: "m",
          lower: 16.248912811279297,
          upper: 216.2489128112793,
          lowerReference: "AMSL",
          upperReference: "AMSL"
        }
      },
      properties: {
        identifier: "ESVC-2",
        country: "ESP",
        name: "Geozona Puerto Valencia/Valencia Port geozone",
        type: "CONDITIONAL",
        variant: "COMMON",
        restrictionConditions: {
          uasClass: ["LEGACY", "C0", "C1", "C2", "C3", "C4", "C5", "C6"],
          authorized: "REQUIRES_AUTHORIZATION",
          uasCategory: ["OPEN", "SPECIFIC", "CERTIFIED"],
          uasOperationMode: ["VLOS", "BVLOS"],
          maxNoise: 65,
          specialoperation: "REQUIRES_AUTHORIZATION",
          photograph: "PROHIBITED"
        },
        region: "Valencian-Community",
        reasons: ["SENSITIVE", "PRIVACY", "EMERGENCY"],
        otherReasonInfo: [],
        regulationExemption: "NO",
        message: "null",
        zoneAuthority: {
          name: "Autoridad Portuaria de Valencia",
          service: "Servicio de Atención (SAC)",
          contact: {
            contactName: "",
            contactRole: ""
          },
          siteURL: "https://www.valenciaport.com/servicio-de-atencion-sac/",
          email: "",
          phone: "+34 963939555",
          purpose: "AUTHORIZATION",
          intervalBefore: "P1DT0H0M"
        },
        limitedApplicability: {
          startDateTime: "2025-07-02T00:00:00.00",
          endDateTime: "2026-07-02T23:59:59.00",
          schedule: {
            day: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            startTime: "00:00A",
            startEvent: "null",
            endTime: "23:59A",
            endEvent: "null"
          }
        }
      }
    }
  ],
  metadata: [
    {
      ValidFrom: "2025-07-02T16:47:00.00",
      ValidTo: "2026-07-02T16:47:00.00",
      issued: "02-Jul-2025 16:51:49",
      provider: "Grupo de Sistemas de Navegación Aérea (SNA) - UPV",
      description: "Geo-zone defined over the Port of Valencia to manage operations taking place within this area and to prevent unauthorized drone interference.",
      otherGeoid: "EGM96"
    }
  ]
};

// Empty response for no conflicts
const EMPTY_GEOAWARENESS_RESPONSE = {
  bbox: null,
  name: "no_conflicts",
  type: "FeatureCollection",
  features: [],
  metadata: []
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "ID no válido" });
  }

  try {
    // 1. Get flight plan
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id: Number(id) },
    });

    if (!flightPlan) {
      return res.status(404).json({ error: "Plan de vuelo no encontrado" });
    }

    if (!flightPlan.scheduledAt) {
      return res.status(400).json({ error: "Faltan datos necesarios (scheduledAt)" });
    }

    // 2. Get CSV result
    const csvResult = await prisma.csvResult.findUnique({
      where: { id: Number(id) },
    });

    if (!csvResult) {
      return res.status(404).json({ error: "CSV no encontrado" });
    }

    // 3. Generate U-Plan
    const scheduledAtPosix = Math.floor(
      new Date(flightPlan.scheduledAt).getTime() / 1000
    );

    let uplanDetails: unknown;
    if (typeof flightPlan.uplan === 'string') {
      try {
        uplanDetails = JSON.parse(flightPlan.uplan);
      } catch (e) {
        uplanDetails = undefined;
      }
    }

    const uplan = trayToUplan({
      scheduledAt: scheduledAtPosix,
      csv: csvResult.csvResult,
      ...(uplanDetails ? { uplan: uplanDetails } : {}),
    });

    // 4. Parse trajectory from CSV for map visualization
    const csvLines = csvResult.csvResult.split('\n');
    const trajectory: [number, number][] = [];
    
    // Skip header and parse coordinates
    for (let i = 1; i < csvLines.length; i++) {
      const line = csvLines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      // Assuming CSV format: SimTime,Lat,Lon,Alt,...
      if (parts.length >= 3) {
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
          trajectory.push([lat, lon]);
        }
      }
    }

    // 5. Call geoawareness service
    const geoawarenessServiceIp = process.env.GEOAWARENESS_SERVICE_IP;
    let geozonesResponse: any;
    let serviceAvailable = false;

    if (geoawarenessServiceIp) {
      try {
        const response = await axios.post(
          `http://${geoawarenessServiceIp}/geozones_searcher_by_volumes`,
          uplan,
          { 
            headers: { "Content-Type": "application/json" },
            timeout: 10000 // 10 second timeout
          }
        );
        geozonesResponse = response.data;
        serviceAvailable = true;
      } catch (err: any) {
        console.warn("Geoawareness service unavailable, using mock response:", err.message);
        // Use mock response when service is unavailable
        geozonesResponse = MOCK_GEOAWARENESS_RESPONSE;
      }
    } else {
      console.warn("GEOAWARENESS_SERVICE_IP not configured, using mock response");
      geozonesResponse = MOCK_GEOAWARENESS_RESPONSE;
    }

    // 6. Determine if there are conflicts
    const hasConflicts = geozonesResponse.features && geozonesResponse.features.length > 0;

    return res.status(200).json({
      geozones: geozonesResponse,
      trajectory,
      uplan,
      hasConflicts,
      serviceAvailable,
      planName: flightPlan.customName
    });

  } catch (error) {
    console.error("Error checking geoawareness:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
