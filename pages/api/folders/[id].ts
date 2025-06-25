import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const folder = await prisma.folder.findUnique({
        where: { id: Number(id) },
        include: {
          flightPlans: true,
        },
      });

      if (!folder) {
        res.status(404).json({ error: "Carpeta no encontrada" });
        return;
      }

      res.json(folder);
    } catch (error) {
      res.status(500).json({
        error: "Error obteniendo la carpeta",
        details: (error as Error).message,
      });
    }
  } else if (req.method === "DELETE") {
    try {
      // Primero obtenemos todos los flight plans asociados a esta carpeta
      const folderPlans = await prisma.flightPlan.findMany({
        where: { folderId: Number(id) },
      });

      // Eliminamos los CSV results asociados a los flight plans
      await Promise.all(
        folderPlans.map(async (plan) => {
          if (plan.csvResult) {
            await prisma.csvResult.delete({
              where: { id: plan.csvResult },
            });
          }
        })
      );

      // Eliminamos los flight plans
      await prisma.flightPlan.deleteMany({
        where: { folderId: Number(id) },
      });

      // Finalmente eliminamos la carpeta
      await prisma.folder.delete({
        where: { id: Number(id) },
      });

      res.status(204).end();
    } catch (error) {
      res.status(500).json({
        error: "Error eliminando la carpeta",
        details: (error as Error).message,
      });
    }
  } else if (req.method === "PUT") {
    const { name, minScheduledAt, maxScheduledAt } = req.body;
    try {
      const updatedFolder = await prisma.folder.update({
        where: { id: Number(id) },
        data: { name, minScheduledAt, maxScheduledAt },
      });
      res.json(updatedFolder);
    } catch (error) {
      res.status(500).json({
        error: "Error actualizando la carpeta",
        details: (error as Error).message,
      });
    }
  } else {
    res.status(405).json({ error: "Método no permitido" });
  }
}
