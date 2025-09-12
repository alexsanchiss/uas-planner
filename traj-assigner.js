require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
let isProcessing = false;
const logFile = 'log.csv';

// Asegurar que el archivo CSV tiene encabezado
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, 'id,CustomName,Inicio\n');
}

// ---- FUNCIÓN DE LIMPIEZA SOLO DE PROCESADOS CON csvResult < 2KB ----
const cleanSmallCsvResults = async () => {
  try {
    // Buscar todos los registros en csvResult
    const smallCsvPlans = await prisma.csvResult.findMany();

    // Filtrar los que ocupan menos de 2 KB
    const smallIds = smallCsvPlans
      .filter(p => p.csvResult && Buffer.byteLength(p.csvResult, "utf8") < 2048)
      .map(p => p.id);

    if (smallIds.length > 0) {
      const resetSmall = await prisma.flightPlan.updateMany({
        where: { id: { in: smallIds }, status: "procesado" },
        data: { status: "en cola", machineAssignedId: null, csvResult: "" },
      });
      console.log(`📉 Se han reestablecido ${resetSmall.count} planes "procesado" con csvResult < 2KB a "en cola".`);
    } else {
      console.log("📁 No hay planes procesados con csvResult menor de 2KB.");
    }
  } catch (error) {
    console.error("❌ Error en cleanSmallCsvResults:", error);
  }
};

// ---- FUNCIÓN DE ASIGNACIÓN ----
const assignNextPlan = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const availableMachine = await prisma.machine.findFirst({
      where: { status: 'Disponible' },
    });

    if (!availableMachine) return;

    const currentProcessingPlan = await prisma.flightPlan.findFirst({
      where: { machineAssignedId: availableMachine.id, status: 'procesando' },
    });

    if (currentProcessingPlan) {
      console.log(`[INFO] El plan con ID ${currentProcessingPlan.id} sigue en procesamiento.`);
    }

    const nextPlan = await prisma.flightPlan.findFirst({
      where: { status: 'en cola' },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextPlan) return;

    const startTime = new Date().toLocaleString();

    await prisma.flightPlan.update({
      where: { id: nextPlan.id },
      data: {
        status: 'procesando',
        machineAssignedId: availableMachine.id,
      },
    });

    await prisma.machine.update({
      where: { id: availableMachine.id },
      data: { status: 'Ocupada' },
    });

    console.log(`[${startTime}] Asignado plan con ID ${nextPlan.id} a máquina ${availableMachine.id}`);

    // Registrar el tiempo de inicio en el archivo CSV
    fs.appendFileSync(logFile, `${nextPlan.id},${nextPlan.customName},${startTime}\n`);
  } catch (error) {
    console.error("Error al asignar el plan:", error);
  } finally {
    isProcessing = false;
  }
};

// ---- MAIN ----
const main = async () => {
  // Ejecutar asignación cada 10ms
  setInterval(assignNextPlan, 10);

  // Ejecutar limpieza de planes procesados con csvResult < 2KB cada 1 minuto
  setInterval(cleanSmallCsvResults, 60 * 1000);
};

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
