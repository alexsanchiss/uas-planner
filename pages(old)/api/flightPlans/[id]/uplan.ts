// pages/api/flightPlans/[id]/uplan.ts
//
// ⚠️  DEPRECATED - DO NOT USE FOR NEW DEVELOPMENT
// ================================================
// This Pages Router API has been migrated to App Router.
// Use the App Router endpoint instead: app/api/flightPlans/[id]/uplan/route.ts
//
// Migration date: 2026-01-13
// Removal planned: After thorough testing of App Router endpoints
//
// U-PLAN GENERATION ENDPOINT - Specialized Business Logic
// =======================================================
//
// This endpoint is kept separate from the unified API because it handles
// specific business logic that doesn't fit the standard CRUD pattern.
//
// PURPOSE:
// - Generates U-Plan format from CSV trajectory data
// - Sends U-Plan to external authorization API
// - Updates flight plan with authorization status
// - Handles complex external API communication
//
// WHY NOT IN UNIFIED API:
// - Complex business logic beyond simple CRUD
// - External API integration with specific error handling
// - State machine for authorization workflow
// - Doesn't fit bulk operation patterns
//
// USAGE:
// POST /api/flightPlans/{id}/uplan
// 
// PREREQUISITES:
// - Flight plan must exist and have scheduledAt
// - CSV result must exist for the plan
// - Plan must not already have authorization status
//
// WORKFLOW:
// 1. Validate flight plan and CSV existence
// 2. Generate U-Plan from CSV trajectory
// 3. Send to external authorization API
// 4. Update local status based on response
// 5. Return authorization result
//
// RESPONSE FORMATS:
// Success: { message: "U-Plan generated and sent" }
// Denied: { error: "denegado", message: "reason" }
// Error: { error: "error_message" }
//
// EXTERNAL API:
// - Endpoint: http://158.42.167.56:8000/uplan
// - Method: POST
// - Content-Type: application/json
// - Payload: Generated U-Plan object
//
// AUTHORIZATION STATES:
// - "FAS procesando..." - Initial processing
// - "denegado" - Authorization denied
// - "aprobado" - Authorization approved (default on success)
//
// ERROR HANDLING:
// - Network errors are logged and stored
// - External API errors update authorization status
// - Invalid data returns appropriate HTTP status codes

import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../../lib/prisma";
import { trayToUplan } from "../../../../lib/uplan/tray_to_uplan";
import axios from "axios";

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
    // 1. Obtener el flightplan
    const flightPlan = await prisma.flightPlan.findUnique({
      where: { id: Number(id) },
    });
    if (!flightPlan) {
      return res.status(404).json({ error: "Plan de vuelo no encontrado" });
    }
    if (!flightPlan.scheduledAt) {
      return res
        .status(400)
        .json({ error: "Faltan datos necesarios (scheduledAt)" });
    }
    if (!flightPlan.csvResult) {
      return res
        .status(400)
        .json({ error: "No CSV result associated with this flight plan" });
    }
    // 2. Obtener el csvResult (relación 1:1 por mismo ID)
    // Nota: flightPlan.csvResult es solo un booleano, no un ID
    // La tabla csvResult usa el mismo ID que flightPlan (flightPlan.id = csvResult.id)
    const csvResult = await prisma.csvResult.findUnique({
      where: { id: Number(id) },
    });
    if (!csvResult || !csvResult.csvResult) {
      return res.status(404).json({ error: "CSV no encontrado" });
    }
    // 3. Generar el U-Plan
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
    console.log("Plan procesado");
    // 4. Enviar el U-Plan a la API externa
    let externalResponseNumber = String(null);
    try {
      const response = await axios.post(
        "http://158.42.167.56:8000/uplan",
        uplan,
        { headers: { "Content-Type": "application/json" } }
      );
      externalResponseNumber =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      // Guardar como aprobado (por defecto, si no hay error)
      await prisma.flightPlan.update({
        where: { id: Number(id) },
        data: {
          uplan,
          authorizationMessage: "FAS procesando...",
          externalResponseNumber: externalResponseNumber,
        },
      });
    } catch (err: any) {
      console.error("Error enviando U-Plan a la API externa:", err);
      // Si es un error de Axios con respuesta, guardar como denegado y el mensaje
      if (err.response && err.response.data) {
        await prisma.flightPlan.update({
          where: { id: Number(id) },
          data: {
            uplan,
            authorizationStatus: "denegado",
            authorizationMessage: err.response.data,
            externalResponseNumber: `error: ${err.message}`,
          },
        });
        return res
          .status(400)
          .json({ error: "denegado", message: err.response.data });
      } else {
        await prisma.flightPlan.update({
          where: { id: Number(id) },
          data: {
            uplan,
            authorizationStatus: "denegado",
            authorizationMessage: JSON.parse(JSON.stringify(err)),
            externalResponseNumber:
              err instanceof Error
                ? `error: ${err.message}`
                : "Unknown error (check authorizationMessage)",
          },
        });
        return res.status(500).json({
          error: "denegado",
          message: err instanceof Error ? err.message : err,
        });
      }
    }
    return res
      .status(200)
      .json({ uplan, authorizationMessage: externalResponseNumber });
  } catch (error) {
    console.error("Error generando U-Plan:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
