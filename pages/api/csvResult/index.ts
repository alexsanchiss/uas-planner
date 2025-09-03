// pages/api/csvResult/index.ts
//
// UNIFIED CSV RESULT API - Optimized for Large Datasets
// ====================================================
//
// This API consolidates all CSV result operations (fetch, bulk fetch, delete)
// into a single endpoint, supporting both individual and bulk operations.
//
// BENEFITS:
// - Single endpoint for all CSV operations = better performance
// - Bulk operations for large datasets = reduced network overhead
// - Automatic plan name resolution = better user experience
// - Unified error handling = better maintainability
//
// USAGE EXAMPLES:
// ===============
//
// 1. FETCH INDIVIDUAL CSV
// ------------------------
// GET /api/csvResult?id=123
// Response: { csvResult: "csv_content_here" }
//
// 2. BULK FETCH CSV RESULTS
// --------------------------
// POST /api/csvResult
// Body: { ids: [123, 456, 789] }
// Response: { 
//   items: [
//     { id: 123, customName: "Plan A", csvResult: "csv_content_a" },
//     { id: 456, customName: "Plan B", csvResult: "csv_content_b" }
//   ]
// }
//
// 3. DELETE CSV RESULTS
// ---------------------
// Individual: DELETE /api/csvResult
// Body: { id: 123 }
// Response: 204 No Content
//
// Bulk: DELETE /api/csvResult
// Body: { ids: [123, 456, 789] }
// Response: { deletedCount: 3 }
//
// PERFORMANCE NOTES:
// - Bulk operations are limited to 5000 IDs per request
// - CSV content is fetched in parallel with plan metadata
// - Automatic filtering of invalid CSV results
// - Optimized for large download operations
//
// ERROR HANDLING:
// - Invalid IDs are filtered out automatically
// - Missing required fields return 400 with clear error messages
// - Database errors are logged and return 500
// - Graceful handling of missing CSV results
//
// SECURITY:
// - Input sanitization and type checking
// - Maximum limits to prevent abuse (5000 IDs per request)
// - No direct file system access

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    // Support both query params and body for flexibility
    const { id, ids } = req.query;
    
    if (id && typeof id === 'string') {
      // INDIVIDUAL CSV FETCH: Get single CSV result by ID
      try {
        const csvResult = await prisma.csvResult.findUnique({
          where: { id: parseInt(id, 10) },
        });
        if (csvResult) {
          return res.status(200).json({ csvResult: csvResult.csvResult });
        } else {
          return res.status(404).json({ error: 'CSV no encontrado' });
        }
      } catch (error) {
        console.error('Error fetching individual CSV:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
    
    return res.status(400).json({ error: 'ID parameter required for GET' });
  }
  
  if (req.method === "POST") {
    // BULK CSV FETCH: Get multiple CSV results with plan names
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
      // PARALLEL FETCH: Get plan metadata and CSV content simultaneously
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

      // MERGE DATA: Combine plan names with CSV content
      const nameById = new Map<number, string>(plans.map((p) => [p.id, p.customName]));
      const items = csvs
        .map((c) => ({ 
          id: c.id, 
          customName: nameById.get(c.id) || `plan_${c.id}`, 
          csvResult: c.csvResult as unknown as string 
        }))
        .filter((it) => typeof it.csvResult === 'string');

      return res.status(200).json({ items });
    } catch (error) {
      console.error("Error bulk fetching CSV results:", error);
      return res.status(500).json({ error: "Error fetching CSV results" });
    }
  }
  
  if (req.method === "DELETE") {
    // Support both individual and bulk deletion
    const { id, ids } = req.body || {};
    
    if (id && Number.isFinite(Number(id))) {
      // INDIVIDUAL CSV DELETION: Remove single CSV result
      try {
        await prisma.csvResult.delete({
          where: { id: Number(id) },
        });
        return res.status(204).end();
      } catch (error) {
        console.error('Error deleting individual CSV:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
    
    if (Array.isArray(ids) && ids.length > 0) {
      // BULK CSV DELETION: Remove multiple CSV results
      const MAX_IDS = 5000;
      const targetIds = ids
        .slice(0, MAX_IDS)
        .map((x: any) => Number(x))
        .filter((x: any) => Number.isFinite(x));
      
      if (targetIds.length === 0) {
        return res.status(400).json({ error: "No valid ids provided" });
      }
      
      try {
        const result = await prisma.csvResult.deleteMany({
          where: { id: { in: targetIds } },
        });
        return res.status(200).json({ deletedCount: result.count });
      } catch (error) {
        console.error('Error bulk deleting CSV results:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
    
    return res.status(400).json({ error: 'id or ids[] required for DELETE' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
