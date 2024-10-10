import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface FlightPlan {
  name: string;
  file: string;
  index: number;
  csvResult?: string;
}

let processingQueue: FlightPlan[] = [];
let busyMachines: Set<string> = new Set();

const machines = Object.entries(process.env)
  .filter(([key]) => key.startsWith('VM'))
  .map(([, value]) => value) as string[];

const processNextPlan = async (flightPlan: FlightPlan): Promise<string | null> => {
  const freeMachine = machines.find((machine) => !busyMachines.has(machine));
  if (!freeMachine) return null;

  busyMachines.add(freeMachine);
  try {
    // Simular el procesamiento y obtener el CSV
    const response = await axios.post(`${freeMachine}/upload_plan`, {
      name: flightPlan.name,
      ...JSON.parse(flightPlan.file),
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 200000,  // Hasta 200 segundos de espera
    });

    if (response.status === 200) {
      const csvResult = response.data;  // Supongamos que el CSV viene en el body
      return csvResult;  // Devolvemos el resultado del CSV
    }
  } catch (e) {
    console.error(`Error procesando el plan ${flightPlan.name}:`, (e as Error).message);
  } finally {
    busyMachines.delete(freeMachine);  // Liberar la máquina
  }

  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { name, file, index } = req.body;

    if (!name || !file || typeof index !== 'number') {
      res.status(400).json({ error: 'Faltan campos requeridos: name, file, index' });
      return;
    }

    const flightPlan: FlightPlan = { name, file, index };

    // Añadimos el plan a la cola
    processingQueue.push(flightPlan);
    console.log(`Plan ${name} añadido a la cola.`);

    // Esperamos a que esté listo
    const csvResult = await processNextPlan(flightPlan);

    if (csvResult) {
      res.status(200).json({ success: true, csv: csvResult });
    } else {
      res.status(500).json({ success: false, message: 'Error procesando la trayectoria.' });
    }
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}
