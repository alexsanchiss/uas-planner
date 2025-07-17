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
    // 2. Obtener el csvResult
    const csvResult = await prisma.csvResult.findUnique({
      where: { id: Number(id) },
    });
    if (!csvResult) {
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
