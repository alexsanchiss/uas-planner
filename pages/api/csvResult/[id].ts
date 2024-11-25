// /pages/api/csvResult/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query; // Obtener el ID del parámetro de la URL

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'ID no válido' });
  }

  try {
    // Buscar el resultado CSV en la base de datos
    const csvResult = await prisma.csvResult.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (csvResult) {
      return res.status(200).json({ csvResult: csvResult.csvResult });
    } else {
      return res.status(404).json({ error: 'CSV no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener el CSV:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    await prisma.$disconnect(); // Desconectar de la base de datos
  }
}
