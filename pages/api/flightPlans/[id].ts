// pages/api/flightPlans/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { customName, status, csvResult } = req.body;
    const updatedPlan = await prisma.flightPlan.update({
      where: { id: Number(id) },
      data: { customName, status, csvResult },
    });
    res.json(updatedPlan);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
