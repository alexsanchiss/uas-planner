import { NextApiRequest, NextApiResponse } from 'next';

export default function config(_: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', '52428800');  // Aumenta el límite a 50MB
    res.status(200).json({ message: 'Tamaño máximo configurado para las solicitudes.' });
}
