'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

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
        const { data } = await axios.get(`/api/flightPlans/user/${user.id}`);
        setFlightPlans(data.sort((a, b) => a.id - b.id)); // Ordenar al cargar
      } catch (error) {
        console.error('Error fetching flight plans:', error);
      }
    }
  };
  fetchFlightPlans();
  }, [user])

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

      try {
        await axios.delete(`/api/flightPlans/${id}`);
        setFlightPlans(flightPlans.filter((plan) => plan.id !== id));
      } catch (error) {
        console.error(`Error al eliminar el plan ${id}:`, error);
      }
    }
  };


  const handleSelectPlan = (id: number) => {
    setSelectedPlans((prevSelected) =>
      prevSelected.includes(id) ? prevSelected.filter((planId) => planId !== id) : [...prevSelected, id]
    );
  };

  const handleSelectAllPlans = () => {
    setSelectedPlans(flightPlans.map(plan => plan.id))
  }

  const handleDeselectAllPlans = () => {
    setSelectedPlans([])
  }

  const handleDeleteSelectedPlans = async () => {
    if (confirm('¿Estás seguro de que deseas eliminar los planes de vuelo seleccionados?')) {
      await Promise.all(
        selectedPlans.map(async (id) => {
          try {
            await axios.delete(`/api/flightPlans/${id}`);
          } catch (error) {
            console.error(`Error al eliminar el plan ${id}:`, error);
          }
        })
      );

      setFlightPlans(flightPlans.filter((plan) => !selectedPlans.includes(plan.id)));
      setSelectedPlans([]);
    }
  };


  const handleProcessTrajectory = async (id: number) => {
    setFlightPlans((prevPlans) =>
      prevPlans.map((plan) => (plan.id === id ? { ...plan, status: 'en cola' } : plan))
    );
    try {
      await axios.put(`/api/flightPlans/${id}`, { csvResult: 0, status: 'en cola' });
    } catch (error) {
      console.error('Error procesando la trayectoria:', error);
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan) => (plan.id === id ? { ...plan, status: 'error' } : plan))
      );
    }
  };

  const handleProcessSelectedPlans = async () => {
    await Promise.all(
      selectedPlans.map((id) => handleProcessTrajectory(id))
    );
  };

  const downloadCsv = async (planId: number, fileName: string) => {
    try {
      const response = await axios.get(`/api/csvResult/${planId}`);
      if (response.status === 200) {
        const csvData = response.data.csvResult;
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error en la descarga del CSV:', error);
    }
  };

  const handleDownloadSelectedPlans = async () => {
    if (selectedPlans.length === 0) {
      alert("No hay planes seleccionados para descargar.")
      return
    }

    const zip = new JSZip()
    await Promise.all(
      selectedPlans.map(async (id) => {
        const plan = flightPlans.find((p) => p.id === id)
        if (plan?.status === 'procesado' && plan.csvResult) {
          try {
            const response = await axios.get(`/api/csvResult/${id}`)
            if (response.status === 200) {
              zip.file(`${plan.customName}.csv`, response.data.csvResult)
            }
          } catch (error) {
            console.error(`Error descargando CSV del plan ${id}:`, error)
          }
        }
      })
    )

    zip.generateAsync({ type: 'blob' }).then((content) => {
      saveAs(content, 'planes_seleccionados.zip')
    })
  }

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
          <div className="mb-4 flex justify-between">
              <Button
                onClick={handleSelectAllPlans}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                Seleccionar todos los planes
              </Button>
              <Button
                onClick={handleDeselectAllPlans}
                className="bg-gray-500 hover:bg-gray-600 text-white"
              >
                Deseleccionar todos los planes
              </Button>

          </div>
          {selectedPlans.length > 0 && (
              <div className="mt-6 flex space-x-2">
                <Button
                  onClick={handleDeleteSelectedPlans}
                  variant="destructive"
                  className="w-full"
                >
                  Eliminar {selectedPlans.length} planes seleccionados
                </Button>
                <Button
                  onClick={handleProcessSelectedPlans}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Procesar {selectedPlans.length} planes seleccionados
                </Button>
                <Button
                  onClick={handleDownloadSelectedPlans}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  Descargar {selectedPlans.length} planes seleccionados
                </Button>
              </div>
            )}
            <Input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="mb-6 bg-gray-800 border-gray-700 text-white file:bg-blue-500 file:text-white file:border-0 file:rounded file:px-4 file:py-2 hover:file:bg-blue-600"
            />
            {flightPlans.map((plan) => (
              <Card key={plan.id} className="mb-4 bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <Checkbox
                      checked={selectedPlans.includes(plan.id)}
                      onCheckedChange={() => handleSelectPlan(plan.id)}
                      className="border-gray-600"
                    />
                    <Input
                      type="text"
                      value={plan.customName}
                      onChange={(e) => handleCustomNameChange(plan.id, e.target.value)}
                      className="flex-1 bg-gray-700 border-gray-600 text-white"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleDeletePlan(plan.id)}>
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => handleProcessTrajectory(plan.id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      Procesar Trayectoria
                    </Button>
                    <Badge className={`px-3 py-1 ${statusColor(plan.status)}`}>
                      {plan.status}
                    </Badge>
                    <Button
                      onClick={() =>
                        plan.csvResult && downloadCsv(plan.id, `${plan.customName}.csv`)
                      }
                      disabled={plan.status !== 'procesado'}
                    >
                      <DownloadIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <div className="text-center py-8 text-red-500">Debes iniciar sesión para subir planes de vuelo</div>
        )}
      </div>
    </div>
  );
}

export default FlightPlansUploader;
