import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { file, customName } = req.body;

  // Simular un retraso de procesamiento
  await new Promise((resolve) => setTimeout(resolve, 2000));

  res.status(200).json({ success: true, trajectory: `Processed trajectory for ${customName}` });
}
