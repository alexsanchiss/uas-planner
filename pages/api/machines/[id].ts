// pages/api/machines/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { status } = req.body;
    try {
      const updatedMachine = await prisma.machine.update({
        where: { id: Number(id) },
        data: { status },
      });
      res.json(updatedMachine);
    } catch (error) {
      res.status(500).json({ error: 'Error actualizando el estado de la máquina' });
    }
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}
