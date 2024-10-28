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

const machines = Object.entries(process.env)
  .filter(([key]) => key.startsWith('VM'))
  .map(([, value]) => value) as string[];

// Procesar el siguiente plan en la cola
const processNextInQueue = async () => {

  const flightPlan = processingQueue.shift();
  if (!flightPlan) return;

  // Esperar hasta que haya una máquina disponible
  let freeMachine: string | undefined;
  while (!freeMachine) {
    freeMachine = machines.find((machine) => !busyMachines.has(machine));
    if (!freeMachine) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  busyMachines.add(freeMachine);
  console.log(`Procesando plan con ID ${flightPlan.id} en máquina ${freeMachine}`);
  try {
    // Enviar solicitud POST a la máquina virtual con el ID del plan de vuelo
    const response = await axios.post(
      `${freeMachine}/upload_plan/`,
      { id: flightPlan.id },  // Enviar solo el ID en el cuerpo del POST
      {
        timeout: 2000000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (response.status === 200) {
      console.log("Recibido");
      // Actualizar estado en base de datos y enviar respuesta
      flightPlan.res.status(200).json({ success: true, message: 'Trayectoria procesada correctamente.' });
    } else {
      console.log("Error 1");
      flightPlan.res.status(500).json({ success: false, message: 'Error procesando la trayectoria.' });
    }
  } catch (e) {
    console.error(`Error procesando el plan con ID ${flightPlan.id}:`, (e as Error).message);
    flightPlan.res.status(500).json({ success: false, message: 'Error interno al procesar la trayectoria.' });
  } finally {
    busyMachines.delete(freeMachine);

    // Procesar el siguiente en cola
    await processNextInQueue();
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { id } = req.body;

    // Añadir el ID a la cola de procesamiento
    processingQueue.push({ id, res } as FlightPlan);  // Agrega el objeto completo a la cola
    console.log(`Plan con ID ${id} añadido a la cola.`);

    // Intentar procesar el siguiente plan en cola
    await processNextInQueue();

    res.status(200).json({ success: true, message: `Plan con ID ${id} añadido a la cola.` });
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}
