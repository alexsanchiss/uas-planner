import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { name, status } = req.body;

    // Verifica que el nombre y el estado sean válidos
    if (!name || !status) {
      return res.status(400).json({ error: 'El nombre y el estado son requeridos.' });
    }

    try {
      // Crea una nueva máquina en la base de datos
      const newMachine = await prisma.machine.create({
        data: {
          name,
          status,
        },
      });
      res.status(201).json(newMachine);
    } catch (error) {
      console.error("Error al crear la máquina:", error);
      res.status(500).json({ error: 'Error al crear la máquina.' });
    }

  } else if (req.method === 'GET') {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Se requiere el parámetro "name".' });
    }

    try {
      // Busca la máquina en la base de datos por su nombre
      const machine = await prisma.machine.findUnique({
        where: { name },
      });

      if (machine) {
        res.status(200).json(machine);
      } else {
        res.status(404).json({ error: 'Máquina no encontrada.' });
      }
    } catch (error) {
      console.error("Error al obtener la máquina:", error);
      res.status(500).json({ error: 'Error al obtener la máquina.' });
    }

  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}
