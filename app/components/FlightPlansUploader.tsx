"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import {
  UploadIcon,
  Loader2Icon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  DownloadIcon,
  Trash2Icon,
  RotateCwIcon,
  FolderPlusIcon,
  XIcon,
} from "lucide-react";

interface Folder {
  id: number;
  name: string;
  userId: number;
  flightPlans: FlightPlan[];
  minScheduledAt?: string | null;
  maxScheduledAt?: string | null;
}

interface FlightPlan {
  id: number;
  fileContent: File;
  customName: string;
  status: "sin procesar" | "en cola" | "procesando" | "procesado" | "error";
  csvResult?: number;
  folderId?: number | null;
  authorizationStatus?:
    | "sin autorización"
    | "procesando autorización"
    | "aprobado"
    | "denegado";
  uplan?: any;
  authorizationMessage?: any;
  scheduledAt?: string | null;
}

const ITEMS_PER_PAGE = 5;
const PLANS_PER_FOLDER_PAGE = 25;

export function FlightPlansUploader() {
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<number[]>([]);
  const { user } = useAuth();
  const [folderFilters, setFolderFilters] = useState<{ [key: number]: string }>(
    {}
  );
  const [isDragging, setIsDragging] = useState(false);
  const [authorizationLoading, setAuthorizationLoading] = useState<{
    [planId: number]: boolean;
  }>({});
  const [folderSelectStatus, setFolderSelectStatus] = useState<{
    [key: number]: string;
  }>({});
  const [folderPages, setFolderPages] = useState<{
    [folderId: number]: number;
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [plansResponse, foldersResponse] = await Promise.all([
        axios.get(`/api/flightPlans?userId=${user?.id}`),
        axios.get(`/api/folders?userId=${user?.id}`),
      ]);
      setFlightPlans(plansResponse.data);
      setFolders(foldersResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folderId: number
  ) => {
    const files = e.target.files;
    if (files) {
      const newPlans = await Promise.all(
        Array.from(files).map(async (file) => {
          const response = await axios.post("/api/flightPlans", {
            customName: file.name.replace(/\.[^/.]+$/, ""),
            status: "sin procesar",
            fileContent: await file.text(),
            userId: user?.id,
            folderId: folderId,
          });
          return { ...response.data, file };
        })
      );
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    folderId: number
  ) => {
    handleFileUpload(e, folderId);
  };

  const createFileInput = (folderId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const event = e as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileInputChange(event, folderId);
    };
    return input;
  };

  const handleFolderExpand = (folderId: number) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlans((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  const handleDeselectFolderPlans = (folderId: number) => {
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    const folderPlanIds = folderPlans.map((plan) => plan.id);
    setSelectedPlans((prev) =>
      prev.filter((id) => !folderPlanIds.includes(id))
    );
  };

  const handleProcessFolder = async (folderId: number) => {
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    // Actualizar estado local inmediatamente para todos los planes de la carpeta
    setFlightPlans(
      flightPlans.map((plan) =>
        plan.folderId === folderId ? { ...plan, status: "en cola" } : plan
      )
    );
    // Procesar cada plan
    for (const plan of folderPlans) {
      try {
        const response = await axios.put(`/api/flightPlans/${plan.id}`, {
          status: "en cola",
        });
        // Actualizar el estado con la respuesta del servidor
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === plan.id ? { ...p, ...response.data } : p
          )
        );
      } catch (error) {
        console.error(`Error processing plan ${plan.id}:`, error);
        // Actualizar el estado del plan específico a error
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === plan.id ? { ...p, status: "error" } : p
          )
        );
      }
    }
  };

  const handleDownloadFolder = async (folderId: number) => {
    const folder = folders.find((f) => f.id === folderId);
    const folderPlans = flightPlans.filter(
      (p) => p.folderId === folderId && p.status === "procesado"
    );

    if (folderPlans.length === 0) {
      alert("No hay planes procesados en esta carpeta para descargar.");
      return;
    }

    const zip = new JSZip();
    const usedNames = new Map();
    await Promise.all(
      folderPlans.map(async (plan) => {
        try {
          const response = await axios.get(`/api/csvResult/${plan.id}`);
          if (response.status === 200) {
            let baseName = `${plan.customName}`;
            let fileName = `${baseName}.csv`;
            let count = 1;
            while (usedNames.has(fileName)) {
              fileName = `${baseName} (${count}).csv`;
              count++;
            }
            usedNames.set(fileName, true);
            zip.file(fileName, response.data.csvResult);
          }
        } catch (error) {
          console.error(`Error descargando CSV del plan ${plan.id}:`, error);
        }
      })
    );

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, `${folder?.name || "carpeta"}.zip`);
    });
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (
      window.confirm(
        "¿Estás seguro de que deseas eliminar esta carpeta y todos sus planes?"
      )
    ) {
      try {
        // Obtener todos los planes de la carpeta
        const folderPlans = flightPlans.filter((p) => p.folderId === folderId);

        // Eliminar primero todos los planes de la carpeta
        await Promise.all(
          folderPlans.map((plan) => axios.delete(`/api/flightPlans/${plan.id}`))
        );

        // Eliminar la carpeta
        await axios.delete(`/api/folders/${folderId}`);

        // Actualizar estado local después de que todo se haya eliminado correctamente
        setFolders((prevFolders) =>
          prevFolders.filter((f) => f.id !== folderId)
        );
        setFlightPlans((prevPlans) =>
          prevPlans.filter((p) => p.folderId !== folderId)
        );
      } catch (error) {
        console.error("Error deleting folder:", error);
        // Recargar los datos en caso de error
        fetchData();
      }
    }
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim() && user?.id) {
      const tempId = Date.now();
      try {
        // Actualizar estado local inmediatamente con una carpeta temporal
        const tempFolder: Folder = {
          id: tempId,
          name: newFolderName,
          userId: user.id,
          flightPlans: [],
        };
        // Añadir la carpeta temporal al estado
        setFolders((prevFolders) => [...prevFolders, tempFolder]);
        setNewFolderName("");

        // Realizar la petición al servidor
        const response = await axios.post("/api/folders", {
          name: newFolderName,
          userId: user.id,
        });

        // Actualizar la carpeta temporal con los datos reales del servidor
        setFolders((prevFolders) =>
          prevFolders.map((f) => (f.id === tempId ? response.data : f))
        );
      } catch (error) {
        console.error("Error creating folder:", error);
        // Eliminar la carpeta temporal en caso de error
        setFolders((prevFolders) => prevFolders.filter((f) => f.id !== tempId));
      }
    }
  };

  const handleCustomNameChange = async (planId: number, newName: string) => {
    try {
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, customName: newName } : plan
        )
      );
      await axios.put(`/api/flightPlans/${planId}`, {
        customName: newName,
      });
    } catch (error) {
      console.error("Error updating plan name:", error);
      fetchData();
    }
  };

  // Utilidad para guardar correctamente en UTC
  const toUTCISOString = (value: string) => (value ? value + ":00Z" : null);

  const handleScheduledAtChange = async (planId: number, value: string) => {
    try {
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                scheduledAt: value ? new Date(value).toISOString() : null,
              }
            : plan
        )
      );
      await axios.put(`/api/flightPlans/${planId}`, {
        scheduledAt: value ? new Date(value).toISOString() : null,
      });
    } catch (error) {
      console.error("Error updating scheduledAt:", error);
      fetchData();
    }
  };

  const handleProcessTrajectory = async (planId: number) => {
    try {
      // Actualizar estado local inmediatamente
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, status: "en cola" } : plan
        )
      );

      // Realizar la petición al servidor
      const response = await axios.put(`/api/flightPlans/${planId}`, {
        status: "en cola",
      });

      // Actualizar el estado con la respuesta del servidor
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, ...response.data } : plan
        )
      );
    } catch (error) {
      console.error("Error processing plan:", error);
      // Revertir el estado en caso de error
      setFlightPlans(
        flightPlans.map((plan) =>
          plan.id === planId ? { ...plan, status: "error" } : plan
        )
      );
    }
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      setFlightPlans(flightPlans.filter((p) => p.id !== planId));
      setSelectedPlans(selectedPlans.filter((id) => id !== planId));
      await axios.delete(`/api/flightPlans/${planId}`);
    } catch (error) {
      console.error("Error deleting plan:", error);
      fetchData();
    }
  };

  const handleProcessSelectedPlans = async () => {
    // Actualizar estado local inmediatamente para todos los planes seleccionados
    setFlightPlans(
      flightPlans.map((plan) =>
        selectedPlans.includes(plan.id) ? { ...plan, status: "en cola" } : plan
      )
    );
    // Procesar cada plan seleccionado
    for (const planId of selectedPlans) {
      try {
        const response = await axios.put(`/api/flightPlans/${planId}`, {
          status: "en cola",
        });
        // Actualizar el estado con la respuesta del servidor
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === planId ? { ...p, ...response.data } : p
          )
        );
      } catch (error) {
        console.error(`Error processing plan ${planId}:`, error);
        // Actualizar el estado del plan específico a error
        setFlightPlans(
          flightPlans.map((p) =>
            p.id === planId ? { ...p, status: "error" } : p
          )
        );
      }
    }
  };

  const handleDownloadSelectedPlans = async () => {
    if (selectedPlans.length === 0) {
      alert("No hay planes seleccionados para descargar.");
      return;
    }

    const zip = new JSZip();
    const usedNames = new Map();
    await Promise.all(
      selectedPlans.map(async (id) => {
        const plan = flightPlans.find((p) => p.id === id);
        if (plan?.status === "procesado" && plan.csvResult) {
          try {
            const response = await axios.get(`/api/csvResult/${id}`);
            if (response.status === 200) {
              let baseName = `${plan.customName}`;
              let fileName = `${baseName}.csv`;
              let count = 1;
              while (usedNames.has(fileName)) {
                fileName = `${baseName} (${count}).csv`;
                count++;
              }
              usedNames.set(fileName, true);
              zip.file(fileName, response.data.csvResult);
            }
          } catch (error) {
            console.error(`Error descargando CSV del plan ${id}:`, error);
          }
        }
      })
    );

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "planes_seleccionados.zip");
    });
  };

  const handleDeleteSelectedPlans = async () => {
    if (
      window.confirm(
        "¿Estás seguro de que deseas eliminar los planes seleccionados?"
      )
    ) {
      try {
        setFlightPlans(
          flightPlans.filter((p) => !selectedPlans.includes(p.id))
        );
        setSelectedPlans([]);
        await Promise.all(
          selectedPlans.map((planId) =>
            axios.delete(`/api/flightPlans/${planId}`)
          )
        );
      } catch (error) {
        console.error("Error deleting selected plans:", error);
        fetchData();
      }
    }
  };

  const downloadCsv = async (planId: number, fileName: string) => {
    try {
      const response = await axios.get(`/api/csvResult/${planId}`);
      if (response.status === 200) {
        const csvData = response.data.csvResult;
        const blob = new Blob([csvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.setAttribute("hidden", "");
        a.setAttribute("href", url);
        a.setAttribute("download", fileName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error en la descarga del CSV:", error);
    }
  };

  const countByStatus = (status: string) =>
    flightPlans.filter((plan) => plan.status === status).length;

  const getFolderStatusCounts = (folderId: number) => {
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    return {
      sinProcesar: folderPlans.filter((plan) => plan.status === "sin procesar")
        .length,
      enCola: folderPlans.filter((plan) => plan.status === "en cola").length,
      procesando: folderPlans.filter((plan) => plan.status === "procesando")
        .length,
      procesado: folderPlans.filter((plan) => plan.status === "procesado")
        .length,
      error: folderPlans.filter((plan) => plan.status === "error").length,
    };
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "sin procesar":
        return "bg-gray-500";
      case "en cola":
        return "bg-yellow-500";
      case "procesando":
        return "bg-blue-500";
      case "procesado":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleFolderFilterChange = (folderId: number, value: string) => {
    setFolderFilters((prev) => ({
      ...prev,
      [folderId]: value,
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent, folderId?: number) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files) {
      const newPlans = await Promise.all(
        Array.from(files).map(async (file) => {
          const response = await axios.post("/api/flightPlans", {
            customName: file.name.replace(/\.[^/.]+$/, ""),
            status: "sin procesar",
            fileContent: await file.text(),
            userId: user?.id,
            folderId: folderId || null,
          });
          return { ...response.data, file };
        })
      );
      setFlightPlans([...flightPlans, ...newPlans]);
    }
  };

  const handleRequestAuthorization = async (planId: number) => {
    setAuthorizationLoading((prev) => ({ ...prev, [planId]: true }));
    // Cambiar estado localmente a "procesando autorización"
    setFlightPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? { ...plan, authorizationStatus: "procesando autorización" }
          : plan
      )
    );
    try {
      // Actualizar el estado en la base de datos
      await axios.put(`/api/flightPlans/${planId}`, {
        authorizationStatus: "procesando autorización",
      });
      // Llamar al endpoint de generación de U-Plan
      await axios.post(`/api/flightPlans/${planId}/uplan`);
      // No actualizamos el estado local a aprobado o denegado aquí, dejamos que fetchData lo haga
    } catch (error: any) {
      // Error de red o del backend
      const errorMsg =
        error?.response?.data?.error || error?.message || "Error desconocido";
      // Opcional: podrías mostrar un toast o alerta, pero no cambies el estado local a denegado
      console.error("Error solicitando autorización:", errorMsg);
    } finally {
      setAuthorizationLoading((prev) => ({ ...prev, [planId]: false }));
    }
  };

  const downloadUplan = (plan: FlightPlan) => {
    if (!plan.uplan) return;
    const blob = new Blob([JSON.stringify(plan.uplan, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.customName}_uplan.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAuthorizationMessage = (plan: FlightPlan) => {
    if (!plan.authorizationMessage) return;
    const blob = new Blob(
      [
        typeof plan.authorizationMessage === "string"
          ? plan.authorizationMessage
          : JSON.stringify(plan.authorizationMessage, null, 2),
      ],
      { type: "application/json" }
    );
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.customName}_authorization_error.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFolderScheduledAtChange = async (
    folderId: number,
    field: "minScheduledAt" | "maxScheduledAt",
    value: string
  ) => {
    try {
      setFolders(
        folders.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                [field]: value ? new Date(value).toISOString() : null,
              }
            : folder
        )
      );
      await axios.put(`/api/folders/${folderId}`, {
        [field]: value ? new Date(value).toISOString() : null,
      });
    } catch (error) {
      console.error(`Error updating ${field} for folder:`, error);
      fetchData();
    }
  };

  const handleRandomizeScheduledAt = async (folderId: number) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder || !folder.minScheduledAt || !folder.maxScheduledAt) return;
    const min = new Date(folder.minScheduledAt).getTime();
    const max = new Date(folder.maxScheduledAt).getTime();
    if (isNaN(min) || isNaN(max) || min >= max) return;
    const folderPlans = flightPlans.filter(
      (plan) => plan.folderId === folderId
    );
    try {
      // Generar y enviar todas las actualizaciones en paralelo
      const updates = await Promise.all(
        folderPlans.map(async (plan) => {
          const randomTime = new Date(min + Math.random() * (max - min));
          const iso = randomTime.toISOString();
          await axios.put(`/api/flightPlans/${plan.id}`, { scheduledAt: iso });
          return { ...plan, scheduledAt: iso };
        })
      );
      // Actualizar el estado local solo después de que todas las peticiones hayan sido exitosas
      setFlightPlans((prevPlans) =>
        prevPlans.map((plan) => {
          const updated = updates.find((u) => u.id === plan.id);
          return updated ? updated : plan;
        })
      );
    } catch (error) {
      console.error("Error randomizando horas:", error);
      fetchData();
    }
  };

  const handleSelectFolderPlansByStatus = (
    folderId: number,
    status: string
  ) => {
    const folderPlans = flightPlans.filter((plan) => {
      if (status === "Todos") return plan.folderId === folderId;
      if (
        [
          "sin procesar",
          "en cola",
          "procesando",
          "procesado",
          "error",
        ].includes(status)
      ) {
        return plan.folderId === folderId && plan.status === status;
      }
      if (["sin autorización", "aprobado", "denegado"].includes(status)) {
        return (
          plan.folderId === folderId && plan.authorizationStatus === status
        );
      }
      return false;
    });
    const folderPlanIds = folderPlans.map((plan) => plan.id);
    setSelectedPlans((prev) => [
      ...prev,
      ...folderPlanIds.filter((id) => !prev.includes(id)),
    ]);
  };

  const handleFolderPageChange = (
    folderId: number,
    newPage: number,
    total: number
  ) => {
    setFolderPages((prev) => ({
      ...prev,
      [folderId]: Math.max(1, Math.min(newPage, total)),
    }));
  };

  const handleRequestAuthorizationSelected = async () => {
    for (const planId of selectedPlans) {
      const plan = flightPlans.find((p) => p.id === planId);
      if (
        plan &&
        plan.status === "procesado" &&
        (!plan.authorizationStatus ||
          plan.authorizationStatus === "sin autorización")
      ) {
        await handleRequestAuthorization(planId);
      }
    }
  };
  // 1. Cambiar los handlers para recibir folderId y descargar todos los autorizados/denegados de la carpeta
  const handleDownloadUplansFolder = async (folderId: number) => {
    const plans = flightPlans.filter(
      (p) =>
        p.folderId === folderId &&
        p.authorizationStatus === "aprobado" &&
        p.uplan
    );
    if (plans.length === 0) {
      alert("No hay U-Plans autorizados en esta carpeta.");
      return;
    }
    const zip = new JSZip();
    plans.forEach((plan) => {
      zip.file(
        `${plan.customName}_uplan.json`,
        JSON.stringify(plan.uplan, null, 2)
      );
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `uplans_autorizados_${folderId}.zip`);
  };
  const handleDownloadDenegationMessagesFolder = async (folderId: number) => {
    const plans = flightPlans.filter(
      (p) =>
        p.folderId === folderId &&
        p.authorizationStatus === "denegado" &&
        p.authorizationMessage
    );
    if (plans.length === 0) {
      alert("No hay mensajes de denegación en esta carpeta.");
      return;
    }
    const zip = new JSZip();
    plans.forEach((plan) => {
      zip.file(
        `${plan.customName}_authorization_error.json`,
        typeof plan.authorizationMessage === "string"
          ? plan.authorizationMessage
          : JSON.stringify(plan.authorizationMessage, null, 2)
      );
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `mensajes_denegacion_${folderId}.zip`);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">
          Gestor de Planes de Vuelo
        </h1>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Sin procesar</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("sin procesar")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">En cola</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("en cola")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Procesando</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("procesando")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Procesado</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("procesado")}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <span className="text-gray-300">Error</span>
              <div className="text-2xl font-bold text-white">
                {countByStatus("error")}
              </div>
            </div>
          </div>
        </div>

        {user ? (
          <>
            <div className="mb-6 flex gap-4">
              <Input
                placeholder="Nueva carpeta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 bg-gray-700 text-white text-base"
              />
              <Button
                variant="outline"
                onClick={handleCreateFolder}
                className="text-blue-400/80 hover:bg-blue-500/80 hover:text-white border-blue-400/30 hover:border-blue-500 transition-all duration-200 text-base h-[60px] px-6 whitespace-normal"
              >
                <div className="flex items-center">
                  <FolderPlusIcon className="h-4 w-4 mr-2" />
                  Crear Carpeta
                </div>
              </Button>
            </div>

            {/* Render folders */}
            {folders.map((folder) => {
              const folderPlans = flightPlans.filter(
                (p) => p.folderId === folder.id
              );
              const isExpanded = expandedFolders.includes(folder.id);
              const statusCounts = getFolderStatusCounts(folder.id);
              const filteredPlans = folderPlans.filter((plan) =>
                plan.customName
                  .toLowerCase()
                  .includes((folderFilters[folder.id] || "").toLowerCase())
              );

              const page = folderPages[folder.id] || 1;
              const plansPerPage = PLANS_PER_FOLDER_PAGE;
              const totalFolderPages = Math.max(
                1,
                Math.ceil(filteredPlans.length / plansPerPage)
              );
              const paginatedPlans = filteredPlans.slice(
                (page - 1) * plansPerPage,
                page * plansPerPage
              );

              return (
                <div
                  key={folder.id}
                  className="mb-6 border border-gray-700 rounded-lg overflow-hidden shadow-lg"
                >
                  <div
                    className="flex items-center justify-between p-4 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors"
                    onClick={() => handleFolderExpand(folder.id)}
                  >
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-semibold text-white">
                        {folder.name}
                      </h2>
                      <div className="flex gap-2">
                        <Badge className="bg-gray-700/90 text-white">
                          Sin procesar: {statusCounts.sinProcesar}
                        </Badge>
                        <Badge className="bg-yellow-500/90 text-white">
                          En cola: {statusCounts.enCola}
                        </Badge>
                        <Badge className="bg-violet-500/90 text-white">
                          Procesando: {statusCounts.procesando}
                        </Badge>
                        <Badge className="bg-green-500/90 text-white">
                          Procesado: {statusCounts.procesado}
                        </Badge>
                        <Badge className="bg-red-500/90 text-white">
                          Error: {statusCounts.error}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessFolder(folder.id);
                        }}
                        className="text-violet-400 hover:bg-violet-500/90 hover:text-white border-violet-400/50 hover:border-violet-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <RotateCwIcon className="h-4 w-4 mr-2" />
                          Procesar
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFolder(folder.id);
                        }}
                        className="text-green-400 hover:bg-green-500/80 hover:text-white border-green-400/50 hover:border-green-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Descargar
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="text-rose-400 hover:bg-rose-500/90 hover:text-white border-rose-400/50 hover:border-rose-500 transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <Trash2Icon className="h-4 w-4 mr-2" />
                          Eliminar
                        </div>
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-gray-900">
                      <div className="mb-4">
                        <div
                          className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
                            isDragging
                              ? "border-blue-500 bg-blue-900/20"
                              : "border-gray-700 hover:border-blue-500 hover:bg-blue-900/10"
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, folder.id)}
                          onClick={() => {
                            const input = createFileInput(folder.id);
                            input.click();
                          }}
                        >
                          <div className="flex flex-col items-center justify-center text-center">
                            <UploadIcon className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-gray-400">
                              Arrastra y suelta archivos aquí o haz clic para
                              seleccionar
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 flex flex-col gap-4">
                        <div className="flex justify-between">
                          <div className="flex-1 flex gap-2 pr-16">
                            {folderPlans.some((plan) =>
                              selectedPlans.includes(plan.id)
                            ) && (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => handleProcessSelectedPlans()}
                                  className="text-violet-400/80 hover:bg-violet-500/80 hover:text-white border-violet-400/30 hover:border-violet-500 transition-all duration-200 text-sm h-[60px] px-3 whitespace-normal"
                                >
                                  <div className="flex items-center">
                                    <RotateCwIcon className="h-3.5 w-3.5 mr-1.5" />
                                    Procesar seleccionados
                                  </div>
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDownloadSelectedPlans()}
                                  className="text-green-800 hover:bg-green-500/80 hover:text-white border-green-400/30 hover:border-green-500 transition-all duration-200 text-sm h-[60px] px-3 whitespace-normal"
                                >
                                  <div className="flex items-center">
                                    <DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
                                    Descargar seleccionados
                                  </div>
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDeleteSelectedPlans()}
                                  className="text-rose-400/80 hover:bg-rose-500/80 hover:text-white border-rose-400/30 hover:border-rose-500 transition-all duration-200 text-sm h-[60px] px-3 whitespace-normal"
                                >
                                  <div className="flex items-center">
                                    <Trash2Icon className="h-3.5 w-3.5 mr-1.5" />
                                    Eliminar seleccionados
                                  </div>
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="flex-none flex gap-2 pl-16 items-center">
                            <select
                              value={folderSelectStatus[folder.id] || "Todos"}
                              onChange={(e) => {
                                setFolderSelectStatus((prev) => ({
                                  ...prev,
                                  [folder.id]: e.target.value,
                                }));
                                handleSelectFolderPlansByStatus(
                                  folder.id,
                                  e.target.value
                                );
                              }}
                              className="bg-gray-700 text-white border border-gray-500 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="Todos">Todos</option>
                              <option value="sin procesar">Sin procesar</option>
                              <option value="en cola">En cola</option>
                              <option value="procesando">Procesando</option>
                              <option value="procesado">Procesado</option>
                              <option value="error">Error</option>
                              <option value="sin autorización">
                                Sin autorización
                              </option>
                              <option value="aprobado">Autorizado</option>
                              <option value="denegado">Denegado</option>
                            </select>
                            <Button
                              variant="outline"
                              onClick={() =>
                                handleDeselectFolderPlans(folder.id)
                              }
                              className="text-gray-400/80 hover:bg-gray-500/80 hover:text-white border-gray-400/30 hover:border-gray-500 transition-all duration-200 text-sm h-[60px] px-3 whitespace-normal"
                            >
                              <div className="flex items-center">
                                <XIcon className="h-3.5 w-3.5 mr-1.5" />
                                Deseleccionar
                              </div>
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center w-full py-2 border-b border-gray-700 mb-2">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="text-violet-400/80 hover:bg-violet-500/80 hover:text-white border-violet-400/30 hover:border-violet-500 transition-all duration-200 text-sm h-[48px] px-3 whitespace-normal"
                              onClick={handleRequestAuthorizationSelected}
                              disabled={selectedPlans.length === 0}
                            >
                              Solicitar autorización seleccionados
                            </Button>
                            <Button
                              variant="outline"
                              className="text-green-400/80 hover:bg-green-500/80 hover:text-white border-green-400/30 hover:border-green-500 transition-all duration-200 text-sm h-[48px] px-3 whitespace-normal"
                              onClick={() =>
                                handleDownloadUplansFolder(folder.id)
                              }
                              disabled={
                                !flightPlans.some(
                                  (p) =>
                                    p.folderId === folder.id &&
                                    p.authorizationStatus === "aprobado" &&
                                    p.uplan
                                )
                              }
                            >
                              Descargar U-Plans autorizados
                            </Button>
                            <Button
                              variant="outline"
                              className="text-rose-400/80 hover:bg-rose-500/80 hover:text-white border-rose-400/50 hover:border-rose-500 transition-all duration-200 text-sm h-[48px] px-3 whitespace-normal"
                              onClick={() =>
                                handleDownloadDenegationMessagesFolder(
                                  folder.id
                                )
                              }
                              disabled={
                                !flightPlans.some(
                                  (p) =>
                                    p.folderId === folder.id &&
                                    p.authorizationStatus === "denegado" &&
                                    p.authorizationMessage
                                )
                              }
                            >
                              Descargar mensajes denegación
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-gray-300 text-sm">
                              Mín:
                            </label>
                            <input
                              type="datetime-local"
                              value={
                                folder.minScheduledAt
                                  ? new Date(folder.minScheduledAt)
                                      .toISOString()
                                      .slice(0, 16)
                                  : ""
                              }
                              onChange={(e) =>
                                handleFolderScheduledAtChange(
                                  folder.id,
                                  "minScheduledAt",
                                  e.target.value
                                )
                              }
                              className="bg-gray-700/50 border border-gray-600 rounded-md px-2 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 w-[180px]"
                              placeholder="Hora mínima"
                            />
                            <label className="text-gray-300 text-sm">
                              Máx:
                            </label>
                            <input
                              type="datetime-local"
                              value={
                                folder.maxScheduledAt
                                  ? new Date(folder.maxScheduledAt)
                                      .toISOString()
                                      .slice(0, 16)
                                  : ""
                              }
                              onChange={(e) =>
                                handleFolderScheduledAtChange(
                                  folder.id,
                                  "maxScheduledAt",
                                  e.target.value
                                )
                              }
                              className="bg-gray-700/50 border border-gray-600 rounded-md px-2 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 w-[180px]"
                              placeholder="Hora máxima"
                            />
                            <Button
                              variant="outline"
                              className="text-blue-400/80 hover:bg-blue-500/80 hover:text-white border-blue-400/30 hover:border-blue-500 transition-all duration-200 text-sm h-[48px] px-3 whitespace-normal"
                              onClick={() =>
                                handleRandomizeScheduledAt(folder.id)
                              }
                              disabled={
                                !folder.minScheduledAt || !folder.maxScheduledAt
                              }
                            >
                              Aleatorizar horas
                            </Button>
                          </div>
                        </div>
                      </div>

                      {filteredPlans.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">
                          Esta carpeta está vacía
                        </p>
                      ) : (
                        <>
                          {paginatedPlans.map((plan) => (
                            <div
                              key={plan.id}
                              className="bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 p-4 border border-gray-700/50 hover:border-gray-600/50"
                            >
                              <div className="flex items-center gap-4">
                                <Checkbox
                                  checked={selectedPlans.includes(plan.id)}
                                  onCheckedChange={(checked) =>
                                    handleSelectPlan(plan.id)
                                  }
                                  className="border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 shrink-0 hover:border-blue-400 transition-colors"
                                />
                                <input
                                  type="text"
                                  value={plan.customName}
                                  onChange={(e) =>
                                    handleCustomNameChange(
                                      plan.id,
                                      e.target.value
                                    )
                                  }
                                  className="flex-1 bg-gray-700/50 border border-gray-600 rounded-md px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500"
                                  placeholder="Nombre del plan"
                                />
                                <input
                                  type="datetime-local"
                                  value={
                                    plan.scheduledAt
                                      ? new Date(plan.scheduledAt)
                                          .toISOString()
                                          .slice(0, 16)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    handleScheduledAtChange(
                                      plan.id,
                                      e.target.value
                                    )
                                  }
                                  className="ml-2 bg-gray-700/50 border border-gray-600 rounded-md px-2 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 hover:border-gray-500 w-[210px]"
                                  placeholder="Fecha y hora de vuelo"
                                />
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    plan.status === "procesado"
                                      ? downloadCsv(
                                          plan.id,
                                          `${plan.customName}.csv`
                                        )
                                      : handleProcessTrajectory(plan.id)
                                  }
                                  disabled={
                                    plan.status === "en cola" ||
                                    plan.status === "procesando"
                                  }
                                  className={`
                                    min-w-[140px] transition-all duration-200 shrink-0
                                    ${
                                      plan.status === "sin procesar"
                                        ? "text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500"
                                        : ""
                                    }
                                    ${
                                      plan.status === "en cola"
                                        ? "text-amber-400 border-amber-400 hover:text-yellow-300 hover:border-yellow-300"
                                        : ""
                                    }
                                    ${
                                      plan.status === "procesando"
                                        ? "text-violet-400 hover:bg-violet-500/90 hover:text-white border-violet-400/50 hover:border-violet-500"
                                        : ""
                                    }
                                    ${
                                      plan.status === "procesado"
                                        ? "text-green-400 hover:bg-green-500/80 hover:text-white border-green-400/50 hover:border-green-500 transition-all duration-200"
                                        : ""
                                    }
                                    disabled:opacity-75 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current
                                  `}
                                >
                                  {plan.status === "en cola" && (
                                    <div className="flex items-center text-amber-400">
                                      <ClockIcon className="h-4 w-4 mr-2 text-amber-400" />
                                      En cola
                                    </div>
                                  )}
                                  {plan.status === "procesando" && (
                                    <div className="flex items-center">
                                      <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                                      Procesando
                                    </div>
                                  )}
                                  {plan.status === "procesado" && (
                                    <div className="flex items-center">
                                      <DownloadIcon className="h-4 w-4 mr-2" />
                                      Descargar
                                    </div>
                                  )}
                                  {plan.status === "sin procesar" && (
                                    <div className="flex items-center">
                                      <PlayIcon className="h-4 w-4 mr-2" />
                                      Procesar
                                    </div>
                                  )}
                                </Button>
                                <div>
                                  {(plan.authorizationStatus === undefined ||
                                    plan.authorizationStatus === null ||
                                    plan.authorizationStatus ===
                                      "sin autorización") && (
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        handleRequestAuthorization(plan.id)
                                      }
                                      disabled={
                                        authorizationLoading[plan.id] ||
                                        plan.status !== "procesado"
                                      }
                                      className={
                                        `text-blue-400 hover:bg-blue-500/90 hover:text-white border-blue-400/50 hover:border-blue-500 min-w-[140px] ml-2` +
                                        (authorizationLoading[plan.id] ||
                                        plan.status !== "procesado"
                                          ? " opacity-50 cursor-not-allowed"
                                          : "")
                                      }
                                    >
                                      {authorizationLoading[plan.id] ? (
                                        <div className="flex items-center">
                                          <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                                          Enviando...
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <PlayIcon className="h-4 w-4 mr-2" />
                                          Solicitar autorización
                                        </div>
                                      )}
                                    </Button>
                                  )}
                                  {plan.authorizationStatus ===
                                    "procesando autorización" && (
                                    <Button
                                      variant="outline"
                                      disabled
                                      className="text-violet-400 border-violet-400/50 min-w-[140px] ml-2"
                                    >
                                      <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                                      Procesando autorización
                                    </Button>
                                  )}
                                  {plan.authorizationStatus === "aprobado" && (
                                    <Button
                                      variant="outline"
                                      onClick={() => downloadUplan(plan)}
                                      className="text-green-400 hover:bg-green-500/90 hover:text-white border-green-400/50 hover:border-green-500 min-w-[140px] ml-2"
                                    >
                                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                                      Autorizado: descargar uplan
                                    </Button>
                                  )}
                                  {plan.authorizationStatus === "denegado" && (
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        downloadAuthorizationMessage(plan)
                                      }
                                      className="text-rose-400 hover:bg-rose-500/90 hover:text-white border-rose-400/50 hover:border-rose-500 min-w-[140px] ml-2"
                                    >
                                      <XIcon className="h-4 w-4 mr-2" />
                                      Denegado: ver mensaje
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDeletePlan(plan.id)}
                                  className="text-rose-400 hover:bg-rose-500/90 hover:text-white border-rose-400/50 hover:border-rose-500 transition-all duration-200 p-2 shrink-0"
                                >
                                  <Trash2Icon className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {totalFolderPages > 1 && (
                            <div className="flex justify-between items-center mt-2">
                              <Button
                                onClick={() =>
                                  handleFolderPageChange(
                                    folder.id,
                                    page - 1,
                                    totalFolderPages
                                  )
                                }
                                disabled={page === 1}
                                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
                              >
                                Anterior
                              </Button>
                              <span className="text-white">
                                Página {page} de {totalFolderPages}
                              </span>
                              <Button
                                onClick={() =>
                                  handleFolderPageChange(
                                    folder.id,
                                    page + 1,
                                    totalFolderPages
                                  )
                                }
                                disabled={page === totalFolderPages}
                                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
                              >
                                Siguiente
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-between mt-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
              >
                Anterior
              </Button>
              <span className="text-white">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800"
              >
                Siguiente
              </Button>
            </div>
          </>
        ) : (
          <p className="text-center text-red-500">Debes iniciar sesión</p>
        )}
      </div>
    </div>
  );
}

export default FlightPlansUploader;
