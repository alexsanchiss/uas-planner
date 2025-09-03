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
    // Unified create: supports single or bulk
    const body = req.body || {};

    const toRecord = (p: any) => ({
      customName: p.customName,
      status: p.status,
      fileContent: p.fileContent,
      userId: Number(p.userId),
      folderId: p.folderId || null,
      uplan: p.uplan || null,
      scheduledAt: p.scheduledAt || null,
    });

    try {
      if (Array.isArray(body.items) && body.items.length > 0) {
        const data = body.items.map(toRecord);
        await prisma.flightPlan.createMany({ data });
        // Return last N created for convenience
        const created = await prisma.flightPlan.findMany({
          where: { userId: Number(body.items[0].userId), folderId: body.items[0].folderId || null },
          orderBy: { id: 'desc' },
          take: data.length,
        });
        return res.status(201).json({ createdCount: data.length, items: created });
      }

      const { customName, status, fileContent, userId, folderId, uplan, scheduledAt } = body;
      if (!customName || !status || !fileContent || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      await prisma.flightPlan.createMany({
        data: [toRecord({ customName, status, fileContent, userId, folderId, uplan, scheduledAt })],
      });
      const newPlan = await prisma.flightPlan.findFirst({
        where: { customName, userId: Number(userId), folderId: folderId || null },
        orderBy: { id: 'desc' }
      });
      return res.status(201).json(newPlan);
    } catch (error) {
      console.error("Error creating flight plan:", error);
      return res.status(500).json({ error: "Error creating flight plan" });
    }
  } else if (req.method === "PUT") {
    // Unified update: supports { id, data }, { ids, data }, or { items: [{id,data}]}.
    const { id, ids, data, items } = req.body || {};

    const sanitizeData = (d: any) => {
      const out: Record<string, any> = {};
      if (!d || typeof d !== 'object') return out;
      if (typeof d.customName === 'string') out.customName = d.customName;
      if (typeof d.status === 'string') out.status = d.status;
      if (typeof d.fileContent === 'string') out.fileContent = d.fileContent;
      if (typeof d.authorizationStatus === 'string') out.authorizationStatus = d.authorizationStatus;
      if (typeof d.authorizationMessage === 'string' || typeof d.authorizationMessage === 'object' || d.authorizationMessage === null) out.authorizationMessage = d.authorizationMessage;
      if (typeof d.uplan === 'string' || typeof d.uplan === 'object' || d.uplan === null) out.uplan = d.uplan;
      if (typeof d.scheduledAt === 'string' || d.scheduledAt === null) out.scheduledAt = d.scheduledAt;
      if (typeof d.csvResult === 'number' || d.csvResult === null) out.csvResult = d.csvResult;
      if (typeof d.machineAssignedId === 'number' || d.machineAssignedId === null) out.machineAssignedId = d.machineAssignedId;
      if (typeof d.folderId === 'number' || d.folderId === null) out.folderId = d.folderId;
      return out;
    };

    try {
      if (Array.isArray(items) && items.length > 0) {
        // Per-item updates in transaction
        const MAX = 2000;
        const slice = items.slice(0, MAX).filter((it: any) => it && Number.isFinite(Number(it.id)));
        const CHUNK = 200;
        let total = 0;
        for (let i = 0; i < slice.length; i += CHUNK) {
          const chunk = slice.slice(i, i + CHUNK);
          const ops = chunk.map((it: any) => {
            const d = sanitizeData(it.data);
            if (Object.keys(d).length === 0) return null;
            return prisma.flightPlan.update({ where: { id: Number(it.id) }, data: d });
          }).filter(Boolean) as any[];
          const results = await prisma.$transaction(ops);
          total += results.length;
        }
        return res.status(200).json({ count: total });
      }

      if (Array.isArray(ids) && ids.length > 0) {
        const MAX_IDS = 5000;
        const targetIds = ids.slice(0, MAX_IDS).map((x: any) => Number(x)).filter((x: any) => Number.isFinite(x));
        if (targetIds.length === 0) return res.status(400).json({ error: "No valid ids provided" });
        const updateData = sanitizeData(data);
        if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No supported fields in data" });
        const result = await prisma.flightPlan.updateMany({ where: { id: { in: targetIds } }, data: updateData });
        return res.status(200).json({ count: result.count });
      }

      if (Number.isFinite(Number(id))) {
        const updateData = sanitizeData(data || req.body);
        if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "No supported fields in data" });
        const result = await prisma.flightPlan.updateMany({ where: { id: Number(id) }, data: updateData });
        if (result.count === 0) return res.status(404).json({ error: "Flight plan not found" });
        const updated = await prisma.flightPlan.findUnique({ where: { id: Number(id) } });
        return res.status(200).json(updated);
      }

      return res.status(400).json({ error: "Provide {id,data} or {ids,data} or {items}" });
    } catch (error) {
      console.error("Error updating flight plans:", error);
      return res.status(500).json({ error: "Error updating flight plans" });
    }
  } else if (req.method === "DELETE") {
    // Unified bulk delete via index route
    const { id, ids } = req.body || {};

    const collectIds = () => {
      if (Array.isArray(ids)) return ids;
      if (Number.isFinite(Number(id))) return [Number(id)];
      return [] as number[];
    };

    const rawIds = collectIds();
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: "ids[] or id is required" });
    }
    const MAX_IDS = 5000;
    const targetIds = rawIds
      .slice(0, MAX_IDS)
      .map((x: any) => Number(x))
      .filter((x: any) => Number.isFinite(x));
    if (targetIds.length === 0) {
      return res.status(400).json({ error: "No valid ids provided" });
    }

    try {
      // Identify related CSVs if modeled separately
      const plansWithCsv = await prisma.flightPlan.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, csvResult: true },
      });
      const csvIds = plansWithCsv
        .map((p) => p.csvResult)
        .filter((csvId): csvId is number => csvId !== null && Number.isFinite(csvId));

      const txOps = [
        csvIds.length > 0 ? prisma.csvResult.deleteMany({ where: { id: { in: csvIds } } }) : null,
        prisma.flightPlan.deleteMany({ where: { id: { in: targetIds } } }),
      ].filter(Boolean) as any[];

      const result = await prisma.$transaction(txOps);
      const deletedPlans = result[result.length - 1]?.count || 0;
      const deletedCsvs = csvIds.length > 0 ? (result[0]?.count || 0) : 0;
      return res.status(200).json({ deletedPlans, deletedCsvs, totalDeleted: deletedPlans + deletedCsvs });
    } catch (error) {
      console.error("Error deleting flight plans:", error);
      return res.status(500).json({ error: "Error deleting flight plans" });
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
