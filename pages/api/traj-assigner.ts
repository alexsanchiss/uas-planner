// pages/api/traj-assigner.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface FlightPlan {
  id: number;
  fileContent: string; // Almacenar el contenido como string ya que proviene de la base de datos
  customName: string;
  status: 'sin procesar' | 'en cola' | 'procesando' | 'procesado' | 'error';
  csvResult?: string;
  res: NextApiResponse;
}

let processingQueue: FlightPlan[] = [];
let busyMachines: Set<string> = new Set();
let isProcessing = false;

const machines = Object.entries(process.env)
  .filter(([key]) => key.startsWith('VM'))
  .map(([, value]) => value) as string[];

// Procesar el siguiente plan en la cola
const processNextInQueue = async () => {
  if (isProcessing || processingQueue.length === 0) return;

  const flightPlan = processingQueue.shift();
  if (!flightPlan) return;

  isProcessing = true;

  // Esperar hasta que haya una máquina disponible
  let freeMachine: string | undefined;
  while (!freeMachine) {
    freeMachine = machines.find((machine) => !busyMachines.has(machine));
    if (!freeMachine) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  busyMachines.add(freeMachine);

  try {
    // Enviar solicitud POST a la máquina virtual
    const response = await axios.post(
      `${freeMachine}/upload_plan`,
      {
        id: flightPlan.id,
        fileContent: flightPlan.fileContent,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 200000000,
      }
    );

    if (response.status === 200) {
      const csvResult = response.data;
      flightPlan.csvResult = csvResult;

      // Actualizar estado en base de datos y enviar respuesta
      flightPlan.status = 'procesado';
      flightPlan.res.status(200).json({ success: true, csv: csvResult });
      console.log(`Plan ${flightPlan.customName} procesado en ${freeMachine}`);
    } else {
      console.error(`Error en el procesamiento de ${flightPlan.customName}`);
      flightPlan.status = 'error';
      flightPlan.res.status(500).json({ success: false, message: 'Error procesando la trayectoria.' });
    }
  } catch (e) {
    console.error(`Error procesando el plan ${flightPlan.customName}:`, (e as Error).message);
    flightPlan.status = 'error';
    flightPlan.res.status(500).json({ success: false, message: 'Error interno al procesar la trayectoria.' });
  } finally {
    busyMachines.delete(freeMachine);
    isProcessing = false;

    // Procesar el siguiente en cola
    await processNextInQueue();
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { id } = req.body;

    // Obtener el plan de vuelo desde la base de datos
    const flightPlan = await obtenerPlanDeVueloPorId(id);
    if (!flightPlan) {
      res.status(404).json({ error: 'Plan de vuelo no encontrado' });
      return;
    }

    // Configurar el plan de vuelo y actualizar su estado a "en cola"
    const plan: FlightPlan = {
      ...flightPlan,
      status: 'en cola',
      res,
    };

    // Añadir el plan a la cola de procesamiento
    processingQueue.push(plan);
    console.log(`Plan ${flightPlan.customName} añadido a la cola.`);

    // Intentar procesar el siguiente plan en cola
    await processNextInQueue();
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}

// Función para obtener el plan de vuelo desde la base de datos
async function obtenerPlanDeVueloPorId(id: number): Promise<FlightPlan | null> {
  try {
    const response = await axios.get(`http://localhost:3000/api/flightPlans/${id}`);
    if (response.status === 200) {
      const { id, fileContent, customName, status, csvResult } = response.data;
      return {
        id,
        fileContent,
        customName,
        status,
        csvResult,
        res: {} as NextApiResponse, // Placeholder, se sobreescribe al añadir a la cola
      };
    }
    return null;
  } catch (error) {
    console.error(`Error al obtener el plan de vuelo con ID ${id}:`, error);
    return null;
  }
}
