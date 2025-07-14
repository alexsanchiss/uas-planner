import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { externalResponseNumber } = req.query;

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
      where: { externalResponseNumber: externalResponseNumber },
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
