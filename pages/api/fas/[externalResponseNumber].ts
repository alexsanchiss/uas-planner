// pages/api/fas/[externalResponseNumber].ts
//
// ⚠️  DEPRECATED - DO NOT USE FOR NEW DEVELOPMENT
// ================================================
// This Pages Router API has been migrated to App Router.
// Use the App Router endpoint instead: app/api/fas/[externalResponseNumber]/route.ts
//
// Migration date: 2026-01-13
// Removal planned: After thorough testing of App Router endpoints
//
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { externalResponseNumber } = req.query;
  // Asegura que sea string
  const extRespNum = Array.isArray(externalResponseNumber) ? externalResponseNumber[0] : externalResponseNumber;

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { state, message } = req.body;
    if (!state) {
      return res.status(400).json({ error: "Faltan datos en el body" });
    }

    // Buscar el flightplan por externalResponseNumber
    const flightPlan = await prisma.flightPlan.findFirst({
      where: { externalResponseNumber: extRespNum },
    });

    if (!flightPlan) {
      return res.status(404).json({ error: "FlightPlan no encontrado" });
    }

    // Actualizar estado y mensaje
    await prisma.flightPlan.update({
      where: { id: flightPlan.id },
      data: {
        authorizationStatus: state === "ACCEPTED" ? "aprobado" : "denegado",
        authorizationMessage: message,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error en FAS PUT:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
