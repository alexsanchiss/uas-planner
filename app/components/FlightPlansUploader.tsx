'use client';

import { useState } from 'react';
import axios from 'axios';

interface FlightPlan {
  file: File;
  customName: string;
  status: 'sin procesar' | 'en cola' | 'procesando' | 'procesado';
}

const FlightPlansUploader = () => {
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPlans = Array.from(files).map((file) => ({
        file,
        customName: file.name,
        status: 'sin procesar',
      }));
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };

  const handleCustomNameChange = (index: number, newName: string) => {
    const updatedPlans = flightPlans.map((plan, i) =>
      i === index ? { ...plan, customName: newName } : plan
    );
    setFlightPlans(updatedPlans);
  };

  const handleProcessTrajectory = async (index: number) => {
    const updatedPlans = flightPlans.map((plan, i) =>
      i === index ? { ...plan, status: 'en cola' } : plan
    );
    setFlightPlans(updatedPlans);

    // Llamar a traj-assigner para obtener una máquina libre
    try {
      const response = await axios.post('/api/traj-assigner', { planIndex: index });

      if (response.data.success) {
        const updatedPlansProcessing = flightPlans.map((plan, i) =>
          i === index ? { ...plan, status: 'procesando' } : plan
        );
        setFlightPlans(updatedPlansProcessing);

        // Simulación del procesamiento
        const processedTrajectory = await axios.post('/api/process-trajectory', {
          file: flightPlans[index].file,
          customName: flightPlans[index].customName,
        });

        const finalUpdatedPlans = flightPlans.map((plan, i) =>
          i === index ? { ...plan, status: 'procesado' } : plan
        );
        setFlightPlans(finalUpdatedPlans);
      } else {
        console.log('Todas las máquinas están ocupadas. En cola.');
      }
    } catch (error) {
      console.error('Error procesando la trayectoria:', error);
    }
  };

  const statusColor = (status: FlightPlan['status']) => {
    switch (status) {
      case 'sin procesar':
        return 'bg-gray-300';
      case 'en cola':
        return 'bg-yellow-300';
      case 'procesando':
        return 'bg-blue-300';
      case 'procesado':
        return 'bg-green-300';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold mb-5">Subir Planes de Vuelo</h1>
      <input type="file" multiple onChange={handleFileUpload} className="mb-5 p-2 border rounded" />
      <div className="w-full max-w-3xl">
        {flightPlans.map((plan, index) => (
          <div key={index} className="mb-5 p-4 bg-white shadow rounded-lg">
            <p><strong>Fichero:</strong> {plan.file.name}</p>
            <input
              type="text"
              value={plan.customName}
              onChange={(e) => handleCustomNameChange(index, e.target.value)}
              placeholder="Nombre personalizado"
              className="border p-2 rounded w-full mb-2"
            />
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleProcessTrajectory(index)}
                className="bg-blue-500 text-white py-2 px-4 rounded"
              >
                Procesar Trayectoria
              </button>
              <div
                className={`py-2 px-4 rounded ${statusColor(plan.status)}`}
              >
                {plan.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlightPlansUploader;
