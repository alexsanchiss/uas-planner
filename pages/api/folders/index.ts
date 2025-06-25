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
      const folders = await prisma.folder.findMany({
        where: { userId: Number(userId) },
        include: {
          flightPlans: true,
        },
      });
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ error: "Error fetching folders" });
    }
  } else if (req.method === "POST") {
    const { name, userId, minScheduledAt, maxScheduledAt } = req.body;

    if (!name || !userId) {
      return res.status(400).json({ error: "Name and user ID are required" });
    }

    try {
      const newFolder = await prisma.folder.create({
        data: {
          name,
          userId,
          minScheduledAt,
          maxScheduledAt,
        },
      });
      res.status(201).json(newFolder);
    } catch (error) {
      console.error("Error creating folder:", error);
      res.status(500).json({ error: "Error creating folder" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
