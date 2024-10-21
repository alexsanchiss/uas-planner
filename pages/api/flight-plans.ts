// pages/api/flight-plans.ts
import { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Obtener todos los planes de vuelo
    const flightPlans = await prisma.flightPlan.findMany();
    res.status(200).json(flightPlans);
  } else if (req.method === 'POST') {
    // Crear un nuevo plan de vuelo
    const { customName, status, fileContent } = req.body;
    const newPlan = await prisma.flightPlan.create({
      data: {
        customName,
        status,
        fileContent,
      },
    });
    res.status(201).json(newPlan);
  } else if (req.method === 'DELETE') {
    // Eliminar un plan de vuelo
    const { id } = req.query;
    await prisma.flightPlan.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: 'Plan eliminado' });
  } else {
    res.status(405).json({ message: 'Método no permitido' });
  }
}
