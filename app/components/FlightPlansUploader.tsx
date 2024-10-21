'use client';

import { useState } from 'react';
import axios from 'axios';

interface FlightPlan {
  file: File;
  customName: string;
  status: 'sin procesar' | 'en cola' | 'procesando' | 'procesado' | 'error';
  csvResult?: string;
}

const FlightPlansUploader = () => {
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPlans: FlightPlan[] = Array.from(files).map((file) => ({
        file,
        customName: file.name.replace(/\.[^/.]+$/, ""),
        status: 'sin procesar',
      }));
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };

  const handleCustomNameChange = (index: number, newName: string) => {
    setFlightPlans((prevPlans) =>
      prevPlans.map((plan, i) =>
        i === index ? { ...plan, customName: newName } : plan
      )
    );
  };

  const handleProcessTrajectory = async (index: number) => {
    setFlightPlans((prevPlans) =>
      prevPlans.map((plan, i) =>
        i === index ? { ...plan, status: 'en cola' } : plan
      )
    );

    try {
      const flightPlan = flightPlans[index];

      // Enviamos el plan para procesarlo
      const response = await axios.post('/api/traj-assigner', {
        name: flightPlan.customName,
        file: await flightPlan.file.text(),
        index: index,
      });

      if (response.data.success) {
        // Actualizamos el estado a "procesado" cuando tenemos la respuesta
        setFlightPlans((prevPlans) =>
          prevPlans.map((plan, i) =>
            i === index ? { ...plan, status: 'procesado', csvResult: response.data.csv } : plan
          )
        );
      } else {
        setFlightPlans((prevPlans) =>
          prevPlans.map((plan, i) =>
            i === index ? { ...plan, status: 'error' } : plan
          )
        );
      }
    } catch (error) {
      console.error('Error procesando la trayectoria:', error);
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan, i) =>
          i === index ? { ...plan, status: 'error' } : plan
        )
      );
    }
  };

  const downloadCsv = (csvData: string, fileName: string) => {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const statusColor = (status: FlightPlan['status']) => {
    switch (status) {
      case 'sin procesar':
        return 'bg-gray-600';
      case 'en cola':
        return 'bg-yellow-600';
      case 'procesado':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold mb-5">Subir Planes de Vuelo</h1>
      <input
        type="file"
        multiple
        onChange={handleFileUpload}
        className="mb-5 p-2 border rounded bg-gray-800 text-white"
      />
      <div className="w-full max-w-3xl">
        {flightPlans.map((plan, index) => (
          <div key={index} className="relative mb-5 p-4 bg-gray-900 text-white shadow rounded-lg">
            <p><strong>Fichero:</strong> {plan.file.name}</p>
            <input
              type="text"
              value={plan.customName}
              onChange={(e) => handleCustomNameChange(index, e.target.value)}
              placeholder="Nombre personalizado"
              className="border p-2 rounded w-full mb-2 bg-gray-800 text-white"
            />
            <div className="flex justify-between items-center">
              <button
                onClick={() => handleProcessTrajectory(index)}
                className="bg-blue-500 text-white py-2 px-4 rounded"
              >
                Procesar Trayectoria
              </button>
              <div className={`py-2 px-4 mr-12 rounded ${statusColor(plan.status)}`}>
                {plan.status}
              </div>

              {/* Botón de descarga */}
              <button
                onClick={() => plan.csvResult && downloadCsv(plan.csvResult!, `${plan.customName}.csv`)}
                className={`absolute right-4 bottom-4 p-2 rounded border transition-all
                ${plan.status === 'procesado' ? 'bg-green-500 hover:bg-green-600 cursor-pointer' : 'bg-transparent'}`}
                style={{ pointerEvents: plan.status === 'procesado' ? 'auto' : 'none' }}
                aria-label="Descargar CSV"
                disabled={plan.status !== 'procesado'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlightPlansUploader;