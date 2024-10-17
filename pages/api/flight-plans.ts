// pages/api/flight-plans.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { customName, fileContent } = req.body;

    try {
      const newFlightPlan = await prisma.flightPlan.create({
        data: {
          customName,
          status: 'sin procesar',
          fileContent,
        },
      });

      res.status(201).json(newFlightPlan);
    } catch (error) {
      res.status(500).json({ error: 'Error creando el plan de vuelo' });
    }
  } else if (req.method === 'GET') {
    try {
      const flightPlans = await prisma.flightPlan.findMany();
      res.status(200).json(flightPlans);
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo los planes de vuelo' });
    }
  } else {
    res.status(405).json({ message: 'Método no permitido' });
  }
}
