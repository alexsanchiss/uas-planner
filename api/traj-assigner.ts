import type { NextApiRequest, NextApiResponse } from 'next';

let availableMachines = 1; // Simula cuántas máquinas están libres
let processingQueue: { planIndex: number }[] = [];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { planIndex } = req.body;

  if (availableMachines > 0) {
    availableMachines -= 1; // Asignamos una máquina
    res.status(200).json({ success: true });
  } else {
    processingQueue.push({ planIndex });
    res.status(200).json({ success: false });
  }
}
