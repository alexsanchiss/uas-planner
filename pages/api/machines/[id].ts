// pages/api/machines/[id].ts
//
// ⚠️  DEPRECATED - DO NOT USE FOR NEW DEVELOPMENT
// ================================================
// This Pages Router API is deprecated.
// Machine management API - not yet migrated to App Router.
// TODO: Migrate to App Router if machines feature is still needed.
//
// Migration date: 2026-01-13 (marked deprecated)
// Removal planned: After thorough testing or feature removal
//
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
      res.status(500).json({ error: 'Error actualizando el estado de la máquina', details: (error as Error).message});
    }
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}
