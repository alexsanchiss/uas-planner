import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface FlightPlan {
  name: string;
  file: string;
  index: number;
  csvResult?: string;
  res: NextApiResponse;  // Guardamos la respuesta para enviarla al final
}

let processingQueue: FlightPlan[] = [];
let busyMachines: Set<string> = new Set();
let isProcessing = false; // Flag para saber si se está procesando

const machines = Object.entries(process.env)
  .filter(([key]) => key.startsWith('VM'))
  .map(([, value]) => value) as string[];

// Procesar el siguiente plan en la cola
const processNextInQueue = async () => {
  if (isProcessing || processingQueue.length === 0) return; // Evitar múltiples ejecuciones

  const flightPlan = processingQueue.shift(); // Sacamos el primer plan de la cola
  if (!flightPlan) return;

  isProcessing = true;

  // Esperar hasta que haya una máquina disponible
  let freeMachine: string | undefined;
  while (!freeMachine) {
    freeMachine = machines.find((machine) => !busyMachines.has(machine));
    if (!freeMachine) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de volver a intentar
    }
  }

  busyMachines.add(freeMachine); // Reservar la máquina
  try {
    // Hacer la solicitud POST a la máquina virtual
    const response = await axios.post(`${freeMachine}/upload_plan`, {
      name: flightPlan.name,
      ...JSON.parse(flightPlan.file),
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 200000,  // Hasta 200 segundos de espera
    });

    if (response.status === 200) {
      const csvResult = response.data;  // Obtenemos el CSV resultante
      flightPlan.csvResult = csvResult;

      // Enviar la respuesta con el CSV cuando esté listo
      flightPlan.res.status(200).json({ success: true, csv: csvResult });
      console.log(`Plan ${flightPlan.name} procesado en ${freeMachine}`);
    } else {
      console.error(`Error en el procesamiento de ${flightPlan.name}`);
      flightPlan.res.status(500).json({ success: false, message: 'Error procesando la trayectoria.' });
    }
  } catch (e) {
    console.error(`Error procesando el plan ${flightPlan.name}:`, (e as Error).message);
    flightPlan.res.status(500).json({ success: false, message: 'Error interno al procesar la trayectoria.' });
  } finally {
    busyMachines.delete(freeMachine); // Liberar la máquina
    isProcessing = false;
    // Procesar el siguiente en cola
    await processNextInQueue();
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { name, file, index } = req.body;

    if (!name || !file || typeof index !== 'number') {
      res.status(400).json({ error: 'Faltan campos requeridos: name, file, index' });
      return;
    }

    const flightPlan: FlightPlan = { name, file, index, res };

    // Añadimos el plan a la cola
    processingQueue.push(flightPlan);
    console.log(`Plan ${name} añadido a la cola.`);

    // Intentamos procesar el siguiente plan
    await processNextInQueue();
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
};
