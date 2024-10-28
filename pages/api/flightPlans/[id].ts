// pages/api/flightPlans/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      // Obtener el plan de vuelo por ID
      const flightPlan = await prisma.flightPlan.findUnique({
        where: { id: Number(id) },
      });

      if (!flightPlan) {
        res.status(404).json({ error: 'Plan de vuelo no encontrado' });
        return;
      }

      res.json(flightPlan);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo el plan de vuelo' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await prisma.flightPlan.delete({
        where: { id: Number(id) },
      });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: 'Error eliminando el plan de vuelo' });
    }
  } else if (req.method === 'PUT') {
    const { customName, status, csvResult } = req.body;
    try {
      const updatedPlan = await prisma.flightPlan.update({
        where: { id: Number(id) },
        data: { customName, status, csvResult },
      });
      res.json(updatedPlan);
    } catch (error) {
      res.status(500).json({ error: 'Error actualizando el plan de vuelo' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
