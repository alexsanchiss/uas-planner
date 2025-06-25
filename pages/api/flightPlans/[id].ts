// pages/api/flightPlans/[id].ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const flightPlan = await prisma.flightPlan.findUnique({
        where: { id: Number(id) },
        include: {
          folder: true,
        },
      });

      if (!flightPlan) {
        res.status(404).json({ error: "Plan de vuelo no encontrado" });
        return;
      }

      res.json(flightPlan);
    } catch (error) {
      res.status(500).json({
        error: "Error obteniendo el plan de vuelo",
        details: (error as Error).message,
      });
    }
  } else if (req.method === "DELETE") {
    try {
      // Da 500 si no hay csvresult, pero elimina correctamente. Comprobar si existe un csvresult con ese ID consume mucho tiempo
      await prisma.flightPlan.delete({
        where: { id: Number(id) },
      });
      await prisma.csvResult.delete({
        where: { id: Number(id) },
      });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({
        error: "Error eliminando el plan de vuelo",
        details: (error as Error).message,
      });
    }
  } else if (req.method === "PUT") {
    const {
      customName,
      status,
      csvResult,
      machineAssignedId,
      authorizationStatus,
      authorizationMessage,
      uplan,
      scheduledAt,
    } = req.body;
    try {
      const updatedPlan = await prisma.flightPlan.update({
        where: { id: Number(id) },
        data: {
          customName,
          status,
          csvResult,
          machineAssignedId,
          authorizationStatus,
          authorizationMessage,
          uplan,
          scheduledAt,
        },
      });
      res.json(updatedPlan);
    } catch (error) {
      res.status(500).json({
        error: "Error actualizando el plan de vuelo",
        details: (error as Error).message,
      });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};
