// pages/api/flightPlans/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      const flightPlans = await prisma.flightPlan.findMany({
        where: { userId: Number(userId) },
        include: {
          folder: true,
        },
      });
      res.json(flightPlans);
    } catch (error) {
      console.error("Error fetching flight plans:", error);
      res.status(500).json({ error: "Error fetching flight plans" });
    }
  } else if (req.method === "POST") {
    const {
      customName,
      status,
      fileContent,
      userId,
      folderId,
      uplan,
      scheduledAt,
    } = req.body;

    if (!customName || !status || !fileContent || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const newPlan = await prisma.flightPlan.create({
        data: {
          customName,
          status,
          fileContent,
          userId,
          folderId: folderId || null,
          uplan: uplan || null,
          scheduledAt: scheduledAt || null,
        },
      });
      res.status(201).json(newPlan);
    } catch (error) {
      console.error("Error creating flight plan:", error);
      res.status(500).json({ error: "Error creating flight plan" });
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
