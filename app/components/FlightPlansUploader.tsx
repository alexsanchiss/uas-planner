'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Checkbox } from "./ui/checkbox"
import { Badge } from "./ui/badge"
import { DownloadIcon, Trash2Icon, RefreshCwIcon } from 'lucide-react'

interface FlightPlan {
  id: number
  fileContent: File
  customName: string
  status: 'sin procesar' | 'en cola' | 'procesando' | 'procesado' | 'error'
  csvResult?: number
}

export function FlightPlansUploader() {
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([])
  const [selectedPlans, setSelectedPlans] = useState<number[]>([])
  const { user } = useAuth()

  useEffect(() => {
    const fetchFlightPlans = async () => {
      if (user?.id) {
        try {
          console.log('Fetching flight plans for user:', user.id)
          const { data } = await axios.get(`/api/flightPlans/user/${user.id}`)
          console.log('Flight plans:', data)
          setFlightPlans(data)
        } catch (error) {
          console.error('Error fetching flight plans:', error)
        }
      }
    }
    console.log('Fetching flight plans for user:', user)
    fetchFlightPlans()
  }, [user])

  // Rest of the component implementation remains the same
  // ...
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPlans = await Promise.all(
        Array.from(files).map(async (file) => {
          const response = await axios.post('/api/flightPlans', {
            customName: file.name.replace(/\.[^/.]+$/, ""),
            status: 'sin procesar',
            fileContent: await file.text(),
            userId: user?.id
          });
          return { ...response.data, file };
        })
      );
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };
  const handleCustomNameChange = async (id: number, newName: string) => {
    const updatedPlan = flightPlans.find((plan) => plan.id === id);
    if (updatedPlan) {
      await axios.put(`/api/flightPlans/${id}`, { customName: newName });
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan) => (plan.id === id ? { ...plan, customName: newName } : plan))
      );
    }
  };
  const handleDeletePlan = async (id: number) => {
    if (confirm('¿Estás seguro de que deseas eliminar este plan de vuelo?')) {
      await axios.delete(`/api/flightPlans/${id}`);
      setFlightPlans(flightPlans.filter((plan) => plan.id !== id));
    }
  };
  const handleSelectPlan = (id: number) => {
    setSelectedPlans((prevSelected) =>
      prevSelected.includes(id) ? prevSelected.filter((planId) => planId !== id) : [...prevSelected, id]
    );
  };
  const handleDeleteSelectedPlans = async () => {
    if (confirm('¿Estás seguro de que deseas eliminar los planes de vuelo seleccionados?')) {
      await Promise.all(selectedPlans.map((id) => axios.delete(`/api/flightPlans/${id}`)));
      setFlightPlans(flightPlans.filter((plan) => !selectedPlans.includes(plan.id)));
      setSelectedPlans([]);
    }
  };
  const handleProcessTrajectory = async (id: number) => {
    // Actualizar el estado local del plan de vuelo a 'en cola'
    setFlightPlans((prevPlans) =>
      prevPlans.map((plan) => (plan.id === id ? { ...plan, status: 'en cola' } : plan))
    );
    try {
      // Actualizar el estado del plan en la base de datos
      await axios.put(`/api/flightPlans/${id}`, { csvResult: 0, status: 'en cola' });
    } catch (error) {
      console.error('Error procesando la trayectoria:', error);
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan) => (plan.id === id ? { ...plan, status: 'error' } : plan))
      );
    }
  };
  const downloadCsv = async (planId: number, fileName: string) => {
    try {
      // Hacer la solicitud GET a la API para obtener el CSV correspondiente
      const response = await axios.get(`/api/csvResult/${planId}`);
      if (response.status === 200) {
        const csvData = response.data.csvResult;  // CSV obtenido de la base de datos
        // Crear un Blob a partir de los datos CSV y crear el enlace de descarga
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        console.error('Error al obtener el CSV:', response.status);
      }
    } catch (error) {
      console.error('Error en la descarga del CSV:', error);
    }
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
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-white mb-6">Subir Planes de Vuelo</h1>
        {user ? (
          <>
            <div className="mb-6">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="bg-gray-800 border-gray-700 text-white file:bg-blue-500 file:text-white file:border-0 file:rounded file:px-4 file:py-2 hover:file:bg-blue-600"
              />
            </div>
            <div className="space-y-4">
              {flightPlans.map((plan) => (
                <Card key={plan.id} className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedPlans.includes(plan.id)}
                          onCheckedChange={() => handleSelectPlan(plan.id)}
                          className="border-gray-600"
                        />
                        <span className="text-white font-medium">{plan.customName}</span>
                      </div>
                      <Input
                        type="text"
                        value={plan.customName}
                        onChange={(e) => handleCustomNameChange(plan.id, e.target.value)}
                        placeholder="Nombre personalizado"
                        className="flex-1 bg-gray-700 border-gray-600 text-white"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePlan(plan.id)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => handleProcessTrajectory(plan.id)}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <RefreshCwIcon className="mr-2 h-4 w-4" />
                        Procesar Trayectoria
                      </Button>
                      <div className="flex items-center space-x-4">
                        <Badge className={`px-3 py-1 ${statusColor(plan.status)}`}>
                          {plan.status}
                        </Badge>
                        <Button
                          onClick={() => plan.csvResult && downloadCsv(plan.id, `${plan.customName}.csv`)}
                          disabled={plan.status !== 'procesado'}
                          variant="ghost"
                          size="icon"
                          className={`text-gray-400 hover:text-white ${
                            plan.status === 'procesado' ? 'opacity-100' : 'opacity-50'
                          }`}
                        >
                          <DownloadIcon className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedPlans.length > 0 && (
              <div className="mt-6">
                <Button
                  onClick={handleDeleteSelectedPlans}
                  variant="destructive"
                  className="w-full"
                >
                  Eliminar {selectedPlans.length} {selectedPlans.length === 1 ? 'plan seleccionado' : 'planes seleccionados'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-red-500">Debes iniciar sesión para subir planes de vuelo</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default FlightPlansUploader;