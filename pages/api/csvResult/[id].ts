// /pages/api/csvResult/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'ID no válido' });
  }

  try {
    if (req.method === 'GET') {
      const csvResult = await prisma.csvResult.findUnique({
        where: { id: parseInt(id, 10) },
      });

      if (csvResult) {
        return res.status(200).json({ csvResult: csvResult.csvResult });
      } else {
        return res.status(404).json({ error: 'CSV no encontrado' });
      }
    } else if (req.method === 'DELETE') {
      await prisma.csvResult.delete({
        where: { id: parseInt(id, 10) },
      });
      res.status(204).end(); // 204 No Content
      return;
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en la solicitud:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await prisma.$disconnect();
  }
}
