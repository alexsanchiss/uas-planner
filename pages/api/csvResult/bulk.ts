import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

// Bulk fetch CSV results for many plans
// Body: { ids: number[] }
// Response: { items: { id: number, customName: string, csvResult: string }[] }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids[] is required" });
  }

  const MAX_IDS = 5000;
  const targetIds = ids
    .slice(0, MAX_IDS)
    .map((x: any) => Number(x))
    .filter((x: any) => Number.isFinite(x));

  if (targetIds.length === 0) {
    return res.status(400).json({ error: "No valid ids provided" });
  }

  try {
    const [plans, csvs] = await Promise.all([
      prisma.flightPlan.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, customName: true },
      }),
      prisma.csvResult.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, csvResult: true },
      }),
    ]);

    const nameById = new Map<number, string>(plans.map((p) => [p.id, p.customName]));
    const items = csvs
      .map((c) => ({ id: c.id, customName: nameById.get(c.id) || `plan_${c.id}`, csvResult: c.csvResult as unknown as string }))
      .filter((it) => typeof it.csvResult === 'string');

    return res.status(200).json({ items });
  } catch (error) {
    console.error("Error bulk fetching CSV results:", error);
    return res.status(500).json({ error: "Error fetching CSV results" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};


