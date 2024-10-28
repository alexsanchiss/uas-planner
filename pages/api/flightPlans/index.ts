// pages/api/flightPlans/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const flightPlans = await prisma.flightPlan.findMany();
    res.json(flightPlans);
  } else if (req.method === 'POST') {
    const { customName, status, fileContent } = req.body;
    const newPlan = await prisma.flightPlan.create({
      data: { customName, status, fileContent },
    });
    res.status(201).json(newPlan);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}